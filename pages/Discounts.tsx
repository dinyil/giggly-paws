
import React, { useState, useMemo } from 'react';
import { Percent, Trash2, Tag, Calendar, Plus, MessageSquare, Search, CheckCircle, Smartphone, Users, Mail, Send, AlertCircle, Check, Clock, ArrowRight } from '../components/ui/Icons';
import { useStore } from '../context/StoreContext';
import { useBroadcast, BroadcastChannel } from '../context/BroadcastContext';
import { Discount, DiscountTrigger, Client } from '../types';
import Button from '../components/ui/Button';
import { Dialog } from '@headlessui/react';

const Discounts: React.FC = () => {
  const { discounts, addDiscount, toggleDiscount, deleteDiscount, products, clients, storeSettings } = useStore();
  const { startBroadcast, isSending } = useBroadcast();
  
  // State for Creating/Editing Discount
  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE'>('LIST');
  const [formData, setFormData] = useState<Partial<Discount>>({
    name: '', type: 'PERCENTAGE', value: 0, 
    triggerType: 'MANUAL', triggerValue: '', 
    isPermanent: true, startDate: '', endDate: ''
  });

  // State for Broadcasting Modal
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [createdDiscount, setCreatedDiscount] = useState<Discount | null>(null);
  
  // New 3-Step Flow: CHOICE -> SELECT_CLIENTS (Optional) -> CONFIGURE
  const [broadcastStep, setBroadcastStep] = useState<'CHOICE' | 'SELECT_CLIENTS' | 'CONFIGURE'>('CHOICE');
  
  // Data for Broadcast
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<BroadcastChannel>('BOTH');
  
  // SMS Safety Settings - DEFAULT TRUE
  const [useSafeMode, setUseSafeMode] = useState(true);

  // Constants
  const MAX_BATCH_SIZE = 30; 

  // Delete Modal State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, id: string | null, name: string}>({
    isOpen: false, id: null, name: ''
  });

  // Filter products for dropdown
  const productOptions = useMemo(() => products.map(p => ({ id: p.id, name: p.name })), [products]);

  // Filter clients for broadcast (Only show those with contact info)
  const availableClients = useMemo(() => {
      return clients.filter(c => c.contactNumber || c.email);
  }, [clients]);

  // Filter for search in "Select Specific" view
  const filteredClientsForSelection = useMemo(() => {
      return availableClients.filter(c => 
          c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
          (c.contactNumber && c.contactNumber.includes(clientSearch))
      );
  }, [availableClients, clientSearch]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.value) return;

    const newDiscount: Discount = {
      id: Date.now().toString(),
      name: formData.name,
      type: formData.type || 'PERCENTAGE',
      value: Number(formData.value),
      active: true,
      triggerType: formData.triggerType || 'MANUAL',
      triggerValue: formData.triggerValue,
      isPermanent: formData.isPermanent ?? true,
      startDate: formData.startDate,
      endDate: formData.endDate
    };

    addDiscount(newDiscount);
    
    // Reset Form
    setFormData({
        name: '', type: 'PERCENTAGE', value: 0, 
        triggerType: 'MANUAL', triggerValue: '', 
        isPermanent: true, startDate: '', endDate: ''
    });
    setActiveTab('LIST');

    // Open Broadcast Modal
    handleBroadcastClick(newDiscount);
  };

  const handleDeleteClick = (discount: Discount) => {
      setDeleteConfirmation({ isOpen: true, id: discount.id, name: discount.name });
  };

  const confirmDelete = () => {
      if (deleteConfirmation.id) {
          deleteDiscount(deleteConfirmation.id);
          setDeleteConfirmation({ isOpen: false, id: null, name: '' });
      }
  };

  // --- BROADCAST LOGIC ---

  const handleBroadcastClick = (discount: Discount) => {
      if (isSending) {
          alert("A broadcast is currently in progress. Please wait for it to finish.");
          return;
      }
      setCreatedDiscount(discount);
      setSelectedClientIds([]); // Reset selection
      setClientSearch('');
      setSelectedChannel('BOTH'); // Default
      setBroadcastStep('CHOICE');
      setBroadcastModalOpen(true);
  };

  // Step 1 Actions
  const handleSelectEveryone = () => {
      // Select All Available
      setSelectedClientIds(availableClients.map(c => c.id));
      setBroadcastStep('CONFIGURE');
  };

  const handleSelectSpecific = () => {
      setSelectedClientIds([]);
      setBroadcastStep('SELECT_CLIENTS');
  };

  // Step 2 Actions
  const handleSelectAllFiltered = () => {
      // If none selected, select up to MAX_BATCH_SIZE filtered items
      if (selectedClientIds.length === 0) {
          const toSelect = filteredClientsForSelection.slice(0, MAX_BATCH_SIZE).map(c => c.id);
          setSelectedClientIds(toSelect);
      } else {
          // Deselect All
          setSelectedClientIds([]);
      }
  };

  const handleToggleClient = (id: string) => {
      if (selectedClientIds.includes(id)) {
          setSelectedClientIds(prev => prev.filter(cid => cid !== id));
      } else {
          // Strict Limit Check
          if (selectedClientIds.length >= MAX_BATCH_SIZE) return;
          setSelectedClientIds(prev => [...prev, id]);
      }
  };

  const handleProceedToConfigure = () => {
      setBroadcastStep('CONFIGURE');
  };

  // Template Replacement Logic
  const replacePromoVariables = (template: string, discount: Discount) => {
      let rules = "";
      if (discount.triggerType === 'MIN_SPEND') rules = `Min spend: ₱${discount.triggerValue}.`;
      else if (discount.triggerType === 'ITEM_COUNT') rules = `Buy ${discount.triggerValue} items.`;
      
      const discountVal = discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₱${discount.value} OFF`;
      
      const endDate = !discount.isPermanent && discount.endDate 
          ? new Date(discount.endDate).toLocaleDateString() 
          : "Limited time only";

      const data: Record<string, string> = {
          promoName: discount.name,
          discountValue: discountVal,
          rules: rules,
          endDate: endDate,
          shopName: storeSettings.name,
          address: storeSettings.address
      };

      let result = template;
      for (const key in data) {
          result = result.replace(new RegExp(`{${key}}`, 'g'), data[key]);
      }
      return result;
  };

  // Final Action
  const initiateBroadcast = () => {
      // Filter the actual client objects based on IDs
      const recipients = availableClients.filter(c => selectedClientIds.includes(c.id));
      
      if (recipients.length === 0 || !createdDiscount) return;

      // Prepare Messages
      const smsMsg = replacePromoVariables(storeSettings.smsTemplatePromo || "Promo: {promoName}", createdDiscount);
      const emailSubject = replacePromoVariables(storeSettings.emailSubjectPromo || "Special Promo", createdDiscount);
      const emailBody = replacePromoVariables(storeSettings.emailBodyPromo || "Check out {promoName}", createdDiscount);

      // Start Global Background Process with Channel Preference
      startBroadcast(recipients, smsMsg, emailSubject, emailBody, useSafeMode, selectedChannel);

      // Close Modal Immediately
      setBroadcastModalOpen(false);
  };

  const inputClass = "w-full border border-zinc-300 rounded-xl p-3 bg-white text-zinc-900 focus:ring-2 focus:ring-black focus:outline-none placeholder-zinc-400 text-sm font-medium";
  const labelClass = "text-xs font-bold text-gray-500 uppercase mb-1 block";

  // Calculate estimated time for display in the modal
  const estMinutes = useMemo(() => {
      const count = selectedClientIds.length;
      if (count <= 1) return 0;
      
      // If Channel is EMAIL ONLY, we assume it's fast regardless of safe mode (BroadcastContext handles this logic too usually, but for ETA display let's mirror it)
      // Actually BroadcastContext logic forces fast delay if safe mode is off OR if SMS wasn't sent.
      // So if channel === 'EMAIL', delay is 5s. If 'SMS'/'BOTH' and SafeMode, delay is 125s.
      
      const isSmsInvolved = selectedChannel === 'SMS' || selectedChannel === 'BOTH';
      const delay = (isSmsInvolved && useSafeMode) ? 125 : 5;
      
      const seconds = (count - 1) * delay;
      return Math.ceil(seconds / 60);
  }, [selectedClientIds.length, useSafeMode, selectedChannel]);

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
       
       {/* Header */}
       <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
                <Percent className="w-6 h-6" /> Discounts & Promos
            </h2>
            <p className="text-sm text-gray-500">Manage sales rules and blast notifications.</p>
          </div>
          <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('LIST')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'LIST' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
              >
                  Active Promos
              </button>
              <button 
                onClick={() => setActiveTab('CREATE')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'CREATE' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'}`}
              >
                  <Plus className="w-4 h-4" /> Create New
              </button>
          </div>
       </div>

       {/* CREATE FORM */}
       {activeTab === 'CREATE' && (
           <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 flex-1 overflow-auto animate-fade-in">
               <form onSubmit={handleCreateSubmit} className="max-w-2xl mx-auto space-y-8">
                   
                   {/* 1. Basic Info */}
                   <div className="space-y-4">
                       <h3 className="font-bold text-lg border-b border-zinc-100 pb-2">1. Promo Details</h3>
                       <div>
                           <label className={labelClass}>Promo Name</label>
                           <input 
                                required
                                type="text" 
                                placeholder="e.g. Summer Sale, Loyal Customer" 
                                className={inputClass}
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                           />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className={labelClass}>Discount Type</label>
                               <select 
                                    className={inputClass}
                                    value={formData.type}
                                    onChange={e => setFormData({...formData, type: e.target.value as 'PERCENTAGE' | 'FIXED'})}
                               >
                                   <option value="PERCENTAGE">Percentage (%)</option>
                                   <option value="FIXED">Fixed Amount (₱)</option>
                               </select>
                           </div>
                           <div>
                               <label className={labelClass}>Value</label>
                               <input 
                                    required
                                    type="number" 
                                    placeholder="e.g. 10 or 50" 
                                    className={inputClass}
                                    value={formData.value || ''}
                                    onChange={e => setFormData({...formData, value: Number(e.target.value)})}
                               />
                           </div>
                       </div>
                   </div>

                   {/* 2. Triggers */}
                   <div className="space-y-4">
                       <h3 className="font-bold text-lg border-b border-zinc-100 pb-2">2. Rules & Triggers</h3>
                       <div>
                           <label className={labelClass}>Trigger Condition</label>
                           <select 
                                className={inputClass}
                                value={formData.triggerType}
                                onChange={e => setFormData({...formData, triggerType: e.target.value as DiscountTrigger, triggerValue: ''})}
                           >
                               <option value="MANUAL">Manual Selection (Always Available)</option>
                               <option value="MIN_SPEND">Minimum Spend Amount</option>
                               <option value="ITEM_COUNT">Minimum Item Quantity</option>
                               <option value="SPECIFIC_PRODUCT">Buying a Specific Product</option>
                           </select>
                       </div>

                       {formData.triggerType !== 'MANUAL' && (
                           <div className="animate-fade-in">
                               <label className={labelClass}>
                                   {formData.triggerType === 'MIN_SPEND' ? 'Minimum Amount (₱)' : 
                                    formData.triggerType === 'ITEM_COUNT' ? 'Minimum Quantity' : 
                                    'Select Product'}
                               </label>
                               
                               {formData.triggerType === 'SPECIFIC_PRODUCT' ? (
                                   <select 
                                        className={inputClass}
                                        value={formData.triggerValue}
                                        onChange={e => setFormData({...formData, triggerValue: e.target.value})}
                                   >
                                       <option value="">-- Choose Product --</option>
                                       {productOptions.map(p => (
                                           <option key={p.id} value={p.id}>{p.name}</option>
                                       ))}
                                   </select>
                               ) : (
                                   <input 
                                        type="number"
                                        className={inputClass}
                                        placeholder={formData.triggerType === 'MIN_SPEND' ? '500' : '3'}
                                        value={formData.triggerValue}
                                        onChange={e => setFormData({...formData, triggerValue: e.target.value})}
                                   />
                               )}
                           </div>
                       )}
                   </div>

                   {/* 3. Duration */}
                   <div className="space-y-4">
                       <h3 className="font-bold text-lg border-b border-zinc-100 pb-2">3. Duration</h3>
                       <div className="flex items-center gap-4">
                           <label className="flex items-center gap-2 cursor-pointer bg-zinc-50 px-4 py-2 rounded-xl border border-zinc-200">
                               <input 
                                    type="radio" 
                                    name="duration" 
                                    checked={formData.isPermanent} 
                                    onChange={() => setFormData({...formData, isPermanent: true})}
                                    className="accent-black w-4 h-4"
                               />
                               <span className="text-sm font-bold">Permanent</span>
                           </label>
                           <label className="flex items-center gap-2 cursor-pointer bg-zinc-50 px-4 py-2 rounded-xl border border-zinc-200">
                               <input 
                                    type="radio" 
                                    name="duration" 
                                    checked={!formData.isPermanent} 
                                    onChange={() => setFormData({...formData, isPermanent: false})}
                                    className="accent-black w-4 h-4"
                               />
                               <span className="text-sm font-bold">Set Date Range</span>
                           </label>
                       </div>

                       {!formData.isPermanent && (
                           <div className="grid grid-cols-2 gap-4 animate-fade-in">
                               <div>
                                   <label className={labelClass}>Start Date</label>
                                   <input 
                                        type="date" 
                                        className={inputClass} 
                                        value={formData.startDate}
                                        onChange={e => setFormData({...formData, startDate: e.target.value})}
                                   />
                               </div>
                               <div>
                                   <label className={labelClass}>End Date</label>
                                   <input 
                                        type="date" 
                                        className={inputClass} 
                                        value={formData.endDate}
                                        onChange={e => setFormData({...formData, endDate: e.target.value})}
                                   />
                               </div>
                           </div>
                       )}
                   </div>

                   <div className="pt-4 flex gap-3">
                       <Button type="button" variant="ghost" className="flex-1" onClick={() => setActiveTab('LIST')}>Cancel</Button>
                       <Button type="submit" className="flex-1 bg-black text-white shadow-lg">Save & Notify</Button>
                   </div>
               </form>
           </div>
       )}

       {/* LIST VIEW */}
       {activeTab === 'LIST' && (
           <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 flex-1 overflow-auto">
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                   {discounts.map(discount => (
                       <div key={discount.id} className="border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                           {/* Status Badge */}
                           <div className="absolute top-4 right-4">
                               <button 
                                    onClick={() => toggleDiscount(discount.id)}
                                    className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${discount.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                               >
                                   {discount.active ? 'Active' : 'Inactive'}
                               </button>
                           </div>

                           <div>
                               <h3 className="font-bold text-lg text-zinc-900 truncate pr-16">{discount.name}</h3>
                               <p className="text-2xl font-bold text-black mt-1">
                                   {discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₱${discount.value} OFF`}
                                </p>
                               
                               <div className="mt-4 space-y-2">
                                   <div className="flex items-center gap-2 text-xs text-gray-500 bg-zinc-50 p-2 rounded-lg">
                                       <Tag className="w-3 h-3" />
                                       <span>
                                           {discount.triggerType === 'MANUAL' && "Manual Apply"}
                                           {discount.triggerType === 'MIN_SPEND' && `Min Spend: ₱${discount.triggerValue}`}
                                           {discount.triggerType === 'ITEM_COUNT' && `Min Items: ${discount.triggerValue}`}
                                           {discount.triggerType === 'SPECIFIC_PRODUCT' && "Specific Product"}
                                       </span>
                                   </div>
                                   <div className="flex items-center gap-2 text-xs text-gray-500 bg-zinc-50 p-2 rounded-lg">
                                       <Calendar className="w-3 h-3" />
                                       <span>
                                           {discount.isPermanent ? "Permanent Validity" : 
                                            `${new Date(discount.startDate!).toLocaleDateString()} - ${new Date(discount.endDate!).toLocaleDateString()}`}
                                       </span>
                                   </div>
                               </div>
                           </div>

                           <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-end">
                               <button 
                                    onClick={() => handleBroadcastClick(discount)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mr-2"
                                    title="Send/Remind"
                               >
                                   <Send className="w-4 h-4" />
                               </button>
                               <button 
                                    onClick={() => handleDeleteClick(discount)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                               >
                                   <Trash2 className="w-4 h-4" />
                                </button>
                           </div>
                       </div>
                   ))}
                   {discounts.length === 0 && (
                       <div className="col-span-full py-20 text-center text-gray-400 flex flex-col items-center justify-center">
                           <Tag className="w-12 h-12 opacity-20 mb-2" />
                           <p>No active promotions.</p>
                       </div>
                   )}
               </div>
           </div>
       )}

       {/* BROADCAST MODAL */}
       <Dialog open={broadcastModalOpen} onClose={() => setBroadcastModalOpen(false)} className="relative z-50">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
                    
                    {/* STEP 1: CHOICE */}
                    {broadcastStep === 'CHOICE' && (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                                <MessageSquare className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold text-zinc-900">Broadcast Promo</h2>
                            <p className="text-gray-500 mt-2 mb-6">
                                <strong>{createdDiscount?.name}</strong> is ready. Who would you like to notify?
                            </p>
                            
                            <div className="space-y-3">
                                {/* Option A: Send to Everyone */}
                                <button 
                                    onClick={handleSelectEveryone}
                                    className="w-full p-4 rounded-2xl border-2 border-zinc-100 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-4 group text-left"
                                >
                                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-zinc-900">Send to Everyone</h3>
                                        <p className="text-xs text-gray-500">Quickly notify all {availableClients.length} clients.</p>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-300 ml-auto group-hover:text-blue-500" />
                                </button>

                                {/* Option B: Select Specific */}
                                <button 
                                    onClick={handleSelectSpecific}
                                    className="w-full p-4 rounded-2xl border-2 border-zinc-100 hover:border-purple-500 hover:bg-purple-50 transition-all flex items-center gap-4 group text-left"
                                >
                                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-zinc-900">Select Specific Clients</h3>
                                        <p className="text-xs text-gray-500">Choose from the list manually.</p>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-300 ml-auto group-hover:text-purple-500" />
                                </button>

                                {/* Option C: Skip */}
                                <button 
                                    onClick={() => setBroadcastModalOpen(false)}
                                    className="w-full p-3 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-zinc-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: SELECT CLIENTS (Optional) */}
                    {broadcastStep === 'SELECT_CLIENTS' && (
                        <div className="flex flex-col h-[500px]">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Smartphone className="w-5 h-5" /> Select Recipients
                            </h2>
                            
                            <div className="mb-4 flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-1 focus:ring-black outline-none bg-white text-zinc-900 placeholder-zinc-400"
                                        placeholder="Search name or number..."
                                        value={clientSearch}
                                        onChange={e => setClientSearch(e.target.value)}
                                    />
                                </div>
                                <Button size="sm" variant="secondary" onClick={handleSelectAllFiltered}>
                                    {selectedClientIds.length > 0 ? 'Deselect All' : `Select Top ${MAX_BATCH_SIZE}`}
                                </Button>
                            </div>

                            {/* Warning Limit Banner */}
                            {selectedClientIds.length >= MAX_BATCH_SIZE ? (
                                <div className="mb-2 bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg border border-red-100 flex items-center gap-2 font-bold">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>Batch Limit Reached ({MAX_BATCH_SIZE}/{MAX_BATCH_SIZE})</span>
                                </div>
                            ) : (
                                <div className="mb-2 bg-purple-50 text-purple-700 text-xs px-3 py-2 rounded-lg border border-purple-100 flex items-center gap-2 font-bold justify-between">
                                    <span>Selected: {selectedClientIds.length}</span>
                                    <span>Max: {MAX_BATCH_SIZE}</span>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto border border-zinc-100 rounded-xl bg-zinc-50 p-2 space-y-1">
                                {filteredClientsForSelection.map(client => {
                                    const isSelected = selectedClientIds.includes(client.id);
                                    // Disable if not selected AND limit reached
                                    const isDisabled = !isSelected && selectedClientIds.length >= MAX_BATCH_SIZE;

                                    return (
                                    <label 
                                        key={client.id} 
                                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                            isDisabled ? 'opacity-50 cursor-not-allowed bg-zinc-100 border-zinc-200' 
                                            : isSelected ? 'bg-purple-50 border-purple-200 cursor-pointer' 
                                            : 'bg-white border-zinc-100 hover:border-purple-300 cursor-pointer'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-purple-600 border-purple-600' : 'bg-white border-gray-300'}`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            className="hidden"
                                            checked={isSelected}
                                            disabled={isDisabled}
                                            onChange={() => handleToggleClient(client.id)}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-zinc-900 truncate">{client.name}</p>
                                            <div className="flex gap-2 text-[10px] text-gray-500 mt-0.5">
                                                {client.contactNumber && <span className="flex items-center gap-1 truncate"><Smartphone className="w-3 h-3 shrink-0"/> {client.contactNumber}</span>}
                                                {client.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0"/> {client.email}</span>}
                                            </div>
                                        </div>
                                    </label>
                                    );
                                })}
                                {filteredClientsForSelection.length === 0 && <p className="text-center text-gray-400 py-4 text-xs">No clients found.</p>}
                            </div>

                            <div className="mt-4 flex gap-3">
                                <Button variant="ghost" onClick={() => setBroadcastStep('CHOICE')} className="flex-1">Back</Button>
                                <Button 
                                    className="flex-1 bg-black hover:bg-zinc-800"
                                    disabled={selectedClientIds.length === 0}
                                    onClick={handleProceedToConfigure}
                                >
                                    Configure Send ({selectedClientIds.length})
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: CONFIGURE */}
                    {broadcastStep === 'CONFIGURE' && (
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold mb-4 text-center">Configure Broadcast</h2>
                            
                            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 mb-6 text-center">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Recipients</p>
                                <p className="text-3xl font-bold text-zinc-900">{selectedClientIds.length}</p>
                                <p className="text-xs text-gray-400 mt-1">Clients selected</p>
                            </div>

                            <p className="text-sm font-bold text-zinc-700 mb-2">Select Channel</p>
                            <div className="grid grid-cols-3 gap-2 mb-6">
                                <button 
                                    onClick={() => setSelectedChannel('SMS')}
                                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                                        selectedChannel === 'SMS' 
                                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                                        : 'border-zinc-100 bg-white text-gray-400 hover:border-zinc-300'
                                    }`}
                                >
                                    <Smartphone className="w-5 h-5" />
                                    <span className="text-xs font-bold">SMS Only</span>
                                </button>
                                <button 
                                    onClick={() => setSelectedChannel('EMAIL')}
                                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                                        selectedChannel === 'EMAIL' 
                                        ? 'border-orange-500 bg-orange-50 text-orange-700' 
                                        : 'border-zinc-100 bg-white text-gray-400 hover:border-zinc-300'
                                    }`}
                                >
                                    <Mail className="w-5 h-5" />
                                    <span className="text-xs font-bold">Email Only</span>
                                </button>
                                <button 
                                    onClick={() => setSelectedChannel('BOTH')}
                                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                                        selectedChannel === 'BOTH' 
                                        ? 'border-black bg-zinc-900 text-white' 
                                        : 'border-zinc-100 bg-white text-gray-400 hover:border-zinc-300'
                                    }`}
                                >
                                    <div className="flex gap-1">
                                        <Smartphone className="w-4 h-4" />
                                        <Mail className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-bold">Both</span>
                                </button>
                            </div>

                            {/* SAFE MODE TOGGLE */}
                            {(selectedChannel === 'SMS' || selectedChannel === 'BOTH') && (
                                <div className="mb-6 bg-yellow-50 p-3 rounded-xl border border-yellow-200 flex items-start gap-3 animate-fade-in">
                                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-sm font-bold text-yellow-900 cursor-pointer select-none" htmlFor="safeMode">
                                                Safe Mode (SMS)
                                            </label>
                                            <input 
                                                id="safeMode"
                                                type="checkbox" 
                                                checked={useSafeMode}
                                                onChange={(e) => setUseSafeMode(e.target.checked)}
                                                className="accent-yellow-600 w-4 h-4"
                                            />
                                        </div>
                                        <p className="text-xs text-yellow-700 leading-tight">
                                            {useSafeMode 
                                                ? "Sends SMS slowly (~2 mins each) to prevent SIM blocking." 
                                                : "WARNING: Fast SMS sending may cause your SIM to be blocked."}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {estMinutes > 0 && (
                                <p className="text-center text-xs font-bold text-gray-400 mb-4 flex items-center justify-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Est. Completion: ~{estMinutes} minutes
                                </p>
                            )}

                            <div className="flex gap-3">
                                <Button variant="ghost" onClick={() => setBroadcastStep('CHOICE')} className="flex-1">Back</Button>
                                <Button 
                                    className="flex-1 bg-green-600 hover:bg-green-700 shadow-green-200 text-white" 
                                    onClick={initiateBroadcast}
                                    disabled={selectedClientIds.length === 0}
                                >
                                    Start Broadcast
                                </Button>
                            </div>
                        </div>
                    )}

                </Dialog.Panel>
            </div>
       </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmation.isOpen} onClose={() => setDeleteConfirmation({...deleteConfirmation, isOpen: false})} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Delete Promo?</Dialog.Title>
                    <p className="text-sm text-gray-500 mt-2">
                        Are you sure you want to delete <span className="font-bold text-zinc-800">"{deleteConfirmation.name}"</span>?
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setDeleteConfirmation({...deleteConfirmation, isOpen: false})} className="flex-1">
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDelete} className="flex-1">
                        Delete
                    </Button>
                </div>
            </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

export default Discounts;