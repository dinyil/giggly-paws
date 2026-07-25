
import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Dog, Upload, CreditCard, Cloud, Trash2, HardDrive, AlertCircle, Database, Bell, MessageSquare, Mail, CheckCircle, ExternalLink, Pencil, Smartphone, Monitor, Tag, Scissors, RotateCcw, History, ArrowRight, Info } from '../components/ui/Icons';
import { useStore } from '../context/StoreContext';
import { supabase } from '../services/supabase';
import Button from '../components/ui/Button';
import { StoreSettings, TemplateHistory } from '../types';
import { generateGroomingEmailHtml } from '../services/notifications';
import { Dialog } from '@headlessui/react';

type ChannelView = 'SMS' | 'EMAIL';
type TemplateCategory = 'GROOMING' | 'PROMO';
type PromoScenario = 'PERCENTAGE' | 'FIXED' | 'MIN_SPEND' | 'ITEM_COUNT';

const Settings: React.FC = () => {
  const { storeSettings, updateStoreSettings, templateHistory, saveTemplateHistory, deleteTemplateHistory } = useStore();
  // formData tracks text fields for the "Edit" mode
  const [formData, setFormData] = useState<StoreSettings>(storeSettings);
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const [isEditingNotify, setIsEditingNotify] = useState(false);
  
  // New State for Channel & Template Toggle
  const [activeChannel, setActiveChannel] = useState<ChannelView>('SMS');
  const [activeTemplateCategory, setActiveTemplateCategory] = useState<TemplateCategory>('GROOMING');
  const [promoPreviewScenario, setPromoPreviewScenario] = useState<PromoScenario>('PERCENTAGE');
  
  // Storage Usage States
  const [dbUsageBytes, setDbUsageBytes] = useState<number>(0);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);
  const [usageError, setUsageError] = useState(false);

  // History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [activeHistoryType, setActiveHistoryType] = useState<'SMS' | 'EMAIL_SUBJECT' | 'EMAIL_BODY' | 'EMAIL_FOOTER'>('SMS');

  // Delete Confirmation State for History
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, id: string | null}>({
    isOpen: false, id: null
  });

  // Refs for file inputs to clear them on remove/change
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const FREE_TIER_LIMIT = 500 * 1024 * 1024; // 500 MB in Bytes

  // Sync formData with storeSettings when not editing
  useEffect(() => {
    if (!isEditingGeneral && !isEditingNotify) {
        setFormData(storeSettings);
    }
  }, [storeSettings, isEditingGeneral, isEditingNotify]);

  // Fetch Database Size on Mount
  useEffect(() => {
    const fetchUsage = async () => {
        setIsCheckingUsage(true);
        // Call the RPC function we asked the user to create
        const { data, error } = await supabase.rpc('get_database_size_bytes');
        
        if (error) {
            console.warn("Storage tracking unavailable. SQL function might be missing.", error);
            setUsageError(true);
        } else {
            setDbUsageBytes(Number(data));
            setUsageError(false);
        }
        setIsCheckingUsage(false);
    };

    fetchUsage();
  }, []);

  const handleSaveGeneral = () => {
    const mergedSettings = {
        ...storeSettings,
        name: formData.name,
        address: formData.address,
        contactNumber: formData.contactNumber,
        vatRate: formData.vatRate,
        hotelVatEnabled: formData.hotelVatEnabled,
        gcashNumber: formData.gcashNumber,
        receiptHeader: formData.receiptHeader,
        receiptFooter: formData.receiptFooter
    };
    updateStoreSettings(mergedSettings);
    setIsEditingGeneral(false);
  };

  const handleSaveNotify = () => {
    // 1. Save Current Inputs to History BEFORE updating (ONLY IF CHANGED)
    
    const hasChanged = (newVal: string | undefined, oldVal: string | undefined) => {
        return (newVal || '').trim() !== (oldVal || '').trim();
    };

    if (activeTemplateCategory === 'GROOMING') {
        if (hasChanged(formData.smsTemplateCompleted, storeSettings.smsTemplateCompleted)) {
             saveTemplateHistory('GROOMING', 'SMS', formData.smsTemplateCompleted || '');
        }
        if (hasChanged(formData.emailSubjectCompleted, storeSettings.emailSubjectCompleted)) {
             saveTemplateHistory('GROOMING', 'EMAIL_SUBJECT', formData.emailSubjectCompleted || '');
        }
        if (hasChanged(formData.emailBodyCompleted, storeSettings.emailBodyCompleted)) {
             saveTemplateHistory('GROOMING', 'EMAIL_BODY', formData.emailBodyCompleted || '');
        }
    } else {
        // PROMO
        if (hasChanged(formData.smsTemplatePromo, storeSettings.smsTemplatePromo)) {
             saveTemplateHistory('PROMO', 'SMS', formData.smsTemplatePromo || '');
        }
        if (hasChanged(formData.emailSubjectPromo, storeSettings.emailSubjectPromo)) {
             saveTemplateHistory('PROMO', 'EMAIL_SUBJECT', formData.emailSubjectPromo || '');
        }
        if (hasChanged(formData.emailBodyPromo, storeSettings.emailBodyPromo)) {
             saveTemplateHistory('PROMO', 'EMAIL_BODY', formData.emailBodyPromo || '');
        }
    }

    if (hasChanged(formData.emailFooterText, storeSettings.emailFooterText)) {
        saveTemplateHistory(activeTemplateCategory, 'EMAIL_FOOTER', formData.emailFooterText || '');
    }

    // 2. Merge and Save to DB
    const mergedSettings = { ...storeSettings, ...formData };
    updateStoreSettings(mergedSettings);
    setIsEditingNotify(false);
  };

  const handleCancelGeneral = () => {
      setFormData(storeSettings); // Revert to current store state
      setIsEditingGeneral(false);
  }

  const handleCancelNotify = () => {
    setFormData(storeSettings);
    setIsEditingNotify(false);
  }

  // --- HISTORY LOGIC ---
  const openHistory = (type: 'SMS' | 'EMAIL_SUBJECT' | 'EMAIL_BODY' | 'EMAIL_FOOTER') => {
      setActiveHistoryType(type);
      setHistoryModalOpen(true);
  };

  const restoreFromHistory = (item: TemplateHistory) => {
      setFormData(prev => {
          const updates = { ...prev };
          if (item.channel === 'EMAIL_FOOTER') {
              updates.emailFooterText = item.content;
          } else if (item.category === 'GROOMING') {
              if (item.channel === 'SMS') updates.smsTemplateCompleted = item.content;
              if (item.channel === 'EMAIL_SUBJECT') updates.emailSubjectCompleted = item.content;
              if (item.channel === 'EMAIL_BODY') updates.emailBodyCompleted = item.content;
          } else {
              // PROMO
              if (item.channel === 'SMS') updates.smsTemplatePromo = item.content;
              if (item.channel === 'EMAIL_SUBJECT') updates.emailSubjectPromo = item.content;
              if (item.channel === 'EMAIL_BODY') updates.emailBodyPromo = item.content;
          }
          return updates;
      });
      setHistoryModalOpen(false);
  };

  const confirmDeleteHistory = () => {
      if (deleteConfirmation.id) {
          deleteTemplateHistory(deleteConfirmation.id);
          setDeleteConfirmation({ isOpen: false, id: null });
      }
  };

  const currentHistoryLogs = templateHistory
      .filter(h => {
          if (activeHistoryType === 'EMAIL_FOOTER') {
              return h.channel === 'EMAIL_FOOTER';
          }
          return h.category === activeTemplateCategory && h.channel === activeHistoryType;
      })
      .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());


  // --- MOCK PREVIEW LOGIC ---
  const getPreviewData = () => {
      const replace = (text: string = "", data: Record<string, string>) => {
          let result = text;
          for (const key in data) {
              result = result.replace(new RegExp(`{${key}}`, 'g'), data[key]);
          }
          return result;
      };

      if (activeTemplateCategory === 'GROOMING') {
          const mockGroomingData = {
              petName: "Buddy",
              ownerName: "John Doe",
              shopName: formData.name || "GigglyPaws",
              date: new Date().toLocaleDateString(),
              time: "10:00 AM",
              serviceName: "Full Groom",
              price: "500"
          };
          const rawSms = formData.smsTemplateCompleted || "";
          const rawEmailSubject = formData.emailSubjectCompleted || "";
          const rawEmailBody = formData.emailBodyCompleted || "";
          const title = "Ready for Pickup";

          return {
              sms: replace(rawSms, mockGroomingData),
              emailSubject: replace(rawEmailSubject, mockGroomingData),
              emailHtml: generateGroomingEmailHtml(formData, replace(rawEmailBody, mockGroomingData), title)
          };
      } else {
          // PROMO PREVIEW - Dynamic Scenarios
          let mockPromoData;
          switch (promoPreviewScenario) {
              case 'FIXED':
                  mockPromoData = {
                      promoName: "Welcome Gift",
                      discountValue: "₱100 OFF",
                      rules: "Valid for first-time customers.",
                      endDate: "No Expiry",
                      shopName: formData.name || "GigglyPaws",
                      address: formData.address || "123 Main St",
                  };
                  break;
              case 'MIN_SPEND':
                  mockPromoData = {
                      promoName: "Big Spender Event",
                      discountValue: "₱500 OFF",
                      rules: "Min. spend of ₱3,000 required.",
                      endDate: "Next Sunday",
                      shopName: formData.name || "GigglyPaws",
                      address: formData.address || "123 Main St",
                  };
                  break;
              case 'ITEM_COUNT':
                  mockPromoData = {
                      promoName: "Treats Bundle",
                      discountValue: "15% OFF",
                      rules: "Buy at least 3 items.",
                      endDate: "While stocks last",
                      shopName: formData.name || "GigglyPaws",
                      address: formData.address || "123 Main St",
                  };
                  break;
              case 'PERCENTAGE':
              default:
                  mockPromoData = {
                      promoName: "Summer Sale",
                      discountValue: "20% OFF",
                      rules: "Valid on all grooming services.",
                      endDate: "Dec 31, 2024",
                      shopName: formData.name || "GigglyPaws",
                      address: formData.address || "123 Main St",
                  };
                  break;
          }

          const rawSms = formData.smsTemplatePromo || "";
          const rawEmailSubject = formData.emailSubjectPromo || "";
          const rawEmailBody = formData.emailBodyPromo || "";
          const title = "Special Promo Alert!";

          return {
              sms: replace(rawSms, mockPromoData),
              emailSubject: replace(rawEmailSubject, mockPromoData),
              emailHtml: generateGroomingEmailHtml(formData, replace(rawEmailBody, mockPromoData), title)
          };
      }
  };

  const previewContent = getPreviewData();

  // Helper to resize images before saving
  const processImage = (file: File, callback: (base64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400; 
            const MAX_HEIGHT = 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png');
            callback(dataUrl);
        };
        img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // IMMEDIATE ACTIONS FOR IMAGES
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file, (base64) => {
        const updated = { ...storeSettings, logo: base64 };
        setFormData(prev => ({ ...prev, logo: base64 })); 
        updateStoreSettings(updated);
        if (logoInputRef.current) logoInputRef.current.value = '';
      });
    }
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file, (base64) => {
        const updated = { ...storeSettings, gcashQr: base64 };
        setFormData(prev => ({ ...prev, gcashQr: base64 })); 
        updateStoreSettings(updated);
        if (qrInputRef.current) qrInputRef.current.value = '';
      });
    }
  };

  const handleRemoveLogo = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const updatedSettings = { ...storeSettings, logo: '' };
      setFormData(prev => ({ ...prev, logo: '' }));
      updateStoreSettings(updatedSettings);
      if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleRemoveQr = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const updatedSettings = { ...storeSettings, gcashQr: '' };
      setFormData(prev => ({ ...prev, gcashQr: '' }));
      updateStoreSettings(updatedSettings);
      if (qrInputRef.current) qrInputRef.current.value = '';
  };

  const inputClass = (enabled: boolean) => `w-full border rounded-xl p-3 mt-1 text-zinc-900 ${enabled ? 'bg-white border-zinc-300 focus:ring-2 focus:ring-black focus:outline-none' : 'bg-zinc-100 border-zinc-200 cursor-not-allowed'}`;

  // Metrics Display Helpers
  const usageMB = (dbUsageBytes / (1024 * 1024)).toFixed(1);
  const usagePercent = Math.min(100, (dbUsageBytes / FREE_TIER_LIMIT) * 100);
  
  let usageColor = 'bg-green-500';
  if (usagePercent > 70) usageColor = 'bg-yellow-500';
  if (usagePercent > 90) usageColor = 'bg-red-500';

  return (
    <div className="space-y-6 pb-10">
      
      {/* Cloud Status Banner */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-green-600" />
              </div>
              <div>
                  <h3 className="font-bold text-zinc-900">Cloud Database Active</h3>
                  <p className="text-xs text-gray-500">Your system is live and synchronizing.</p>
              </div>
          </div>
          
          {/* Storage Meter */}
          <div className="flex flex-col gap-1 w-full md:w-64">
              <div className="flex justify-between items-end text-xs">
                 <span className="font-bold text-gray-500 flex items-center gap-1">
                     <HardDrive className="w-3 h-3" /> Storage Usage
                 </span>
                 {isCheckingUsage ? (
                     <span className="animate-pulse">Checking...</span>
                 ) : usageError ? (
                     <span className="text-red-500 font-bold">Error</span>
                 ) : (
                     <span className="font-bold text-zinc-900">{usageMB} MB / 500 MB</span>
                 )}
              </div>
              
              {usageError ? (
                  <div className="bg-red-50 text-red-600 text-[10px] p-1.5 rounded border border-red-100 flex gap-1 items-center">
                      <AlertCircle className="w-3 h-3" /> SQL function missing in database.
                  </div>
              ) : (
                  <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden border border-zinc-200">
                      <div 
                        className={`h-full ${usageColor} transition-all duration-1000 ease-out`} 
                        style={{ width: `${usagePercent}%` }}
                      />
                  </div>
              )}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: General Info & Notifications */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* General Info */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
                        <SettingsIcon className="w-5 h-5" /> General Information
                    </h2>
                    {!isEditingGeneral ? (
                        <Button onClick={() => setIsEditingGeneral(true)} variant="secondary" size="sm">Edit Info</Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={handleCancelGeneral}>Cancel</Button>
                            <Button size="sm" onClick={handleSaveGeneral}>Save Info</Button>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-gray-700">Store Name</label>
                        <input disabled={!isEditingGeneral} type="text" className={inputClass(isEditingGeneral)} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-700">Address</label>
                        <input disabled={!isEditingGeneral} type="text" className={inputClass(isEditingGeneral)} value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-gray-700">Contact Number</label>
                            <input disabled={!isEditingGeneral} type="text" className={inputClass(isEditingGeneral)} value={formData.contactNumber || ''} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-700">VAT Rate (%)</label>
                            <input disabled={!isEditingGeneral} type="number" className={inputClass(isEditingGeneral)} value={formData.vatRate || ''} onChange={e => setFormData({...formData, vatRate: Number(e.target.value)})} />
                        </div>
                    </div>

                    {/* Hotel VAT Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-2xl border border-purple-100" style={{background: '#FAF7FF'}}>
                        <div>
                            <p className="font-bold text-sm" style={{color: '#4A2D7A'}}>Apply VAT to Hotel Stays</p>
                            <p className="text-xs text-purple-300 mt-0.5">
                                {formData.hotelVatEnabled
                                    ? `Hotel checkout will add ${formData.vatRate || 0}% VAT — e.g. ₱1,500 room → ₱${(1500 * (1 + (formData.vatRate || 0) / 100)).toFixed(0)} total`
                                    : 'Hotel checkout uses room rate as final price — no VAT added'}
                            </p>
                        </div>
                        <button
                            disabled={!isEditingGeneral}
                            onClick={() => setFormData({...formData, hotelVatEnabled: !formData.hotelVatEnabled})}
                            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                                formData.hotelVatEnabled ? 'bg-purple-600' : 'bg-gray-200'
                            }`}
                        >
                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                                formData.hotelVatEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 mt-4">
                        <h3 className="font-bold text-gray-500 uppercase text-xs mb-3">Receipt Customization</h3>
                        <div>
                            <label className="text-sm font-bold text-gray-700">Receipt Header</label>
                            <input disabled={!isEditingGeneral} type="text" className={inputClass(isEditingGeneral)} value={formData.receiptHeader || ''} onChange={e => setFormData({...formData, receiptHeader: e.target.value})} />
                        </div>
                        <div className="mt-2">
                            <label className="text-sm font-bold text-gray-700">Receipt Footer</label>
                            <textarea disabled={!isEditingGeneral} rows={2} className={inputClass(isEditingGeneral)} value={formData.receiptFooter || ''} onChange={e => setFormData({...formData, receiptFooter: e.target.value})} />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 mt-4">
                        <h3 className="font-bold text-gray-500 uppercase text-xs mb-3">GCash Info</h3>
                        <div>
                            <label className="text-sm font-bold text-gray-700">GCash Number (Text)</label>
                            <input disabled={!isEditingGeneral} type="text" className={inputClass(isEditingGeneral)} value={formData.gcashNumber || ''} onChange={e => setFormData({...formData, gcashNumber: e.target.value})} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Settings (API Keys) */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
                        <Bell className="w-5 h-5" /> Notifications Configuration
                    </h2>
                    {!isEditingNotify ? (
                        <Button onClick={() => setIsEditingNotify(true)} variant="secondary" size="sm">Configure Keys</Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={handleCancelNotify}>Cancel</Button>
                            <Button size="sm" onClick={handleSaveNotify}>Save Config</Button>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    {/* SMS Section */}
                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-blue-600" /> TextBee.dev SMS
                            </h3>
                            <label className="inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    disabled={!isEditingNotify}
                                    checked={formData.smsEnabled} 
                                    onChange={e => setFormData({...formData, smsEnabled: e.target.checked})}
                                    className="sr-only peer" 
                                />
                                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                        {formData.smsEnabled && (
                            <div className="space-y-3 animate-fade-in">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">API Key (x-api-key)</label>
                                    <input 
                                        type="password"
                                        disabled={!isEditingNotify} 
                                        className={inputClass(isEditingNotify)} 
                                        value={formData.textBeeApiKey || ''} 
                                        onChange={e => setFormData({...formData, textBeeApiKey: e.target.value})} 
                                        placeholder="Your TextBee API Key"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Device ID</label>
                                    <input 
                                        type="text"
                                        disabled={!isEditingNotify} 
                                        className={inputClass(isEditingNotify)} 
                                        value={formData.textBeeDeviceId || ''} 
                                        onChange={e => setFormData({...formData, textBeeDeviceId: e.target.value})} 
                                        placeholder="Device ID from Dashboard"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Email Section */}
                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                         <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                                <Mail className="w-4 h-4 text-orange-600" /> Email Service
                            </h3>
                            <label className="inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    disabled={!isEditingNotify}
                                    checked={formData.emailEnabled} 
                                    onChange={e => setFormData({...formData, emailEnabled: e.target.checked})}
                                    className="sr-only peer" 
                                />
                                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                            </label>
                        </div>
                        
                        {formData.emailEnabled && (
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Sender Name</label>
                                    <input 
                                        type="text"
                                        disabled={!isEditingNotify} 
                                        className={inputClass(isEditingNotify)} 
                                        value={formData.emailSenderName || ''} 
                                        onChange={e => setFormData({...formData, emailSenderName: e.target.value})} 
                                        placeholder="e.g. GigglyPaws Updates"
                                    />
                                </div>

                                {/* GOOGLE GMAIL DIRECT (Priority) */}
                                <div className="border-t border-zinc-200 pt-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                            <Cloud className="w-4 h-4" /> Google Gmail (Direct)
                                        </h4>
                                        {formData.googleRefreshToken && formData.googleClientId ? (
                                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" /> Configured
                                            </span>
                                        ) : (
                                            <span className="text-[10px] bg-zinc-200 text-zinc-500 px-2 py-1 rounded font-bold">Incomplete</span>
                                        )}
                                    </div>
                                    
                                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-800 mb-3 leading-relaxed flex gap-2">
                                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold">Important:</p>
                                            <p>Use the OAuth Playground to generate a refresh token. Ensure the <strong>Client ID</strong> and <strong>Secret</strong> used in the Playground match exactly what you enter here.</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">Client ID</label>
                                            <input 
                                                type="text"
                                                disabled={!isEditingNotify} 
                                                className={inputClass(isEditingNotify)} 
                                                value={formData.googleClientId || ''} 
                                                onChange={e => setFormData({...formData, googleClientId: e.target.value})} 
                                                onBlur={() => setFormData(prev => ({...prev, googleClientId: prev.googleClientId?.trim()}))}
                                                placeholder="xxx.apps.googleusercontent.com"
                                            />
                                            {/* Validation Warning */}
                                            {formData.googleClientId && !formData.googleClientId.includes('googleusercontent.com') && (
                                                <p className="text-[10px] text-red-500 mt-1 font-bold">⚠️ Warning: Format looks incorrect.</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">Client Secret</label>
                                            <input 
                                                type="password"
                                                disabled={!isEditingNotify} 
                                                className={inputClass(isEditingNotify)} 
                                                value={formData.googleClientSecret || ''} 
                                                onChange={e => setFormData({...formData, googleClientSecret: e.target.value})} 
                                                onBlur={() => setFormData(prev => ({...prev, googleClientSecret: prev.googleClientSecret?.trim()}))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                                Refresh Token
                                                <span className="text-[10px] font-normal text-red-500 normal-case bg-red-50 px-1 rounded">* Crucial</span>
                                            </label>
                                            <input 
                                                type="password"
                                                disabled={!isEditingNotify} 
                                                className={inputClass(isEditingNotify)} 
                                                value={formData.googleRefreshToken || ''} 
                                                onChange={e => setFormData({...formData, googleRefreshToken: e.target.value})} 
                                                onBlur={() => setFormData(prev => ({...prev, googleRefreshToken: prev.googleRefreshToken?.trim()}))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ... Templates Section (Unchanged) ... */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
                            <Pencil className="w-5 h-5" /> Notification Templates
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Customize automated messages.</p>
                    </div>
                    {!isEditingNotify ? (
                        <Button onClick={() => setIsEditingNotify(true)} variant="secondary" size="sm">Edit Templates</Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={handleCancelNotify}>Cancel</Button>
                            <Button size="sm" onClick={handleSaveNotify}>Save Templates</Button>
                        </div>
                    )}
                </div>

                {/* --- TEMPLATE CATEGORY TOGGLE --- */}
                <div className="flex bg-zinc-100 p-1 rounded-xl mb-4">
                    <button 
                        onClick={() => setActiveTemplateCategory('GROOMING')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTemplateCategory === 'GROOMING' ? 'bg-white shadow-sm text-purple-900' : 'text-gray-500 hover:text-purple-900'}`}
                    >
                        <Scissors className="w-4 h-4" /> Grooming Completion
                    </button>
                    <button 
                        onClick={() => setActiveTemplateCategory('PROMO')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTemplateCategory === 'PROMO' ? 'bg-white shadow-sm text-purple-900' : 'text-gray-500 hover:text-purple-900'}`}
                    >
                        <Tag className="w-4 h-4" /> Discount / Promos
                    </button>
                </div>

                {/* --- CHANNEL TOGGLE BUTTONS --- */}
                <div className="flex gap-4 mb-8">
                    <button 
                        onClick={() => setActiveChannel('SMS')}
                        className={`flex-1 py-4 rounded-2xl border-2 font-bold text-sm flex flex-col items-center gap-2 transition-all ${
                            activeChannel === 'SMS' 
                            ? 'border-purple-700 bg-purple-900 text-white shadow-xl scale-105' 
                            : 'border-zinc-100 bg-white text-gray-400 hover:border-zinc-300 hover:text-gray-600'
                        }`}
                    >
                        <MessageSquare className="w-6 h-6" />
                        SMS Configuration
                    </button>
                    <button 
                        onClick={() => setActiveChannel('EMAIL')}
                        className={`flex-1 py-4 rounded-2xl border-2 font-bold text-sm flex flex-col items-center gap-2 transition-all ${
                            activeChannel === 'EMAIL' 
                            ? 'border-orange-500 bg-orange-600 text-white shadow-xl scale-105' 
                            : 'border-zinc-100 bg-white text-gray-400 hover:border-zinc-300 hover:text-gray-600'
                        }`}
                    >
                        <Mail className="w-6 h-6" />
                        Email Configuration
                    </button>
                </div>

                {/* ... (Editor & Preview Section omitted for brevity, keeping same) ... */}
                
                {/* --- EDITOR CONTENT --- */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    
                    {/* LEFT: INPUTS */}
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-xs text-blue-800 leading-relaxed shadow-sm">
                            <strong>Available Variables:</strong> <br/>
                            {activeTemplateCategory === 'GROOMING' ? (
                                <><code>{'{petName}'}</code>, <code>{'{ownerName}'}</code>, <code>{'{shopName}'}</code>, <code>{'{date}'}</code>, <code>{'{time}'}</code>, <code>{'{serviceName}'}</code>, <code>{'{price}'}</code></>
                            ) : (
                                <><code>{'{promoName}'}</code>, <code>{'{discountValue}'}</code>, <code>{'{rules}'}</code>, <code>{'{endDate}'}</code>, <code>{'{shopName}'}</code>, <code>{'{address}'}</code></>
                            )}
                        </div>

                        {activeChannel === 'SMS' ? (
                            <div className="animate-fade-in">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-blue-600" /> SMS Message Body
                                    </label>
                                    {isEditingNotify && (
                                        <button onClick={() => openHistory('SMS')} className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded">
                                            <History className="w-3 h-3" /> History
                                        </button>
                                    )}
                                </div>
                                <textarea 
                                    disabled={!isEditingNotify}
                                    rows={5}
                                    className={inputClass(isEditingNotify)}
                                    value={activeTemplateCategory === 'GROOMING' ? formData.smsTemplateCompleted : formData.smsTemplatePromo}
                                    onChange={e => {
                                        if (activeTemplateCategory === 'GROOMING') setFormData({...formData, smsTemplateCompleted: e.target.value});
                                        else setFormData({...formData, smsTemplatePromo: e.target.value});
                                    }}
                                    placeholder="Enter text message here..."
                                />
                                <p className="text-[10px] text-gray-400 mt-2">
                                    This message will be sent to the owner's mobile number via TextBee.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-orange-600" /> Email Subject Line
                                        </label>
                                        {isEditingNotify && (
                                            <button onClick={() => openHistory('EMAIL_SUBJECT')} className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded">
                                                <History className="w-3 h-3" /> History
                                            </button>
                                        )}
                                    </div>
                                    <input 
                                        type="text"
                                        disabled={!isEditingNotify}
                                        className={inputClass(isEditingNotify)}
                                        value={activeTemplateCategory === 'GROOMING' ? formData.emailSubjectCompleted : formData.emailSubjectPromo}
                                        onChange={e => {
                                            if (activeTemplateCategory === 'GROOMING') setFormData({...formData, emailSubjectCompleted: e.target.value});
                                            else setFormData({...formData, emailSubjectPromo: e.target.value});
                                        }}
                                        placeholder="Subject..."
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                            <Monitor className="w-4 h-4 text-gray-600" /> Email Body Text
                                        </label>
                                        {isEditingNotify && (
                                            <button onClick={() => openHistory('EMAIL_BODY')} className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded">
                                                <History className="w-3 h-3" /> History
                                            </button>
                                        )}
                                    </div>
                                    <textarea 
                                        disabled={!isEditingNotify}
                                        rows={6}
                                        className={inputClass(isEditingNotify)}
                                        value={activeTemplateCategory === 'GROOMING' ? formData.emailBodyCompleted : formData.emailBodyPromo}
                                        onChange={e => {
                                            if (activeTemplateCategory === 'GROOMING') setFormData({...formData, emailBodyCompleted: e.target.value});
                                            else setFormData({...formData, emailBodyPromo: e.target.value});
                                        }}
                                        placeholder="Enter the main paragraph text here..."
                                    />
                                    <p className="text-[10px] text-gray-400 mt-2">
                                        This text is injected into the HTML design shown in the preview.
                                    </p>
                                </div>
                                
                                {/* EMAIL FOOTER SECTION */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                            <Tag className="w-4 h-4 text-gray-600" /> Email Footer Text
                                        </label>
                                        {isEditingNotify && (
                                            <button onClick={() => openHistory('EMAIL_FOOTER')} className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded">
                                                <History className="w-3 h-3" /> History
                                            </button>
                                        )}
                                    </div>
                                    <input 
                                        type="text"
                                        disabled={!isEditingNotify}
                                        className={inputClass(isEditingNotify)}
                                        value={formData.emailFooterText || ''}
                                        onChange={e => setFormData({...formData, emailFooterText: e.target.value})}
                                        placeholder="Thank you for trusting us..."
                                    />
                                    <p className="text-[10px] text-gray-400 mt-2">
                                        Appears at the bottom of the email content.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: LIVE PREVIEW */}
                    <div className="flex flex-col justify-start">
                        {activeTemplateCategory === 'PROMO' && (
                            <div className="mb-4">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Preview Scenario</label>
                                <select 
                                    className="w-full text-sm border border-zinc-200 rounded-lg p-2 bg-zinc-50 outline-none focus:ring-1 focus:ring-black"
                                    value={promoPreviewScenario}
                                    onChange={(e) => setPromoPreviewScenario(e.target.value as PromoScenario)}
                                >
                                    <option value="PERCENTAGE">Percentage Discount (e.g. 20% Off)</option>
                                    <option value="FIXED">Fixed Amount (e.g. ₱100 Off)</option>
                                    <option value="MIN_SPEND">Min Spend Rule (e.g. Spend 3k)</option>
                                    <option value="ITEM_COUNT">Item Count Rule (e.g. Buy 3)</option>
                                </select>
                            </div>
                        )}

                        <p className="text-xs font-bold text-gray-400 uppercase mb-4 text-center">Live Preview ({activeTemplateCategory})</p>
                        
                        {activeChannel === 'SMS' ? (
                            // SMS PREVIEW
                            <div className="bg-zinc-100 rounded-[3rem] p-6 border-8 border-white shadow-2xl max-w-sm mx-auto w-full relative animate-fade-in">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-white rounded-b-2xl"></div>
                                <div className="mt-8 flex flex-col gap-4">
                                    <div className="self-start bg-zinc-200 p-3 rounded-2xl rounded-bl-none max-w-[80%]">
                                        <div className="w-16 h-2 bg-zinc-300 rounded-full animate-pulse"></div>
                                    </div>
                                    <div className="self-end bg-blue-500 text-white p-3 rounded-2xl rounded-br-none shadow-md text-sm leading-snug">
                                        {previewContent.sms}
                                    </div>
                                    <span className="text-[10px] text-gray-400 self-end mr-1">Just now</span>
                                </div>
                                <div className="mt-20 mx-auto w-12 h-1 bg-zinc-300 rounded-full"></div>
                            </div>
                        ) : (
                            // EMAIL PREVIEW
                            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-lg animate-fade-in h-[500px] flex flex-col">
                                <div className="bg-zinc-100 px-3 py-2 flex items-center gap-2 border-b border-zinc-200">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                                    </div>
                                    <div className="flex-1 bg-white rounded-md h-6 flex items-center px-3 text-[10px] text-gray-500 border border-zinc-200 mx-2 truncate">
                                        Subject: {previewContent.emailSubject}
                                    </div>
                                </div>
                                <div className="flex-1 bg-white relative overflow-hidden">
                                    <iframe 
                                        title="Email Preview"
                                        srcDoc={previewContent.emailHtml}
                                        className="w-full h-full border-none"
                                        style={{ transform: 'scale(0.85)', transformOrigin: 'top center', width: '117.6%', height: '117.6%' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>

        {/* Right Column: Branding & Images (Immediate Actions) */}
        <div className="space-y-6">
            {/* Store Logo Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 flex flex-col items-center text-center">
                <h3 className="font-bold text-zinc-900 mb-4">Store Logo</h3>
                <div className="w-32 h-32 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-200 overflow-hidden relative mb-4 shadow-inner">
                    {storeSettings.logo ? (
                        <img src={storeSettings.logo} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                        <Dog className="w-12 h-12 text-gray-300" />
                    )}
                </div>
                <div className="flex flex-col gap-2 w-full">
                    <label className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-700 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-purple-800 transition-colors shadow-lg shadow-zinc-200 select-none">
                        <Upload className="w-4 h-4" /> 
                        {storeSettings.logo ? 'Change Logo' : 'Upload Logo'}
                        <input 
                            ref={logoInputRef}
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleLogoUpload} 
                        />
                    </label>
                    {storeSettings.logo && (
                        <button 
                            type="button"
                            onClick={handleRemoveLogo} 
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors select-none"
                        >
                            <Trash2 className="w-4 h-4" /> Remove
                        </button>
                    )}
                </div>
                <p className="text-xs text-gray-400 mt-2">Visible on receipts and navbar.</p>
            </div>

            {/* GCash QR Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 flex flex-col items-center text-center">
                <h3 className="font-bold text-zinc-900 mb-4">GCash QR Code</h3>
                <div className="w-32 h-32 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 overflow-hidden relative mb-4 shadow-inner">
                    {storeSettings.gcashQr ? (
                        <img src={storeSettings.gcashQr} alt="QR" className="w-full h-full object-contain" />
                    ) : (
                        <CreditCard className="w-12 h-12 text-blue-200" />
                    )}
                </div>
                <div className="flex flex-col gap-2 w-full">
                    <label className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 select-none">
                        <Upload className="w-4 h-4" /> 
                        {storeSettings.gcashQr ? 'Change QR' : 'Upload QR'}
                        <input 
                            ref={qrInputRef}
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleQrUpload} 
                        />
                    </label>
                    {storeSettings.gcashQr && (
                        <button 
                            type="button"
                            onClick={handleRemoveQr} 
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors select-none"
                        >
                            <Trash2 className="w-4 h-4" /> Remove
                        </button>
                    )}
                </div>
                <p className="text-xs text-gray-400 mt-2">Shown during POS checkout.</p>
            </div>
        </div>
      </div>

      {/* History Modal (Same as before) */}
      <Dialog open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <Dialog.Title className="text-xl font-bold mb-4 text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-500" />
                Template History ({activeHistoryType})
            </Dialog.Title>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                {currentHistoryLogs.length === 0 ? (
                    <div className="py-8 text-center text-gray-400">
                        No history found for this template.
                    </div>
                ) : (
                    currentHistoryLogs.map(item => (
                        <div key={item.id} className="bg-zinc-50 rounded-xl p-3 border border-zinc-200 hover:border-zinc-400 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-gray-500 bg-zinc-200 px-2 py-0.5 rounded">
                                    {new Date(item.created_at).toLocaleString()}
                                </span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => restoreFromHistory(item)}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                        <ArrowRight className="w-3 h-3" /> Restore
                                    </button>
                                    <button 
                                        onClick={() => setDeleteConfirmation({ isOpen: true, id: item.id })}
                                        className="text-xs font-bold text-red-400 hover:text-red-600"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-800 font-mono whitespace-pre-wrap leading-relaxed bg-white p-2 rounded border border-zinc-100">
                                {item.content}
                            </p>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-4 pt-2 border-t border-zinc-100">
                <Button variant="ghost" onClick={() => setHistoryModalOpen(false)} className="w-full">Close</Button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal for History */}
      <Dialog open={deleteConfirmation.isOpen} onClose={() => setDeleteConfirmation({isOpen: false, id: null})} className="relative z-[60]">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Delete History Record?</Dialog.Title>
                    <p className="text-sm text-gray-500 mt-2">
                        Are you sure you want to remove this template from history? This action is permanent.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setDeleteConfirmation({isOpen: false, id: null})} className="flex-1">
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDeleteHistory} className="flex-1">
                        Delete
                    </Button>
                </div>
            </Dialog.Panel>
        </div>
      </Dialog>

    </div>
  );
};

export default Settings;
