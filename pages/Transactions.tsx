import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { Search, Receipt, Calendar, Printer, X, Settings, Wallet, Plus, Trash2, Edit, Minus, Check, ChevronUp, ChevronDown, Tag } from '../components/ui/Icons';
import Button from '../components/ui/Button';
import { Dialog } from '@headlessui/react';
import ReceiptTemplate from '../components/ReceiptTemplate';
import BluetoothPrintButton from '../components/BluetoothPrintButton';
import EditDiscountModal from '../components/EditDiscountModal';
import { Transaction, CartItem } from '../types';
import { useNavigate } from 'react-router-dom';

const Transactions: React.FC = () => {
  const { transactions, storeSettings, deleteTransaction, updateTransaction, products, discounts, recoverTransactionsFromLogs } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Receipt Modal State
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const paperSize = (storeSettings.receiptPaperSize || '80mm') as '48mm' | '58mm' | '80mm';

  // Delete Modal State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editCart, setEditCart] = useState<CartItem[]>([]);
  const [editPaymentMethod, setEditPaymentMethod] = useState<'CASH' | 'GCASH' | 'SPLIT'>('CASH');
  const [editGcashRef, setEditGcashRef] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSearch, setEditSearch] = useState(''); // Search for adding items
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{ grooming: number; pos: number } | null>(null);

  // Edit Discount Modal State
  const [editDiscountTx, setEditDiscountTx] = useState<Transaction | null>(null);

  const handleRecoverTransactions = async () => {
    setIsRecovering(true);
    const result = await recoverTransactionsFromLogs();
    setIsRecovering(false);
    setRecoveryResult(result);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // 1. Search Filter
      const q = search.toLowerCase();
      const searchMatch = t.id.toLowerCase().includes(q) || 
        t.date.includes(q) ||
        (t.gcashRef && t.gcashRef.toLowerCase().includes(q)) ||
        (t.clientName && t.clientName.toLowerCase().includes(q)) ||
        t.items.some(item => item.name.toLowerCase().includes(q));
      
      if (!searchMatch) return false;

      // 2. Date Range Filter
      const tDate = t.date.split('T')[0]; // ISO String YYYY-MM-DD
      const startMatch = !dateRange.start || tDate >= dateRange.start;
      const endMatch = !dateRange.end || tDate <= dateRange.end;
      
      if (!startMatch || !endMatch) return false;

      // 3. Type Filter
      if (typeFilter === 'PRODUCT') {
         // Show if it contains AT LEAST one product (non-service)
         const hasProduct = t.items.some(item => !item.isService);
         if (!hasProduct) return false;
      }

      if (typeFilter === 'SERVICE') {
         // Show if it contains AT LEAST one service
         const hasService = t.items.some(item => item.isService);
         if (!hasService) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort Descending (Newest First)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [transactions, search, dateRange, typeFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [search, dateRange, typeFilter]);

  const handlePageChange = (newPage: number) => {
      setCurrentPage(newPage);
      if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  // --- ACTIONS ---

  const handleViewReceipt = (transaction: Transaction) => {
      setViewingTransaction(transaction);
      setIsReceiptModalOpen(true);
  };

  const handlePrint = () => {
      // Inject dynamic @page size before printing so the browser uses correct thermal width
      const existingStyle = document.getElementById('thermal-print-style');
      if (existingStyle) existingStyle.remove();
      const style = document.createElement('style');
      style.id = 'thermal-print-style';
      style.textContent = `@media print { @page { size: ${paperSize} auto; margin: 0; } }`;
      document.head.appendChild(style);
      setTimeout(() => {
          window.print();
      }, 300);
  };

  const handleDeleteClick = (id: string) => {
      setDeleteConfirmation({ isOpen: true, id });
  };

  const confirmDelete = () => {
      if (deleteConfirmation.id) {
          deleteTransaction(deleteConfirmation.id);
          setDeleteConfirmation({ isOpen: false, id: null });
      }
  };

  const handleEditClick = (transaction: Transaction) => {
      setEditingTransaction(transaction);
      setEditCart([...transaction.items]);
      setEditPaymentMethod(transaction.paymentMethod);
      setEditGcashRef(transaction.gcashRef || '');
      setEditDate(transaction.date.split('T')[0]); // Only date part for input
      setEditSearch('');
      setIsEditModalOpen(true);
  };

  // --- EDIT MODAL LOGIC ---

  // Add Item to Edit Cart
  const addItemToEdit = (product: any) => {
      setEditCart(prev => {
          const existing = prev.find(item => item.id === product.id);
          if (existing) {
              return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
          }
          return [...prev, { ...product, quantity: 1 }];
      });
      setEditSearch(''); // Clear search after adding
  };

  // Update Item Quantity
  const updateEditQuantity = (id: string, delta: number) => {
      setEditCart(prev => prev.map(item => {
          if (item.id === id) {
              const newQty = item.quantity + delta;
              if (newQty < 1) return item; // Don't remove, just stop at 1. Use trash button to remove.
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const removeEditItem = (id: string) => {
      setEditCart(prev => prev.filter(item => item.id !== id));
  };

  // Calculate Edit Totals
  const calculateEditTotals = () => {
      const subtotal = editCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const vatRate = storeSettings.vatRate / 100;
      // We will reset discount on edit to keep logic simple, or you can implement discount logic here.
      // For now, let's assume discount is removed or kept as a fixed value from original if logic allows.
      // Let's reset discount to 0 to avoid calculation errors with new items.
      const discount = 0; 
      const total = Math.max(0, subtotal - discount);
      const vat = (total / (1 + vatRate)) * vatRate;
      
      return { subtotal, discount, vat, total };
  };

  const saveEdit = () => {
      if (!editingTransaction) return;
      
      const { subtotal, discount, vat, total } = calculateEditTotals();
      
      // Preserve original time, update date part
      const originalTime = editingTransaction.date.split('T')[1];
      const newDateTime = `${editDate}T${originalTime}`;

      const updatedTransaction: Transaction = {
          ...editingTransaction,
          date: newDateTime,
          items: editCart,
          paymentMethod: editPaymentMethod,
          gcashRef: (editPaymentMethod === 'GCASH' || editPaymentMethod === 'SPLIT') ? editGcashRef : undefined,
          subtotal,
          discount,
          vat,
          total
      };

      updateTransaction(editingTransaction, updatedTransaction);
      setIsEditModalOpen(false);
  };

  const filteredProductsForAdd = products.filter(p => p.name.toLowerCase().includes(editSearch.toLowerCase()) && editSearch !== '');

  // Date Formatter
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
    <>
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col h-[calc(100vh-100px)] print:hidden">
      <div className="p-6 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
          <Wallet className="w-5 h-5" /> Transaction History
        </h2>
        <div className="flex items-center gap-2">
          {/* Recover lost transactions from audit logs — hidden for now, keep function intact */}
          <button
            onClick={handleRecoverTransactions}
            disabled={isRecovering}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-all active:scale-95 disabled:opacity-50 opacity-0 pointer-events-none select-none"
            title="Recover transactions that were processed but not saved to database"
          >
            {isRecovering ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : '🔄'}
            {isRecovering ? 'Recovering...' : 'Recover from Logs'}
          </button>
          <Button onClick={() => navigate('/pos')} size="sm">
            <Plus className="w-4 h-4" /> New Transaction
          </Button>
        </div>
      </div>

      {/* Recovery Result Modal */}
      {recoveryResult !== null && (() => {
        const total = recoveryResult.grooming + recoveryResult.pos;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
              <div className="text-5xl mb-4">{total > 0 ? '✅' : 'ℹ️'}</div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">
                {total > 0 ? `Recovered ${total} Transaction${total !== 1 ? 's' : ''}!` : 'Nothing to Recover'}
              </h3>
              {total > 0 ? (
                <div className="text-left bg-zinc-50 rounded-xl p-4 mb-4 space-y-2">
                  {recoveryResult.grooming > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-600 font-bold">✂️ {recoveryResult.grooming}</span>
                      <span className="text-zinc-600">Grooming — full items & receipt recovered</span>
                    </div>
                  )}
                  {recoveryResult.pos > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-amber-600 font-bold">🛒 {recoveryResult.pos}</span>
                      <span className="text-zinc-600">POS sales — total recovered, items not recoverable from logs</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-zinc-500 text-sm mb-4">All transactions are already in the database.</p>
              )}
              <button
                onClick={() => setRecoveryResult(null)}
                className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-700 transition-all"
              >
                OK
              </button>
            </div>
          </div>
        );
      })()}


      <div className="p-4 bg-white border-b border-zinc-100 flex flex-col xl:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search by ID, Date, or Ref..."
            className="w-full pl-10 pr-4 py-2.5 bg-white text-zinc-900 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black placeholder-zinc-400 font-medium transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-col md:flex-row gap-2">
            {/* Type Filter */}
            <select 
               className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-black"
               value={typeFilter}
               onChange={e => setTypeFilter(e.target.value as 'ALL' | 'PRODUCT' | 'SERVICE')}
            >
               <option value="ALL">All Types</option>
               <option value="PRODUCT">Contains Products</option>
               <option value="SERVICE">Contains Services</option>
            </select>

            {/* Date Filter */}
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
            
            {(dateRange.start || dateRange.end || typeFilter !== 'ALL') && (
                <button 
                   onClick={() => { setDateRange({start: '', end: ''}); setTypeFilter('ALL'); }}
                   className="text-xs text-red-500 hover:text-red-700 font-bold px-2 whitespace-nowrap"
                >
                    Clear
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <table className="w-full text-left">
          <thead className="bg-zinc-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Items</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Payment</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {paginatedTransactions.map(t => (
              <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                <td className="p-4 font-mono text-sm font-semibold text-zinc-700">#{t.id.slice(-8)}</td>
                <td className="p-4 text-sm text-zinc-600">{formatDate(t.date)}</td>
                <td className="p-4 text-sm text-zinc-900 max-w-xs truncate">
                  {t.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                </td>
                <td className="p-4 text-sm">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    t.paymentMethod === 'CASH' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : t.paymentMethod === 'SPLIT' 
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {t.paymentMethod === 'CASH' ? 'Cash' : t.paymentMethod === 'SPLIT' ? 'Split' : 'GCash'}
                    {(t.paymentMethod === 'GCASH' || t.paymentMethod === 'SPLIT') && t.gcashRef && <span className="font-normal opacity-75 ml-1">({t.gcashRef})</span>}
                  </span>
                </td>
                <td className="p-4 text-right font-bold text-zinc-900">₱{t.total.toFixed(2)}</td>
                <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                        <button 
                            onClick={() => handleViewReceipt(t)}
                            className="p-2 text-gray-400 hover:text-purple-900 hover:bg-zinc-200 rounded-lg transition-all"
                            title="View Receipt"
                        >
                            <Printer className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleEditClick(t)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Edit"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setEditDiscountTx(t)}
                            className={`p-2 rounded-lg transition-all ${t.discount > 0
                                ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                            title={t.discount > 0 ? `Discount applied: -₱${t.discount.toFixed(2)} — Click to edit` : 'Add Discount'}
                        >
                            <Tag className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleDeleteClick(t.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Wallet className="w-12 h-12 opacity-20" />
                    <p>No transactions found matching your search.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
          <div className="p-4 bg-white border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-xs text-gray-500">
                  Showing <span className="font-bold text-zinc-800">{Math.min(filteredTransactions.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="font-bold text-zinc-800">{Math.min(filteredTransactions.length, currentPage * itemsPerPage)}</span> of {filteredTransactions.length} records
              </div>
              <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <ChevronUp className="w-4 h-4 -rotate-90" />
                  </button>
                  <span className="text-xs font-bold text-zinc-700">Page {currentPage} of {totalPages}</span>
                  <button 
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <ChevronDown className="w-4 h-4 -rotate-90" />
                  </button>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmation.isOpen} onClose={() => setDeleteConfirmation({isOpen: false, id: null})} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Delete Transaction?</Dialog.Title>
                    <p className="text-sm text-gray-500 mt-2">
                        This action will <strong>restore stock</strong> for items in this transaction and permanently remove the record.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setDeleteConfirmation({isOpen: false, id: null})} className="flex-1">
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDelete} className="flex-1">
                        Confirm Delete
                    </Button>
                </div>
            </Dialog.Panel>
        </div>
      </Dialog>

      {/* Edit Transaction Modal (Mini POS) */}
      <Dialog open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <Dialog.Title className="text-xl font-bold mb-4 text-zinc-900 border-b border-zinc-100 pb-2">
                Edit Transaction #{editingTransaction?.id.slice(-8)}
            </Dialog.Title>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {/* 1. Date & Payment */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Date</label>
                        <input 
                            type="date" 
                            className="w-full border border-zinc-200 rounded-xl p-2 text-sm bg-white text-zinc-900" 
                            value={editDate} 
                            onChange={e => setEditDate(e.target.value)} 
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Payment</label>
                        <select 
                            className="w-full border border-zinc-200 rounded-xl p-2 text-sm bg-white text-zinc-900" 
                            value={editPaymentMethod}
                            onChange={e => setEditPaymentMethod(e.target.value as 'CASH' | 'GCASH' | 'SPLIT')}
                        >
                            <option value="CASH">Cash</option>
                            <option value="GCASH">GCash</option>
                            <option value="SPLIT">Split</option>
                        </select>
                    </div>
                </div>
                {(editPaymentMethod === 'GCASH' || editPaymentMethod === 'SPLIT') && (
                    <div className="mb-4 animate-fade-in">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">GCash Reference</label>
                        <input 
                            type="text" 
                            className="w-full border border-zinc-200 rounded-xl p-2 text-sm bg-white text-zinc-900 placeholder-zinc-400" 
                            value={editGcashRef} 
                            onChange={e => setEditGcashRef(e.target.value)} 
                            placeholder="Ref No." 
                        />
                    </div>
                )}

                {/* MOVED UP: 3. Add Item Search */}
                <div className="mb-4 relative z-20">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Add Item</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                            type="text" 
                            className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-black focus:outline-none bg-white text-zinc-900 placeholder-zinc-400"
                            placeholder="Search product to add..."
                            value={editSearch}
                            onChange={e => setEditSearch(e.target.value)}
                        />
                    </div>
                    {/* Suggestions */}
                    {editSearch && filteredProductsForAdd.length > 0 && (
                        <div className="absolute z-30 w-full bg-white border border-zinc-200 rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto">
                            {filteredProductsForAdd.map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => addItemToEdit(p)}
                                    className="w-full text-left p-3 hover:bg-zinc-50 border-b border-zinc-50 last:border-0 flex justify-between items-center"
                                >
                                    <div>
                                        <p className="text-sm font-bold text-zinc-900">{p.name}</p>
                                        <p className="text-xs text-gray-500">Stock: {p.isService ? 'Service' : p.stock}</p>
                                    </div>
                                    <span className="text-xs font-bold bg-zinc-100 px-2 py-1 rounded">₱{p.price}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Items List */}
                <div className="mb-4 relative z-10">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Items ({editCart.length})</label>
                    <div className="space-y-2">
                        {editCart.map(item => (
                            <div key={item.id} className="flex justify-between items-center bg-zinc-50 p-2 rounded-xl border border-zinc-100">
                                <div>
                                    <p className="font-bold text-sm text-zinc-900">{item.name}</p>
                                    <p className="text-xs text-gray-500">₱{item.price}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center bg-white rounded-lg border border-zinc-200">
                                        <button onClick={() => updateEditQuantity(item.id, -1)} className="p-1 hover:bg-zinc-100 rounded-l-lg"><Minus className="w-3 h-3" /></button>
                                        <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                                        <button onClick={() => updateEditQuantity(item.id, 1)} className="p-1 hover:bg-zinc-100 rounded-r-lg"><Plus className="w-3 h-3" /></button>
                                    </div>
                                    <button onClick={() => removeEditItem(item.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Summary */}
            <div className="mt-4 pt-4 border-t border-zinc-100">
                <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-gray-500">Total (Re-calculated)</span>
                    <span className="text-2xl font-bold text-zinc-900">₱{calculateEditTotals().total.toFixed(2)}</span>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setIsEditModalOpen(false)} className="flex-1">Cancel</Button>
                    <Button onClick={saveEdit} className="flex-1">Save Changes</Button>
                </div>
                <p className="text-[10px] text-center text-gray-400 mt-2">
                    Note: Discounts are reset to 0 upon editing to ensure accuracy. Stock levels will update automatically.
                </p>
            </div>

          </Dialog.Panel>
        </div>
      </Dialog>

      {/* View Receipt Modal */}
      <Dialog open={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/80 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-purple-800 rounded-2xl p-4 shadow-2xl relative flex flex-col h-[90vh]">
             
             <div className="flex justify-between items-center mb-4 text-white">
                 <h3 className="font-bold text-lg flex items-center gap-2"><Printer className="w-5 h-5" /> Receipt Preview</h3>
                 <button onClick={() => setIsReceiptModalOpen(false)} className="p-2 hover:bg-zinc-700 rounded-full">
                     <X className="w-5 h-5" />
                 </button>
             </div>

             {/* Paper size info (read-only, configured in Settings) */}
             <div className="bg-zinc-700/50 p-3 rounded-xl mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                    <Settings className="w-4 h-4" />
                    <span className="text-sm font-bold">Paper Size</span>
                </div>
                <span className="text-sm font-bold bg-purple-700 text-white px-3 py-1 rounded-lg">{paperSize}</span>
             </div>

             {/* Preview Area */}
             <div className="flex-1 overflow-auto bg-zinc-700/50 rounded-xl p-6 flex justify-center items-start">
                 <div className="shadow-2xl shadow-black/50 transition-all duration-300">
                     {viewingTransaction && <ReceiptTemplate transaction={viewingTransaction} settings={storeSettings} paperSize={paperSize} isPreview={true} />}
                 </div>
             </div>

             <div className="mt-4 flex gap-3">
                <Button variant="secondary" className="flex-1 bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white" onClick={() => setIsReceiptModalOpen(false)}>
                    Close
                </Button>
                {viewingTransaction && (
                    <BluetoothPrintButton
                        transaction={viewingTransaction}
                        settings={storeSettings}
                        paperSize={paperSize}
                    />
                )}
                <Button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/50" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-2" /> Print Receipt
                </Button>
             </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>

    {/* Hidden Print Layout */}
    {viewingTransaction && (
      <div id="printable-content" className="hidden print:block fixed inset-0 bg-white z-[9999] p-2">
          <ReceiptTemplate transaction={viewingTransaction} settings={storeSettings} paperSize={paperSize} />
      </div>
    )}
    {/* Edit Discount Modal */}
    {editDiscountTx && (
      <EditDiscountModal
        transaction={editDiscountTx}
        settings={storeSettings}
        discounts={discounts}
        adminPin={storeSettings.adminPin || '0828'}
        onSave={(updatedTx) => {
          updateTransaction(editDiscountTx, updatedTx);
          setEditDiscountTx(null);
        }}
        onClose={() => setEditDiscountTx(null)}
      />
    )}
    </>
  );
};

export default Transactions;