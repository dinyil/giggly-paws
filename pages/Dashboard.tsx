
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ShoppingBag, Scissors, AlertCircle, Receipt, TrendingUp, DollarSign, Calendar, Eye, EyeOff, CheckCircle, Wallet, BedDouble } from '../components/ui/Icons';
import Button from '../components/ui/Button';

type TimeRange = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';
type ViewMetric = 'REVENUE' | 'PROFIT';

const Dashboard: React.FC = () => {
  const { transactions, appointments, products, hotelRooms, hotelBookings } = useStore();
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Controls
  const [timeRange, setTimeRange] = useState<TimeRange>('WEEK');
  const [viewMetric, setViewMetric] = useState<ViewMetric>('REVENUE');

  // --- 1. Filter Transactions based on Time Range (PH Time) ---
  const filteredTransactions = useMemo(() => {
    // Current PH Date String YYYY-MM-DD
    const nowPhStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const [y, m, d] = nowPhStr.split('-').map(Number);
    const todayPh = new Date(y, m - 1, d); // Midnight PH Time

    return transactions.filter(t => {
      // Transaction Date logic:
      // Convert Transaction ISO String to PH Date String
      const txPhStr = new Date(t.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      
      if (timeRange === 'TODAY') {
        return txPhStr === nowPhStr;
      }
      if (timeRange === 'WEEK') {
        const weekAgo = new Date(todayPh);
        weekAgo.setDate(todayPh.getDate() - 6); // Last 7 days including today
        // Convert txPhStr back to Date object for comparison (safe because both are YYYY-MM-DD)
        const [ty, tm, td] = txPhStr.split('-').map(Number);
        const txDate = new Date(ty, tm - 1, td);
        
        return txDate >= weekAgo && txDate <= todayPh;
      }
      if (timeRange === 'MONTH') {
        // Check Month/Year matching
        const [ty, tm] = txPhStr.split('-').map(Number);
        return tm === m && ty === y;
      }
      if (timeRange === 'YEAR') {
        // Check Year matching
        const [ty] = txPhStr.split('-').map(Number);
        return ty === y;
      }
      return true;
    });
  }, [transactions, timeRange]);

  // --- 2. Calculate Totals for Cards ---
  const totals = useMemo(() => {
    let revenue = 0;
    let cost = 0;

    filteredTransactions.forEach(t => {
        revenue += t.total;
        const txCost = t.items.reduce((acc, item) => acc + ((item.cost || 0) * item.quantity), 0);
        cost += txCost;
    });

    return { revenue, profit: revenue - cost, count: filteredTransactions.length };
  }, [filteredTransactions]);

  // --- 3. Generate Chart Data based on Range ---
  const chartData = useMemo(() => {
    const dataMap: Record<string, { name: string, value: number }> = {};
    const nowPhStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const [y, m] = nowPhStr.split('-').map(Number);

    // Helper to get cost of a transaction
    const getProfit = (t: any) => {
        const cost = t.items.reduce((acc: number, item: any) => acc + ((item.cost || 0) * item.quantity), 0);
        return t.total - cost;
    };

    if (timeRange === 'TODAY') {
        // Hourly buckets (00:00 to 23:00)
        for(let i=8; i<=20; i++) { // Show business hours mostly
            const hour = i < 12 ? `${i}AM` : (i === 12 ? `12PM` : `${i-12}PM`);
            dataMap[i] = { name: hour, value: 0 };
        }
        filteredTransactions.forEach(t => {
            // Get Hour in PH Time
            const dateObj = new Date(t.date);
            const hourStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' });
            const h = parseInt(hourStr, 10);
            
            if (dataMap[h]) {
                dataMap[h].value += viewMetric === 'REVENUE' ? t.total : getProfit(t);
            }
        });
        return Object.values(dataMap);
    }

    if (timeRange === 'WEEK') {
        // Last 7 Days
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        // Reconstruct week array relative to PH Date
        const todayPh = new Date(y, m - 1, parseInt(nowPhStr.split('-')[2]));
        
        for(let i=6; i>=0; i--) {
            const d = new Date(todayPh);
            d.setDate(todayPh.getDate() - i);
            // Format YYYY-MM-DD
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`;
            
            dataMap[key] = { name: days[d.getDay()], value: 0 };
        }
        filteredTransactions.forEach(t => {
            const txPhStr = new Date(t.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
            if (dataMap[txPhStr]) {
                dataMap[txPhStr].value += viewMetric === 'REVENUE' ? t.total : getProfit(t);
            }
        });
        return Object.values(dataMap);
    }

    if (timeRange === 'MONTH') {
        // Days of Month
        const daysInMonth = new Date(y, m, 0).getDate();
        for(let i=1; i<=daysInMonth; i++) {
            dataMap[i] = { name: `${i}`, value: 0 };
        }
        filteredTransactions.forEach(t => {
            const txPhStr = new Date(t.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
            const day = parseInt(txPhStr.split('-')[2], 10);
            if (dataMap[day]) {
                dataMap[day].value += viewMetric === 'REVENUE' ? t.total : getProfit(t);
            }
        });
        return Object.values(dataMap);
    }

    if (timeRange === 'YEAR') {
        // Months
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach((mn, idx) => {
            dataMap[idx] = { name: mn, value: 0 };
        });
        filteredTransactions.forEach(t => {
            const txPhStr = new Date(t.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
            const monthIdx = parseInt(txPhStr.split('-')[1], 10) - 1;
            if (dataMap[monthIdx]) {
                dataMap[monthIdx].value += viewMetric === 'REVENUE' ? t.total : getProfit(t);
            }
        });
        return Object.values(dataMap);
    }

    return [];
  }, [filteredTransactions, timeRange, viewMetric]);

  const lowStock = products.filter(p => !p.isService && p.stock < 10);
  const pendingGrooming = appointments.filter(a => a.status === 'SCHEDULED' || a.status === 'ONGOING').length;
  const hotelOccupied = hotelBookings.filter(b => b.status === 'CHECKED_IN').length;
  const hotelArrivals = hotelBookings.filter(b => b.status === 'RESERVED' && b.check_in === todayStr).length;
  const hotelDepartures = hotelBookings.filter(b => b.status === 'CHECKED_IN' && b.check_out === todayStr).length;
  const hotelVacant = hotelRooms.filter(r => r.is_active).length - hotelOccupied;

  const StatCard = ({ title, value, icon: Icon, color, subValue }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-50 flex items-center justify-between relative overflow-hidden transition-all duration-300 h-32 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex flex-col justify-center">
        <p className="text-purple-400 text-sm font-medium mb-1">{title}</p>
        <p className={`text-3xl font-bold font-black ${color === 'bg-green-600' ? 'text-green-600' : 'text-purple-900'}`} style={{fontFamily: 'Poppins, sans-serif'}}>{value}</p>
        {/* Always render this p tag to maintain height, use invisible to hide if no subValue */}
        <p className={`text-xs font-bold text-purple-300 mt-1 ${!subValue ? 'invisible' : ''}`}>
           {subValue || 'Placeholder'}
        </p>
      </div>
      <div className={`p-4 rounded-xl ${color} z-10 shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in" style={{color: '#2d1b4e'}}>
      
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-3xl border border-purple-50 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Grooming asset decoration */}
            <img src="/Assets/Asset 3.png" alt="" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2" style={{fontFamily: 'Poppins, sans-serif', color: '#4A2D7A'}}>
                  Dashboard Overview
              </h2>
              <p className="text-xs text-purple-300">Select time range to update data</p>
            </div>
          </div>
          
          <div className="flex" style={{background: '#EDE0F7', borderRadius: '12px', padding: '4px'}}>
             {(['TODAY', 'WEEK', 'MONTH', 'YEAR'] as TimeRange[]).map(r => (
                 <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                        timeRange === r ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                    }`}
                    style={timeRange === r ? {color: '#6B4FA0'} : {color: '#9B75C8'}}
                 >
                    {r === 'WEEK' ? '7 DAYS' : r}
                 </button>
             ))}
          </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Dynamic Card: Revenue OR Profit */}
        {viewMetric === 'REVENUE' ? (
            <StatCard 
                title={`${timeRange === 'WEEK' ? '7 Day' : timeRange} Sales`} 
                value={`₱${totals.revenue.toLocaleString()}`} 
                icon={Wallet} 
                color="bg-purple-700" 
            />
        ) : (
            <StatCard 
                title={`${timeRange === 'WEEK' ? '7 Day' : timeRange} Net Profit`} 
                value={`₱${totals.profit.toLocaleString()}`} 
                subValue="Gross Sales - Cost"
                icon={TrendingUp} 
                color="bg-green-600" 
            />
        )}

        <StatCard 
          title="Transactions" 
          value={totals.count} 
          icon={ShoppingBag} 
          color="bg-purple-500" 
          subValue={null}
        />
        <StatCard 
          title="Grooming Queue" 
          value={pendingGrooming} 
          icon={Scissors} 
          color="bg-yellow-400" 
          subValue={null}
        />
        <StatCard 
          title="Low Stock" 
          value={lowStock.length} 
          icon={AlertCircle} 
          color="bg-red-500" 
          subValue={null}
        />
      </div>

      {/* Hotel Stats */}
      {hotelRooms.length > 0 && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-purple-50 relative overflow-hidden">
          {/* Towel decoration */}
          <img src="/Assets/Asset 10.png" alt="" className="absolute right-4 top-3 w-12 opacity-20 pointer-events-none" />
          <h3 className="font-bold flex items-center gap-2 mb-4" style={{color: '#4A2D7A'}}>
            <BedDouble className="w-5 h-5" style={{color: '#7B55A8'}} />
            Pet Hotel — Today
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[{label:'Occupied', val:hotelOccupied, col:'bg-red-500'},{label:"Today's Arrivals", val:hotelArrivals, col:'bg-amber-500'},{label:"Today's Departures", val:hotelDepartures, col:'bg-blue-500'},{label:'Available', val:hotelVacant, col:'bg-green-500'}].map(s=>
              <div key={s.label} className="rounded-xl p-4 border border-purple-50" style={{background: '#FAF7FF'}}>
                <div className={`w-2 h-2 rounded-full ${s.col} mb-2`}/>
                <p className="text-2xl font-black" style={{color: '#4A2D7A', fontFamily: 'Poppins, sans-serif'}}>{s.val}</p>
                <p className="text-xs text-purple-300 font-medium">{s.label}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-purple-50 relative overflow-hidden">
          {/* Asset decoration */}
          <img src="/Assets/Asset 4.png" alt="" className="absolute right-3 top-3 w-10 opacity-10 pointer-events-none" />
          <div className="flex justify-between items-center mb-6">
              <div>
                  <h2 className="text-lg font-bold" style={{color: '#4A2D7A', fontFamily: 'Poppins, sans-serif'}}>
                      {viewMetric === 'REVENUE' ? 'Revenue' : 'Profit'} Trend
                  </h2>
                  <p className="text-xs text-purple-300 font-bold">{timeRange === 'WEEK' ? 'Last 7 Days' : `This ${timeRange}`}</p>
              </div>
              
              {/* Metric Toggle Button */}
              <div className="flex p-1 rounded-xl" style={{background: '#EDE0F7'}}>
                  <button 
                    onClick={() => setViewMetric('REVENUE')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMetric === 'REVENUE' ? 'bg-white shadow' : ''
                    }`}
                    style={viewMetric === 'REVENUE' ? {color: '#6B4FA0'} : {color: '#9B75C8'}}
                  >
                    <Wallet className="w-3 h-3" /> Revenue
                  </button>
                  <button 
                    onClick={() => setViewMetric('PROFIT')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMetric === 'PROFIT' ? 'bg-green-100 text-green-700 shadow-sm' : ''
                    }`}
                    style={viewMetric === 'PROFIT' ? {} : {color: '#9B75C8'}}
                  >
                     <TrendingUp className="w-3 h-3" /> Profit
                  </button>
              </div>
          </div>
          
          <div className="h-64">
             {filteredTransactions.length === 0 ? (
               <div className="flex h-full items-center justify-center text-gray-400 text-sm flex-col gap-2">
                 <Wallet className="w-8 h-8 opacity-20" />
                 No data available for this period
               </div>
             ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    {/* Fixed X/Y Axis width to prevent jitter when numbers change length */}
                    <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#71717a', fontSize: 10}} 
                        interval={0} 
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#71717a', fontSize: 10}} 
                        width={45} 
                    />
                    <Tooltip 
                      cursor={{fill: '#f4f4f5'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#fff', color: '#000' }}
                      formatter={(value: number) => [`₱${value.toLocaleString()}`, viewMetric === 'REVENUE' ? 'Revenue' : 'Profit']}
                    />
                     <Bar 
                         dataKey="value" 
                         fill={viewMetric === 'REVENUE' ? '#7B55A8' : '#16a34a'} 
                         radius={[4, 4, 0, 0]} 
                         barSize={timeRange === 'MONTH' || timeRange === 'YEAR' ? 12 : 30} 
                         animationDuration={500}
                     />
                  </BarChart>
                </ResponsiveContainer>
             )}
          </div>
        </div>

        {/* Low Stock Side Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-50 flex flex-col relative overflow-hidden">
          {/* Asset decoration */}
          <img src="/Assets/Asset 6.png" alt="" className="absolute right-3 top-3 w-10 opacity-15 pointer-events-none" />
          <h2 className="text-lg font-bold mb-4" style={{color: '#4A2D7A', fontFamily: 'Poppins, sans-serif'}}>Low Stock Alerts</h2>
          <div className="space-y-3 flex-1 overflow-auto max-h-[300px] pr-2 custom-scrollbar">
            {lowStock.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                  <CheckCircle className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-sm">All stocks are healthy!</p>
              </div>
            ) : (
              lowStock.slice(0, 10).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                  <div>
                      <span className="font-bold text-zinc-800 text-sm block truncate max-w-[120px]">{item.name}</span>
                      <span className="text-[10px] text-red-400 font-bold uppercase">Reorder Needed</span>
                  </div>
                  <span className="bg-white border border-red-100 text-red-600 px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                    {item.stock} left
                  </span>
                </div>
              ))
            )}
          </div>
          {lowStock.length > 10 && (
              <p className="text-center text-xs text-gray-400 mt-2 font-bold uppercase">+ {lowStock.length - 10} more items</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
