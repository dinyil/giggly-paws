
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { FileText, Download, TrendingUp, Scissors, Bone, DollarSign, Wallet, Calendar, User, CheckCircle, ChevronUp, ChevronDown, Search, Package } from '../components/ui/Icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import Button from '../components/ui/Button';

type TimeRange = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';
type ReportTab = 'SALES' | 'INVENTORY' | 'GROOMING';

const Reports: React.FC = () => {
  const { transactions, appointments, products, logs, storeSettings } = useStore();
  
  const [activeTab, setActiveTab] = useState<ReportTab>('SALES');
  const [timeRange, setTimeRange] = useState<TimeRange>('YEAR'); 
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Inventory Pagination & Search State
  const [invLimit, setInvLimit] = useState(50);
  const [invSearch, setInvSearch] = useState('');
  const inventoryContainerRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---
  const isInRange = (dateStr: string) => {
    // Current PH Date String YYYY-MM-DD
    const nowPhStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const [y, m, d] = nowPhStr.split('-').map(Number);
    const todayPh = new Date(y, m - 1, d); // Midnight PH Time

    // Convert Item Date to PH String
    // Note: If dateStr is YYYY-MM-DD (e.g. appointment date), it is already absolute.
    // If dateStr is ISO (e.g. transaction date), it needs conversion.
    let itemPhStr = dateStr;
    if (dateStr.includes('T')) {
        itemPhStr = new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    }

    if (timeRange === 'CUSTOM') {
       if (!customStart || !customEnd) return true;
       return itemPhStr >= customStart && itemPhStr <= customEnd;
    }

    if (timeRange === 'TODAY') {
       return itemPhStr === nowPhStr;
    }
    

    if (timeRange === 'WEEK') {
       // Compute weekAgo as a YYYY-MM-DD string (same timezone-safe approach as other filters)
       const weekAgoDate = new Date(y, m - 1, d);
       weekAgoDate.setDate(weekAgoDate.getDate() - 6); // last 7 days inclusive of today
       const weekAgoStr = weekAgoDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
       return itemPhStr >= weekAgoStr && itemPhStr <= nowPhStr;
    }

    if (timeRange === 'MONTH') {
       const [iy, im] = itemPhStr.split('-').map(Number);
       return iy === y && im === m;
    }

    if (timeRange === 'YEAR') {
       const [iy] = itemPhStr.split('-').map(Number);
       return iy === y;
    }
    
    return true;
  };

  // --- Data Processing ---
  const filteredTransactions = useMemo(() => transactions.filter(t => isInRange(t.date)), [transactions, timeRange, customStart, customEnd]);
  const filteredAppointments = useMemo(() => appointments.filter(a => isInRange(a.date)), [appointments, timeRange, customStart, customEnd]);
  
  // Sales Graph Data
  const graphData = useMemo(() => {
     if (timeRange === 'YEAR') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const map: Record<string, { name: string, sales: number, cost: number, profit: number }> = {};
        months.forEach(m => {
            map[m] = { name: m, sales: 0, cost: 0, profit: 0 };
        });
        filteredTransactions.forEach(t => {
            const d = new Date(t.date);
            const key = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Manila' });
            if (map[key]) {
                const txCost = t.items.reduce((acc, item) => acc + ((item.cost || 0) * item.quantity), 0);
                map[key].sales += t.total;
                map[key].cost += txCost;
                map[key].profit += (t.total - txCost);
            }
        });
        return months.map(m => map[m]);
     }

     const data: Record<string, { name: string, sales: number, cost: number, profit: number }> = {};
     filteredTransactions.forEach(t => {
        const date = new Date(t.date);
        let key = '';
        if (timeRange === 'TODAY') {
            key = date.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
        }
        else if (timeRange === 'WEEK' || timeRange === 'MONTH') {
            key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
        }
        else {
            key = date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila' });
        }

        if (!data[key]) data[key] = { name: key, sales: 0, cost: 0, profit: 0 };
        
        const txCost = t.items.reduce((acc, item) => acc + ((item.cost || 0) * item.quantity), 0);
        data[key].sales += t.total;
        data[key].cost += txCost;
        data[key].profit += (t.total - txCost);
     });
     return Object.values(data);
  }, [filteredTransactions, timeRange]);

  // Top Products & Services (Aggregated)
  const itemStats = useMemo(() => {
     const stats: Record<string, { id: string, name: string, category: string, qty: number, revenue: number, cost: number, type: 'PRODUCT' | 'SERVICE' }> = {};
     filteredTransactions.forEach(t => {
        t.items.forEach(item => {
           if (!stats[item.id]) {
              stats[item.id] = { 
                 id: item.id, 
                 name: item.name, 
                 category: item.category,
                 qty: 0, 
                 revenue: 0, 
                 cost: 0,
                 type: item.isService ? 'SERVICE' : 'PRODUCT' 
              };
           }
           stats[item.id].qty += item.quantity;
           stats[item.id].revenue += item.price * item.quantity;
           stats[item.id].cost += (item.cost || 0) * item.quantity;
        });
     });
     const all = Object.values(stats);
     return {
        products: all.filter(i => i.type === 'PRODUCT').sort((a,b) => b.qty - a.qty),
        services: all.filter(i => i.type === 'SERVICE').sort((a,b) => b.qty - a.qty)
     };
  }, [filteredTransactions]);

  // Inventory Movement (Using Logs)
  const inventoryLogs = useMemo(() => {
     return logs
       .filter(l => {
           const matchesAction = (l.action === 'INVENTORY' || l.action === 'POS');
           const matchesTime = isInRange(l.timestamp);
           const matchesSearch = invSearch 
                ? (l.details.toLowerCase().includes(invSearch.toLowerCase()) || 
                   l.userId.toLowerCase().includes(invSearch.toLowerCase()) ||
                   l.action.toLowerCase().includes(invSearch.toLowerCase()))
                : true;
           return matchesAction && matchesTime && matchesSearch;
       })
       .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, timeRange, customStart, customEnd, invSearch]);

  // Display Logic (Slice)
  const displayedInvLogs = useMemo(() => {
      return inventoryLogs.slice(0, invLimit);
  }, [inventoryLogs, invLimit]);

  useEffect(() => {
      if (inventoryContainerRef.current) {
          inventoryContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  }, [invSearch, timeRange, customStart, customEnd, invLimit]);

  // --- Detailed Grooming Stats ---
  const groomingDetailedStats = useMemo(() => {
      const byStatus = { COMPLETED: 0, SCHEDULED: 0, ONGOING: 0 };
      const groomerPerformance: Record<string, { name: string, appointments: number, revenue: number }> = {};
      let totalGroomingRevenue = 0; 
      let totalGroomingCost = 0; 
      let projectedRevenue = 0; 

      filteredAppointments.forEach(a => {
         if (byStatus[a.status] !== undefined) byStatus[a.status]++;
         
         const service = products.find(p => p.id === a.serviceId);
         const price = service ? service.price : 0;
         const cost = service ? (service.cost || 0) : 0;

         if (a.status === 'COMPLETED') {
             totalGroomingRevenue += price;
             totalGroomingCost += cost;
         }
         
         if (a.status === 'SCHEDULED' || a.status === 'ONGOING') {
             projectedRevenue += price;
         }

         if (!groomerPerformance[a.groomerId]) {
             groomerPerformance[a.groomerId] = { name: a.groomerId, appointments: 0, revenue: 0 };
         }
         groomerPerformance[a.groomerId].appointments++;
         if (a.status === 'COMPLETED') {
             groomerPerformance[a.groomerId].revenue += price;
         }
      });

      return { 
          byStatus, 
          topGroomers: Object.values(groomerPerformance).sort((a,b) => b.revenue - a.revenue),
          totalRevenue: totalGroomingRevenue,
          totalCost: totalGroomingCost,
          netProfit: totalGroomingRevenue - totalGroomingCost,
          projectedRevenue
      };
  }, [filteredAppointments, products]);

  // Grooming Graph Data (Revenue Trend)
  const groomingGraphData = useMemo(() => {
      const data: Record<string, { name: string, revenue: number, appointments: number }> = {};
      filteredAppointments.forEach(a => {
          if (a.status !== 'COMPLETED') return;
          const d = new Date(a.date);
          let key = '';
          // Force PH Time for Grouping
          if (timeRange === 'YEAR') {
              key = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Manila' });
          } else if (timeRange === 'TODAY') {
              // Note: a.time is usually HH:MM stored in DB (already likely local string), 
              // but if using ISO, conversion needed. Assuming 'a.time' is just a string '10:00'.
              // If appointments use ISO date, better to use that.
              // Assuming a.date is YYYY-MM-DD string here.
              key = a.time; // Use the stored time string directly as it's static
          } else {
              key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
          }

          if (!data[key]) data[key] = { name: key, revenue: 0, appointments: 0 };
          const service = products.find(p => p.id === a.serviceId);
          data[key].revenue += service ? service.price : 0;
          data[key].appointments += 1;
      });
      
      if (timeRange === 'YEAR') {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return months.map(m => data[m] || { name: m, revenue: 0, appointments: 0 });
      }
      return Object.values(data);
  }, [filteredAppointments, timeRange, products]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila' // FORCE PH Display
    }).replace(/,/g, ''); 
  };

  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const filename = `GigglyPaws_Report_Detailed_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;

    if (activeTab === 'SALES') {
       csvContent += "Date,Transaction ID,Item Name,Category,Type,Quantity,Cost,Unit Price (SRP),Line Revenue,Line Profit,Transaction Discount,Transaction Total,Payment Method,Cashier\n";
       filteredTransactions.forEach(t => {
          const tDate = formatDate(t.date);
          t.items.forEach(item => {
             const safeName = item.name.replace(/"/g, '""');
             const type = item.isService ? 'SERVICE' : 'PRODUCT';
             const lineTotal = item.price * item.quantity;
             const cost = item.cost || 0;
             const lineProfit = lineTotal - (cost * item.quantity);
             csvContent += `"${tDate}","${t.id}","${safeName}","${item.category}","${type}",${item.quantity},${cost},${item.price},${lineTotal},${lineProfit},${t.discount},${t.total},"${t.paymentMethod}","${t.cashierId}"\n`;
          });
       });
    } else if (activeTab === 'INVENTORY') {
       csvContent += "Date,Action,Details,User\n";
       inventoryLogs.forEach(l => {
          const lDate = formatDate(l.timestamp);
          const safeDetails = l.details.replace(/"/g, '""');
          csvContent += `"${lDate}","${l.action}","${safeDetails}","${l.userId}"\n`;
       });
    } else if (activeTab === 'GROOMING') {
       csvContent += "Date,Time,Pet,Breed,Color,Owner,Contact,Service Name,Hair Cut,Estimated Price,Groomer,Status\n";
       filteredAppointments.forEach(a => {
           const service = products.find(p => p.id === a.serviceId);
           const serviceName = service ? service.name.replace(/"/g, '""') : 'Unknown Service';
           const price = service ? service.price : 0;
           const safeBreed = (a.petBreed || '').replace(/"/g, '""');
           const safeColor = (a.petColor || '').replace(/"/g, '""');
           const safeHairCut = (a.hairCut || '').replace(/"/g, '""');
           const safeContact = (a.contactNumber || '').replace(/"/g, '""');
           csvContent += `"${a.date}","${a.time}","${a.petName}","${safeBreed}","${safeColor}","${a.ownerName}","${safeContact}","${serviceName}","${safeHairCut}",${price},"${a.groomerId}","${a.status}"\n`;
       });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSummary = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const filename = `GigglyPaws_Consumption_Summary_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`;
    csvContent += "Item Name,Category,Type,Quantity Consumed,Total Revenue,Total Cost,Net Profit\n";
    const allItems = [...itemStats.products, ...itemStats.services];
    allItems.sort((a, b) => b.qty - a.qty);
    allItems.forEach(item => {
       const safeName = item.name.replace(/"/g, '""');
       const profit = item.revenue - item.cost;
       csvContent += `"${safeName}","${item.category}","${item.type}",${item.qty},${item.revenue},${item.cost},${profit}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
  const totalCost = filteredTransactions.reduce((sum, t) => {
      return sum + t.items.reduce((acc, item) => acc + ((item.cost || 0) * item.quantity), 0);
  }, 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-6 text-zinc-900">
       {/* Header & Controls */}
       <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
               <FileText className="w-6 h-6" /> Analytics & Reports
            </h1>
            <p className="text-sm text-gray-500">
               Viewing data for: <span className="font-bold text-purple-900">{timeRange === 'CUSTOM' ? 'Custom Range' : timeRange}</span>
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
             <div className="flex bg-zinc-100 rounded-xl p-1">
                {(['TODAY', 'WEEK', 'MONTH', 'YEAR', 'CUSTOM'] as TimeRange[]).map(r => (
                   <button 
                     key={r} 
                     onClick={() => setTimeRange(r)}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeRange === r ? 'bg-purple-700 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-200'}`}
                   >
                     {r}
                   </button>
                ))}
             </div>
             
             {timeRange === 'CUSTOM' && (
                <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 p-1 rounded-xl">
                   <input type="date" className="bg-transparent text-xs font-bold px-2 outline-none" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                   <span className="text-gray-400">-</span>
                   <input type="date" className="bg-transparent text-xs font-bold px-2 outline-none" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </div>
             )}

             <div className="flex gap-2 ml-2">
                {activeTab === 'SALES' && (
                    <Button size="sm" variant="secondary" onClick={handleExportSummary} title="Export aggregated product quantities">
                        <Download className="w-4 h-4" /> Consumption Report
                    </Button>
                )}
                <Button size="sm" onClick={handleExport} title="Export detailed data rows">
                    <Download className="w-4 h-4" /> {activeTab === 'SALES' ? 'Detailed CSV' : 'Export CSV'}
                </Button>
             </div>
          </div>
       </div>

       {/* Tabs */}
       <div className="flex gap-4 border-b border-zinc-200 pb-1">
          <button onClick={() => setActiveTab('SALES')} className={`pb-3 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'SALES' ? 'border-purple-700 text-purple-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Sales & Profit</button>
          <button onClick={() => setActiveTab('INVENTORY')} className={`pb-3 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'INVENTORY' ? 'border-purple-700 text-purple-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Inventory Movement</button>
          <button onClick={() => setActiveTab('GROOMING')} className={`pb-3 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'GROOMING' ? 'border-purple-700 text-purple-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Grooming</button>
       </div>

       {/* CONTENT: SALES */}
       {activeTab === 'SALES' && (
         <div className="flex-1 overflow-auto space-y-6">
            
            <div className="bg-purple-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                 <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
                     <div>
                         <h3 className="text-zinc-400 font-bold uppercase text-xs tracking-wider mb-2">Financial Breakdown</h3>
                         <div className="flex items-start gap-4 md:gap-6">
                             <div className="flex flex-col">
                                 <span className="text-3xl font-bold text-white">₱{totalRevenue.toLocaleString()}</span>
                                 <span className="text-xs font-mono text-zinc-500 mt-1">Gross Sales</span>
                             </div>
                             <span className="text-zinc-600 text-3xl font-light">-</span>
                             <div className="flex flex-col">
                                 <span className="text-3xl font-bold text-red-400">₱{totalCost.toLocaleString()}</span>
                                 <span className="text-xs font-mono text-zinc-500 mt-1">Cost of Goods</span>
                             </div>
                             <span className="text-zinc-600 text-3xl font-light">=</span>
                             <div className="flex flex-col">
                                 <span className="text-3xl font-bold text-green-400">₱{totalProfit.toLocaleString()}</span>
                                 <span className="text-xs font-mono text-green-500 mt-1">Net Income</span>
                             </div>
                         </div>
                     </div>
                     <div className="bg-purple-800 p-4 rounded-xl min-w-[200px]">
                         <p className="text-xs text-zinc-400 mb-1">Profit Margin</p>
                         <p className="text-2xl font-bold text-white">
                             {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
                         </p>
                     </div>
                 </div>
                 <div className="absolute top-0 right-0 w-64 h-64 bg-purple-800 rounded-full blur-3xl -mr-16 -mt-16 opacity-50"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
                  <p className="text-zinc-500 text-sm font-bold mb-1">Total Transactions</p>
                  <h3 className="text-3xl font-bold text-zinc-900">{filteredTransactions.length}</h3>
               </div>
               <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
                   <p className="text-zinc-500 text-sm font-bold mb-1">Total Cost</p>
                   <h3 className="text-3xl font-bold text-red-600">₱{totalCost.toLocaleString()}</h3>
               </div>
               <div className="bg-white border border-green-200 bg-green-50 p-6 rounded-2xl shadow-sm">
                   <p className="text-green-800 text-sm font-bold mb-1">Net Income</p>
                   <h3 className="text-3xl font-bold text-green-700">₱{totalProfit.toLocaleString()}</h3>
               </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 h-80">
               <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Sales vs Profit</h3>
                   <div className="flex gap-4 text-xs font-bold">
                       <span className="flex items-center gap-1"><div className="w-3 h-3 bg-zinc-300 rounded-sm"></div> Revenue</span>
                       <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Profit</span>
                   </div>
               </div>
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={graphData}>
                     <defs>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                           <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#a1a1aa', fontSize: 12}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#a1a1aa', fontSize: 12}} />
                     <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                     <Area type="monotone" dataKey="sales" stackId="1" stroke="#d4d4d8" fill="#f4f4f5" strokeWidth={2} />
                     <Area type="monotone" dataKey="profit" stackId="2" stroke="#22c55e" fill="url(#colorProfit)" strokeWidth={2} />
                  </AreaChart>
               </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
               <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Bone className="w-5 h-5"/> Top Selling Products</h3>
                  <div className="space-y-3">
                     {itemStats.products.slice(0, 5).map((p, i) => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl">
                           <div className="flex items-center gap-3">
                              <span className="font-bold text-zinc-400 w-4">#{i+1}</span>
                              <div>
                                 <p className="font-bold text-sm text-zinc-900">{p.name}</p>
                                 <p className="text-xs text-zinc-500">{p.qty} sold</p>
                              </div>
                           </div>
                           <span className="font-bold text-sm">₱{p.revenue.toLocaleString()}</span>
                        </div>
                     ))}
                     {itemStats.products.length === 0 && <p className="text-center text-gray-400 text-sm">No sales data.</p>}
                  </div>
               </div>

               <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Scissors className="w-5 h-5"/> Top Services</h3>
                   <div className="space-y-3">
                     {itemStats.services.slice(0, 5).map((p, i) => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl">
                           <div className="flex items-center gap-3">
                              <span className="font-bold text-zinc-400 w-4">#{i+1}</span>
                              <div>
                                 <p className="font-bold text-sm text-zinc-900">{p.name}</p>
                                 <p className="text-xs text-zinc-500">{p.qty} performed</p>
                              </div>
                           </div>
                           <span className="font-bold text-sm">₱{p.revenue.toLocaleString()}</span>
                        </div>
                     ))}
                     {itemStats.services.length === 0 && <p className="text-center text-gray-400 text-sm">No service data.</p>}
                  </div>
               </div>
            </div>
         </div>
       )}

       {/* CONTENT: INVENTORY */}
       {activeTab === 'INVENTORY' && (
          <div className="flex-1 overflow-auto bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 flex flex-col" ref={inventoryContainerRef}>
             <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h3 className="font-bold text-lg">Inventory Logs (Movement)</h3>
                <div className="flex gap-2 w-full md:w-auto items-center">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                            type="text"
                            placeholder="Search logs..."
                            className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-xl text-sm bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-black outline-none transition-all"
                            value={invSearch}
                            onChange={(e) => setInvSearch(e.target.value)}
                        />
                    </div>
                    {/* Row Limit Selector */}
                    <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 h-[42px]">
                        <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Show:</span>
                        <select 
                            className="bg-transparent font-bold text-sm text-zinc-900 outline-none cursor-pointer"
                            value={invLimit}
                            onChange={(e) => setInvLimit(Number(e.target.value))}
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={500}>500</option>
                        </select>
                    </div>
                </div>
             </div>

             <table className="w-full text-left">
                <thead className="bg-zinc-50 sticky top-0 z-10">
                   <tr>
                      <th className="p-3 text-xs font-bold text-gray-500 uppercase">Time</th>
                      <th className="p-3 text-xs font-bold text-gray-500 uppercase">Action</th>
                      <th className="p-3 text-xs font-bold text-gray-500 uppercase">Details</th>
                      <th className="p-3 text-xs font-bold text-gray-500 uppercase">User</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                   {displayedInvLogs.map(log => (
                      <tr key={log.id}>
                         <td className="p-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(log.timestamp)}</td>
                         <td className="p-3"><span className={`text-xs font-bold px-2 py-1 rounded ${log.action === 'INVENTORY' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{log.action}</span></td>
                         <td className="p-3 text-sm text-zinc-900">{log.details}</td>
                         <td className="p-3 text-sm font-bold">{log.userId}</td>
                      </tr>
                   ))}
                   {inventoryLogs.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">No inventory movement matches your filters.</td></tr>}
                </tbody>
             </table>

             {/* Simple Footer Info */}
             <div className="mt-auto pt-4 text-xs text-gray-500 text-center font-medium border-t border-zinc-100">
                Displaying top <span className="font-bold text-zinc-900">{displayedInvLogs.length}</span> of {inventoryLogs.length} records
             </div>
          </div>
       )}

       {/* CONTENT: GROOMING */}
       {activeTab === 'GROOMING' && (
          <div className="flex-1 overflow-auto space-y-6">
             
             <div className="bg-purple-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                 <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
                     <div>
                         <h3 className="text-zinc-400 font-bold uppercase text-xs tracking-wider mb-2">Grooming Financials</h3>
                         <div className="flex items-start gap-4 md:gap-6">
                             <div className="flex flex-col">
                                 <span className="text-3xl font-bold text-white">₱{groomingDetailedStats.totalRevenue.toLocaleString()}</span>
                                 <span className="text-xs font-mono text-zinc-500 mt-1">Gross Sales</span>
                             </div>
                             <span className="text-zinc-600 text-3xl font-light">-</span>
                             <div className="flex flex-col">
                                 <span className="text-3xl font-bold text-red-400">₱{groomingDetailedStats.totalCost.toLocaleString()}</span>
                                 <span className="text-xs font-mono text-zinc-500 mt-1">Service Cost</span>
                             </div>
                             <span className="text-zinc-600 text-3xl font-light">=</span>
                             <div className="flex flex-col">
                                 <span className="text-3xl font-bold text-green-400">₱{groomingDetailedStats.netProfit.toLocaleString()}</span>
                                 <span className="text-xs font-mono text-green-500 mt-1">Net Income</span>
                             </div>
                         </div>
                     </div>
                     <div className="bg-purple-800 p-4 rounded-xl min-w-[200px]">
                         <p className="text-xs text-zinc-400 mb-1">Profit Margin</p>
                         <p className="text-2xl font-bold text-white">
                             {groomingDetailedStats.totalRevenue > 0 
                               ? ((groomingDetailedStats.netProfit / groomingDetailedStats.totalRevenue) * 100).toFixed(1) 
                               : 0}%
                         </p>
                     </div>
                 </div>
                 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-900 rounded-full blur-3xl -mr-16 -mt-16 opacity-30"></div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-green-200 bg-green-50 shadow-sm flex items-center justify-between">
                   <div>
                       <h3 className="text-3xl font-bold text-green-700 mb-1">{groomingDetailedStats.byStatus.COMPLETED}</h3>
                       <p className="text-xs font-bold text-green-800 uppercase">Completed</p>
                   </div>
                   <CheckCircle className="w-8 h-8 text-green-600 opacity-50" />
                </div>
                <div className="bg-white p-6 rounded-2xl border border-blue-200 bg-blue-50 shadow-sm flex items-center justify-between">
                   <div>
                       <h3 className="text-3xl font-bold text-blue-700 mb-1">{groomingDetailedStats.byStatus.SCHEDULED + groomingDetailedStats.byStatus.ONGOING}</h3>
                       <p className="text-xs font-bold text-blue-800 uppercase">Scheduled / Active</p>
                   </div>
                   <Calendar className="w-8 h-8 text-blue-600 opacity-50" />
                </div>
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
                   <div>
                       <h3 className="text-3xl font-bold text-purple-900 mb-1">{groomingDetailedStats.topGroomers.length}</h3>
                       <p className="text-xs font-bold text-gray-400 uppercase">Active Groomers</p>
                   </div>
                   <Scissors className="w-8 h-8 text-zinc-400 opacity-50" />
                </div>
             </div>

             <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 h-80">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Grooming Revenue Trend</h3>
                    <div className="text-xs text-gray-400">Completed appointments only</div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={groomingGraphData}>
                        <defs>
                            <linearGradient id="colorGrooming" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#a1a1aa', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#a1a1aa', fontSize: 12}} />
                        <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} 
                            formatter={(value: number, name: string) => [
                                name === 'revenue' ? `₱${value.toLocaleString()}` : value,
                                name === 'revenue' ? 'Revenue' : 'Appts'
                            ]}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="url(#colorGrooming)" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><User className="w-5 h-5"/> Top Performing Groomers</h3>
                    <div className="space-y-3">
                        {groomingDetailedStats.topGroomers.map((g, i) => (
                            <div key={g.name} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <span className={`font-bold w-4 ${i===0 ? 'text-yellow-500' : 'text-zinc-400'}`}>#{i+1}</span>
                                    <div>
                                        <p className="font-bold text-sm text-zinc-900">{g.name}</p>
                                        <p className="text-xs text-zinc-500">{g.appointments} appointments</p>
                                    </div>
                                </div>
                                <span className="font-bold text-sm text-green-600">₱{g.revenue.toLocaleString()}</span>
                            </div>
                        ))}
                        {groomingDetailedStats.topGroomers.length === 0 && <p className="text-center text-gray-400 text-sm">No data available.</p>}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Scissors className="w-5 h-5"/> Top Requested Services</h3>
                    <div className="space-y-3">
                        {itemStats.services.slice(0, 5).map((p, i) => (
                            <div key={p.id} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-zinc-400 w-4">#{i+1}</span>
                                    <div>
                                        <p className="font-bold text-sm text-zinc-900">{p.name}</p>
                                        <p className="text-xs text-zinc-500">{p.qty} bookings</p>
                                    </div>
                                </div>
                                <span className="font-bold text-sm">₱{p.revenue.toLocaleString()}</span>
                            </div>
                        ))}
                        {itemStats.services.length === 0 && <p className="text-center text-gray-400 text-sm">No service data.</p>}
                    </div>
                </div>
             </div>

             <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
                 <h3 className="font-bold text-lg mb-4">Detailed Appointment Log</h3>
                 <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                            <tr>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">Date/Time</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">Pet / Owner</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">Service</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">Groomer</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase text-right">Est. Price</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {filteredAppointments.map(a => {
                                const service = products.find(p => p.id === a.serviceId);
                                return (
                                    <tr key={a.id} className="hover:bg-zinc-50">
                                        <td className="p-3 text-sm text-gray-600">
                                            <div className="font-bold">{new Date(a.date).toLocaleDateString()}</div>
                                            <div className="text-xs">{a.time}</div>
                                        </td>
                                        <td className="p-3 text-sm">
                                            <div className="font-bold text-zinc-900 flex items-center gap-1">
                                                {a.petName}
                                                {a.petBreed && <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1 rounded border border-zinc-200">{a.petBreed}</span>}
                                            </div>
                                            <div className="text-xs text-gray-500">{a.ownerName} {a.contactNumber && `(${a.contactNumber})`}</div>
                                        </td>
                                        <td className="p-3 text-sm text-zinc-800">
                                            {service?.name || 'Unknown'}
                                            {a.hairCut && <div className="text-[10px] text-gray-400 italic mt-0.5 truncate max-w-[150px]">{a.hairCut}</div>}
                                        </td>
                                        <td className="p-3 text-sm font-bold text-zinc-700">{a.groomerId}</td>
                                        <td className="p-3 text-sm text-right font-mono">₱{service?.price.toLocaleString() || 0}</td>
                                        <td className="p-3 text-right">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                                                a.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                a.status === 'ONGOING' ? 'bg-blue-100 text-blue-700' :
                                                'bg-orange-100 text-orange-700'
                                            }`}>
                                                {a.status}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredAppointments.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No appointments found in this range.</td></tr>
                            )}
                        </tbody>
                     </table>
                 </div>
             </div>
          </div>
       )}
    </div>
  );
};

export default Reports;
