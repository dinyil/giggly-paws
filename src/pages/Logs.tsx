import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { History, Search } from '../components/ui/Icons';

const Logs: React.FC = () => {
  const { logs } = useStore();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Row Limit State instead of Pagination
  const [rowLimit, setRowLimit] = useState(50);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Extract unique action types for the filter dropdown
  const actionTypes = useMemo<string[]>(() => {
    const actions = new Set(logs.map(log => log.action));
    return ['ALL', ...Array.from(actions)] as string[];
  }, [logs]);

  // Filter Logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Search Text (User, Details, ID)
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        log.userId.toLowerCase().includes(searchLower) ||
        log.details.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().includes(searchLower);

      // 2. Action Type
      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

      // 3. Date Range
      let matchesDate = true;
      if (dateRange.start || dateRange.end) {
         const logDate = log.timestamp.split('T')[0];
         if (dateRange.start && logDate < dateRange.start) matchesDate = false;
         if (dateRange.end && logDate > dateRange.end) matchesDate = false;
      }

      return matchesSearch && matchesAction && matchesDate;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, search, actionFilter, dateRange]);

  // Display Logic (Slice based on limit)
  const displayedLogs = useMemo(() => {
      return filteredLogs.slice(0, rowLimit);
  }, [filteredLogs, rowLimit]);

  // Scroll to top on filter change
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  }, [search, actionFilter, dateRange, rowLimit]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col h-[calc(100vh-100px)]">
      <div className="p-6 border-b border-zinc-100 bg-zinc-50">
        <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
          <History className="w-5 h-5" /> System Audit Logs
        </h2>
      </div>

      {/* Control Bar */}
      <div className="p-4 bg-white border-b border-zinc-100 flex flex-col xl:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search details, user, or action..."
            className="w-full pl-10 pr-4 py-2.5 bg-white text-zinc-900 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black placeholder-zinc-400 font-medium transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            {/* Action Filter */}
            <select 
               className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-black"
               value={actionFilter}
               onChange={e => setActionFilter(e.target.value)}
            >
               {actionTypes.map((action) => (
                   <option key={action} value={action}>
                       {action === 'ALL' ? 'All Actions' : action}
                   </option>
               ))}
            </select>

            {/* Date Range */}
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-2">
                <div className="relative">
                    <input 
                        type="date" 
                        className="pl-2 pr-2 py-2.5 bg-transparent text-zinc-900 focus:outline-none font-medium text-sm w-32"
                        value={dateRange.start}
                        onChange={e => setDateRange({...dateRange, start: e.target.value})}
                    />
                </div>
                <span className="text-gray-400 font-bold">-</span>
                 <div className="relative">
                    <input 
                        type="date" 
                        className="pl-2 pr-2 py-2.5 bg-transparent text-zinc-900 focus:outline-none font-medium text-sm w-32"
                        value={dateRange.end}
                        onChange={e => setDateRange({...dateRange, end: e.target.value})}
                    />
                </div>
            </div>

            {/* Row Limit */}
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3">
                <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Show:</span>
                <select 
                    className="bg-transparent font-bold text-sm text-zinc-900 outline-none py-2.5 cursor-pointer"
                    value={rowLimit}
                    onChange={(e) => setRowLimit(Number(e.target.value))}
                >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={500}>500</option>
                </select>
            </div>

             {(dateRange.start || dateRange.end || search || actionFilter !== 'ALL') && (
                <button 
                   onClick={() => {
                       setDateRange({start: '', end: ''});
                       setSearch('');
                       setActionFilter('ALL');
                   }}
                   className="px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                    Clear Filters
                </button>
            )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <table className="w-full text-left">
          <thead className="bg-zinc-50 sticky top-0 z-10">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Timestamp</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">User</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Action</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {displayedLogs.map(log => (
              <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
                <td className="p-4 text-sm text-gray-500 whitespace-nowrap font-mono">
                  {formatDate(log.timestamp)}
                </td>
                <td className="p-4 text-sm font-bold text-zinc-700">{log.userId}</td>
                <td className="p-4 text-sm">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold inline-block min-w-[80px] text-center ${
                      log.action === 'POS' ? 'bg-green-100 text-green-800' :
                      log.action === 'LOGIN' ? 'bg-blue-100 text-blue-800' :
                      log.action === 'LOGOUT' ? 'bg-gray-200 text-gray-600' :
                      log.action === 'INVENTORY' ? 'bg-orange-100 text-orange-800' :
                      log.action === 'SETTINGS' ? 'bg-purple-100 text-purple-800' :
                      log.action === 'GROOMING' ? 'bg-pink-100 text-pink-800' :
                      'bg-zinc-100 text-zinc-800'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="p-4 text-sm text-gray-700">{log.details}</td>
              </tr>
            ))}
             {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="p-12 text-center text-gray-400">
                   <div className="flex flex-col items-center gap-2">
                       <History className="w-10 h-10 opacity-20" />
                       <p>No logs match your current filters.</p>
                   </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer Info Only */}
      <div className="p-4 bg-zinc-50 border-t border-zinc-100 text-xs text-gray-500 text-center font-medium">
         Displaying top <span className="font-bold text-zinc-900">{displayedLogs.length}</span> of {filteredLogs.length} records
      </div>
    </div>
  );
};

export default Logs;