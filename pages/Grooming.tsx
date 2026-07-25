
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useBroadcast } from '../context/BroadcastContext'; 
import { GroomingAppointment, Role, Client, Pet, Transaction, Discount } from '../types';
import Button from '../components/ui/Button';
import { Plus, Calendar, Dog, User, Scissors, History, Clock, CheckCircle, ArrowRight, Pencil, Trash2, Smartphone, Scale, Palette, Check, MessageSquare, Mail, ChevronUp, ChevronDown, Search, X, RotateCcw, CreditCard, Printer, Settings, Tag, Percent } from '../components/ui/Icons';
import { Dialog } from '@headlessui/react';
import { getNotificationContent } from '../services/notifications';
import ReceiptTemplate from '../components/ReceiptTemplate';

type GroomingTab = 'UPCOMING' | 'WAITING' | 'ONGOING' | 'COMPLETED';
type TimeRange = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';

// Smart Search Helper: Removes non-alphanumeric chars for loose matching
const normalizeText = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

// Helper to ensure contact number starts with 09...
const sanitizeContactNumber = (num: string) => {
    // Remove non-digits
    let cleaned = num.replace(/[^0-9]/g, ''); 
    
    // Case: 9171234567 (Missing leading 0) -> 0917...
    if (cleaned.length === 10 && cleaned.startsWith('9')) {
        cleaned = '0' + cleaned;
    }
    // Case: 639171234567 (Country code included) -> 0917...
    else if (cleaned.length === 12 && cleaned.startsWith('639')) {
        cleaned = '0' + cleaned.substring(2);
    }
    
    return cleaned;
};

const Grooming: React.FC = () => {
  const { appointments, addAppointment, updateAppointment, deleteAppointment, updateAppointmentStatus, products, users, clients, storeSettings, addLog, checkAndIncrementSms, addTransaction, currentUser, discounts } = useStore();
  const { startBroadcast } = useBroadcast(); // Use the background broadcaster queue
  
  // FIX: Force Philippine Time (Asia/Manila) regardless of system time for filtering
  const getPhTodayStr = () => {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  };
  // Re-calculate 'today' on every render to ensure accuracy if left open overnight
  const today = getPhTodayStr();

  // --- LIVE CLOCK STATE (PHILIPPINE TIME) ---
  const [phTime, setPhTime] = useState(new Date());

  useEffect(() => {
      const timer = setInterval(() => {
          setPhTime(new Date());
      }, 1000);
      return () => clearInterval(timer);
  }, []);

  // Format time for display (Explicitly Asia/Manila)
  const displayTime = phTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true, 
      timeZone: 'Asia/Manila' 
  });
  
  const displayDate = phTime.toLocaleDateString('en-US', {
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Manila' 
  });

  // UI States
  const [activeTab, setActiveTab] = useState<GroomingTab>('WAITING');
  
  // History Filters
  const [historyTimeRange, setHistoryTimeRange] = useState<TimeRange>('TODAY');
  const [historySearch, setHistorySearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Completion Modal State (Notification)
  const [completionModal, setCompletionModal] = useState<{isOpen: boolean, apt: GroomingAppointment | null}>({
      isOpen: false, apt: null
  });

  // PAYMENT MODAL STATE
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentApt, setPaymentApt] = useState<GroomingAppointment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH' | 'SPLIT'>('CASH');
  const [gcashRef, setGcashRef] = useState('');
  const [splitCashAmount, setSplitCashAmount] = useState<string>(''); 
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  
  const cashInputRef = useRef<HTMLInputElement>(null);
  const gcashRefInputRef = useRef<HTMLInputElement>(null);
  const checkoutScrollRef = useRef<HTMLDivElement>(null); // For Auto-Scrolling Modal

  // Printing State
  const [printingTransaction, setPrintingTransaction] = useState<Transaction | null>(null);
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('80mm');
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  
  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, id: string | null, petName: string}>({
    isOpen: false, id: null, petName: ''
  });

  // Autocomplete & Pet Logic States
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPetSuggestions, setShowPetSuggestions] = useState(false);
  
  // Service Autocomplete State
  const [serviceSearch, setServiceSearch] = useState('');
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false);
  
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const petDropdownRef = useRef<HTMLDivElement>(null);
  const serviceDropdownRef = useRef<HTMLDivElement>(null);
  const addonDropdownRef = useRef<HTMLDivElement>(null);

  // Add-Ons State
  const [addonItems, setAddonItems] = useState<string[]>([]); // Array of product/service IDs
  const [addonSearch, setAddonSearch] = useState('');
  const [showAddonSuggestions, setShowAddonSuggestions] = useState(false);
  const [addonFilter, setAddonFilter] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');

  // Form Data
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<GroomingAppointment>>({
    petName: '', petBreed: '', petColor: '', weightSize: '',
    ownerName: '', contactNumber: '', email: '',
    serviceId: '', hairCut: '',
    date: today, time: '', status: 'SCHEDULED', groomerId: ''
  });

  const groomers = users.filter(u => u.role === Role.GROOMER || u.role === 'GROOMER');
  const groomingServices = products.filter(p => p.isService);

  // Auto-scroll logic for payment modal
  useEffect(() => {
      if (isPaymentModalOpen && checkoutScrollRef.current) {
          checkoutScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  }, [paymentMethod, isPaymentModalOpen]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setShowSuggestions(false);
          }
          if (petDropdownRef.current && !petDropdownRef.current.contains(event.target as Node)) {
              setShowPetSuggestions(false);
          }
          if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) {
              setShowServiceSuggestions(false);
          }
          if (addonDropdownRef.current && !addonDropdownRef.current.contains(event.target as Node)) {
              setShowAddonSuggestions(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOwnerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setFormData(prev => ({ ...prev, ownerName: val }));
      
      if (selectedClient && selectedClient.name !== val) {
          setSelectedClient(null);
      }

      if (val.length > 0) {
          const normalizedSearch = normalizeText(val);
          const matches = clients.filter(c => 
              normalizeText(c.name).includes(normalizedSearch) || 
              (c.contactNumber && c.contactNumber.replace(/\D/g,'').includes(normalizedSearch))
          );
          setFilteredClients(matches.slice(0, 5));
          setShowSuggestions(true);
      } else {
          setShowSuggestions(false);
      }
  };

  const selectClient = (client: Client) => {
      setFormData(prev => ({
          ...prev,
          ownerName: client.name,
          contactNumber: client.contactNumber,
          email: client.email || '',
      }));
      setSelectedClient(client);
      setShowSuggestions(false);
  };

  const handlePetNameFocus = () => {
      if (selectedClient && selectedClient.pets && selectedClient.pets.length > 0) {
          setShowPetSuggestions(true);
      }
  };

  const selectPet = (pet: Pet) => {
      setFormData(prev => ({
          ...prev,
          petName: pet.name,
          petBreed: pet.breed || '',
          petColor: pet.color || '',
          weightSize: pet.weightSize || ''
      }));
      setShowPetSuggestions(false);
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  // Helper to check date ranges using Philippine Time
  const isInHistoryRange = (dateStr: string) => {
      // dateStr is YYYY-MM-DD from the database
      const todayStr = getPhTodayStr();
      
      if (historyTimeRange === 'TODAY') {
          return dateStr === todayStr;
      }

      // Convert string dates to compare value
      // Use Manila Time for "Now" to establish boundaries
      const nowPh = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Manila"}));
      const todayDate = new Date(nowPh.getFullYear(), nowPh.getMonth(), nowPh.getDate());
      
      if (historyTimeRange === 'WEEK') {
          const weekAgo = new Date(todayDate);
          weekAgo.setDate(todayDate.getDate() - 7);
          
          const [y, m, d] = dateStr.split('-').map(Number);
          const checkDate = new Date(y, m - 1, d);
          
          return checkDate >= weekAgo && checkDate <= todayDate;
      }
      
      const [year, month] = dateStr.split('-').map(Number);
      const currentYear = nowPh.getFullYear();
      const currentMonth = nowPh.getMonth() + 1;

      if (historyTimeRange === 'MONTH') {
          return year === currentYear && month === currentMonth;
      }
      if (historyTimeRange === 'YEAR') {
          return year === currentYear;
      }
      return false;
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
        if (activeTab === 'UPCOMING') return apt.status === 'SCHEDULED' && apt.date > today;
        // 'WAITING' strictly matches 'today' (PH Time)
        if (activeTab === 'WAITING') return apt.status === 'SCHEDULED' && apt.date === today;
        if (activeTab === 'ONGOING') return apt.status === 'ONGOING';
        
        if (activeTab === 'COMPLETED') {
            if (apt.status !== 'COMPLETED') return false;
            
            // Apply Date Filter
            if (!isInHistoryRange(apt.date)) return false;

            // Apply Search Filter
            if (historySearch) {
                const searchNorm = normalizeText(historySearch);
                const matches = 
                    normalizeText(apt.petName).includes(searchNorm) ||
                    normalizeText(apt.ownerName).includes(searchNorm) ||
                    normalizeText(apt.groomerId || '').includes(searchNorm);
                if (!matches) return false;
            }
            return true;
        }
        return false;
    }).sort((a, b) => {
        // Special Sort for WAITING: Scheduled First, then Walk-ins, both Sequential by Time
        if (activeTab === 'WAITING') {
            const isWalkInA = (a.hairCut || '').includes('Paid at POS');
            const isWalkInB = (b.hairCut || '').includes('Paid at POS');

            // 1. Prioritize Scheduled (Non-Walkin)
            // If A is Walk-in (True) and B is Scheduled (False) -> B comes first (1)
            // If A is Scheduled (False) and B is Walk-in (True) -> A comes first (-1)
            if (isWalkInA !== isWalkInB) {
                return isWalkInA ? 1 : -1;
            }

            // 2. Sequential Time Sort (Earliest First)
            return a.time.localeCompare(b.time);
        }

        // Sort descending date for history, ascending for upcoming
        if (activeTab === 'COMPLETED') {
             if (a.date !== b.date) return b.date.localeCompare(a.date);
             return b.time.localeCompare(a.time);
        }
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
    });
  }, [appointments, activeTab, today, historyTimeRange, historySearch]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const paginatedAppointments = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredAppointments.slice(start, start + itemsPerPage);
  }, [filteredAppointments, currentPage]);

  useEffect(() => {
      setCurrentPage(1);
  }, [activeTab, historyTimeRange, historySearch]);

  const handlePageChange = (newPage: number) => {
      setCurrentPage(newPage);
      if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const openAddModal = () => {
    setEditingId(null);
    setSelectedClient(null);
    setServiceSearch('');
    setAddonItems([]);
    setAddonSearch('');
    // Ensure new manual appointments also default to PH Today
    setFormData({
      petName: '', petBreed: '', petColor: '', weightSize: '',
      ownerName: '', contactNumber: '', email: '',
      serviceId: '', hairCut: '',
      date: getPhTodayStr(), time: '', status: 'SCHEDULED', groomerId: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (apt: GroomingAppointment) => {
    setEditingId(apt.id);
    setFormData({ ...apt });
    const client = clients.find(c => c.name === apt.ownerName);
    if(client) setSelectedClient(client);
    
    // Set service search text
    const service = products.find(p => p.id === apt.serviceId);
    setServiceSearch(service ? service.name : '');
    
    // Load existing add-ons
    setAddonItems(apt.addonIds || []);
    setAddonSearch('');
    
    setIsModalOpen(true);
  };

  // --- REBOOK FUNCTIONALITY ---
  const handleRebook = (apt: GroomingAppointment) => {
    setEditingId(null); // Ensure it's a NEW appointment
    
    // Find Client for state to ensure dropdown logic is ready
    const client = clients.find(c => c.name === apt.ownerName);
    if(client) setSelectedClient(client);

    // Pre-fill form with previous details
    setFormData({
      petName: apt.petName,
      petBreed: apt.petBreed,
      petColor: apt.petColor,
      weightSize: apt.weightSize,
      ownerName: apt.ownerName,
      contactNumber: apt.contactNumber,
      email: apt.email,
      serviceId: apt.serviceId,
      hairCut: apt.hairCut, // Keep styling notes preference
      
      // Reset Schedule for New Booking (PH Time)
      date: getPhTodayStr(), 
      time: '', // Force user to select time
      status: 'SCHEDULED',
      groomerId: apt.groomerId // Keep preferred groomer
    });

    // Update service search input for visual consistency
    const service = products.find(p => p.id === apt.serviceId);
    setServiceSearch(service ? service.name : '');
    
    // Pre-load add-ons from previous appointment
    setAddonItems(apt.addonIds || []);
    setAddonSearch('');
    
    setIsModalOpen(true);
  };

  const handleCancelClick = (id: string, name: string) => {
    setDeleteConfirmation({ isOpen: true, id, petName: name });
  };

  const confirmDelete = () => {
    if (deleteConfirmation.id) {
        deleteAppointment(deleteConfirmation.id);
        setDeleteConfirmation({ isOpen: false, id: null, petName: '' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure contact number is formatted correctly before saving
    const formattedContact = sanitizeContactNumber(formData.contactNumber || '');
    
    const finalFormData = { ...formData, contactNumber: formattedContact };

    if (editingId) {
      const updatedApt: GroomingAppointment = { ...finalFormData as GroomingAppointment, id: editingId, addonIds: addonItems };
      updateAppointment(updatedApt);
    } else {
      const apt: GroomingAppointment = {
        id: Date.now().toString(),
        petName: finalFormData.petName!,
        petBreed: finalFormData.petBreed,
        petColor: finalFormData.petColor,
        weightSize: finalFormData.weightSize,
        ownerName: finalFormData.ownerName!,
        contactNumber: finalFormData.contactNumber,
        email: finalFormData.email,
        serviceId: finalFormData.serviceId!,
        hairCut: finalFormData.hairCut,
        date: finalFormData.date!,
        time: finalFormData.time!,
        status: 'SCHEDULED',
        groomerId: finalFormData.groomerId!,
        addonIds: addonItems
      };
      addAppointment(apt);
    }
    setIsModalOpen(false);
  };

  // --- 1. PROCEED TO PAYMENT (WITH WALK-IN CHECK) ---
  const handleProceedToPayment = (apt: GroomingAppointment) => {
      const isWalkIn = (apt.hairCut || '').includes('Paid at POS');
      
      if (isWalkIn) {
          // SKIP PAYMENT MODAL FOR WALK-INS
          setCompletionModal({ isOpen: true, apt });
      } else {
          // NORMAL RESERVED APPOINTMENT FLOW
          setPaymentApt(apt);
          setPaymentMethod('CASH');
          setSplitCashAmount('');
          setGcashRef('');
          setSelectedDiscount(null); // Reset discount
          setIsPaymentModalOpen(true);
      }
  };

  // --- 2. FINALIZE PAYMENT & CREATE TRANSACTION ---
  const handleFinalizePayment = () => {
      if (!paymentApt) return;

      const service = products.find(p => p.id === paymentApt.serviceId);
      const price = service ? service.price : 0;

      // Build add-on cart items
      const addonCartItems = (paymentApt.addonIds || []).flatMap(id => {
          const p = products.find(prod => prod.id === id);
          if (!p) return [];
          return [{ ...p, quantity: 1, appliedDiscounts: [] as Discount[] }];
      });
      const addonTotal = addonCartItems.reduce((sum, item) => sum + item.price, 0);
      const combinedPrice = price + addonTotal;
      
      // Calculate Discount (applied to combined total)
      let discountAmount = 0;
      if (selectedDiscount) {
          if (selectedDiscount.type === 'PERCENTAGE') {
              discountAmount = combinedPrice * (selectedDiscount.value / 100);
          } else {
              discountAmount = selectedDiscount.value;
          }
      }
      
      const total = Math.max(0, combinedPrice - discountAmount);
      const vatRate = storeSettings.vatRate / 100;
      const vatAmount = (total / (1 + vatRate)) * vatRate;
      const subtotal = total - vatAmount;

      // Validation
      if (paymentMethod === 'GCASH' && !gcashRef) {
          alert('Please enter GCash Reference Number');
          if (gcashRefInputRef.current) gcashRefInputRef.current.focus();
          return;
      }
      if (paymentMethod === 'SPLIT') {
          const cash = Number(splitCashAmount);
          if (isNaN(cash) || cash <= 0) { 
              alert("Please enter a valid Cash amount"); 
              if (cashInputRef.current) cashInputRef.current.focus();
              return; 
          }
          if (cash >= total) { 
              alert("Cash amount covers the total. Please switch to 'CASH' payment method."); 
              return; 
          }
          if (!gcashRef) { 
              alert('Please enter GCash Reference Number for the balance'); 
              if (gcashRefInputRef.current) gcashRefInputRef.current.focus();
              return; 
          }
      }

      // Create Transaction Record (main service + all add-ons)
      const transaction: Transaction = {
          id: Date.now().toString(),
          items: [
              {
                  ...service!,
                  quantity: 1,
                  appliedDiscounts: selectedDiscount ? [selectedDiscount] : []
              },
              ...addonCartItems
          ],
          subtotal,
          vat: vatAmount,
          total,
          discount: discountAmount,
          paymentMethod,
          gcashRef: (paymentMethod === 'GCASH' || paymentMethod === 'SPLIT') ? gcashRef : undefined,
          cashReceived: paymentMethod === 'SPLIT' ? Number(splitCashAmount) : undefined,
          date: new Date().toISOString(),
          cashierId: currentUser?.id || 'unknown'
      };

      addTransaction(transaction);
      
      // Close Payment Modal
      setIsPaymentModalOpen(false);

      // Open Completion Modal (Notification)
      setCompletionModal({ isOpen: true, apt: paymentApt });
  };

  // --- 3. FINALIZE COMPLETION (Notifications) ---
  const processCompletion = (channel: 'SMS' | 'EMAIL' | 'BOTH' | 'NONE') => {
      const apt = completionModal.apt;
      if (!apt) return;

      // Update DB Status
      updateAppointmentStatus(apt.id, 'COMPLETED');

      // If Notification selected, offload to BroadcastContext Queue
      if (channel !== 'NONE') {
          const service = products.find(p => p.id === apt.serviceId);
          const serviceName = service ? service.name : "Grooming Service";
          const price = service ? service.price : 0;
          
          const content = getNotificationContent(storeSettings, 'COMPLETED', apt, serviceName, price);

          const recipient: Client = {
              id: apt.id, 
              name: apt.ownerName,
              contactNumber: apt.contactNumber || '',
              email: apt.email || '',
              pets: [],
              firstSeen: new Date().toISOString()
          };

          startBroadcast(
              [recipient], 
              content.sms, 
              content.emailSubject, 
              content.emailBody, 
              false, // Disable Safe Mode (Fast Send for single)
              channel === 'BOTH' ? 'BOTH' : channel
          );
      }
      
      setCompletionModal({ isOpen: false, apt: null });
  };

  // --- PRINT RECEIPT LOGIC ---
  const handlePrintReceipt = (apt: GroomingAppointment) => {
      // 2. Fallback: Construct a Mock Transaction for Printing
      // This ensures printing ALWAYS works even if the transaction record is missing or hard to find
      const service = products.find(p => p.id === apt.serviceId);
      const price = service ? service.price : 0;
      const vatRate = storeSettings.vatRate / 100;
      const total = price;
      const vat = (total / (1 + vatRate)) * vatRate;
      const subtotal = total - vat;

      const mockTransaction: Transaction = {
          id: `A-${apt.id.slice(-6)}`, // Fake ID for display
          items: [{
              ...service!,
              quantity: 1,
              appliedDiscounts: []
          }],
          subtotal,
          vat,
          total,
          discount: 0,
          paymentMethod: 'CASH', // Default display if unknown
          date: new Date().toISOString(), // Current time for reprint
          cashierId: 'REPRINT'
      };

      setPrintingTransaction(mockTransaction);
      setShowReceiptPreview(true);
  };

  const handleActualPrint = () => {
      setTimeout(() => window.print(), 300); // Allow render then print
  };

  const inputClass = "w-full border border-zinc-300 rounded-xl p-3 mt-1 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder-zinc-400 font-medium text-sm";
  const labelClass = "text-xs font-bold text-gray-500 uppercase";

  const getCount = (tab: GroomingTab) => {
      // Use dynamic 'today' (PH Time) for filtering
      if (tab === 'UPCOMING') return appointments.filter(a => a.status === 'SCHEDULED' && a.date > today).length;
      if (tab === 'WAITING') return appointments.filter(a => a.status === 'SCHEDULED' && a.date === today).length;
      if (tab === 'ONGOING') return appointments.filter(a => a.status === 'ONGOING').length;
      if (tab === 'COMPLETED') {
          if (activeTab === 'COMPLETED') return filteredAppointments.length;
          return appointments.filter(a => a.status === 'COMPLETED' && a.date === today).length;
      }
      return 0;
  };

  // Helper for Payment Modal Display
  const getPaymentServiceDetails = () => {
      if (!paymentApt) return { name: '', price: 0, discount: 0, finalTotal: 0, addonTotal: 0 };
      const s = products.find(p => p.id === paymentApt.serviceId);
      const basePrice = s?.price || 0;

      // Sum up add-ons
      const addonTotal = (paymentApt.addonIds || []).reduce((sum, id) => {
          const product = products.find(p => p.id === id);
          return sum + (product ? product.price : 0);
      }, 0);

      const combinedPrice = basePrice + addonTotal;
      
      let discountValue = 0;
      if (selectedDiscount) {
          discountValue = selectedDiscount.type === 'PERCENTAGE' 
            ? combinedPrice * (selectedDiscount.value / 100) 
            : selectedDiscount.value;
      }
      
      return { 
          name: s?.name || 'Unknown Service', 
          price: basePrice,
          addonTotal,
          discount: discountValue,
          finalTotal: Math.max(0, combinedPrice - discountValue)
      };
  };
  const paymentDetails = getPaymentServiceDetails();

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-6" style={{color: '#2d1b4e'}}>
       
       <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-50 relative overflow-hidden">
         {/* Decorative asset illustrations */}
         <img src="/Assets/Asset 11.png" alt="" className="absolute right-32 top-2 w-12 opacity-15 pointer-events-none rotate-12" />
         <img src="/Assets/Asset 4.png" alt="" className="absolute right-16 top-1 w-12 opacity-15 pointer-events-none -rotate-6" />
         <img src="/Assets/Asset 8.png" alt="" className="absolute right-2 top-1 w-14 opacity-15 pointer-events-none" />
         <img src="/Assets/bathtub.png" alt="" className="absolute right-48 bottom-0 w-24 opacity-10 pointer-events-none" />
         
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
             <div className="flex-1">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold flex items-center gap-2" style={{color: '#4A2D7A', fontFamily: 'Poppins, sans-serif'}}>
                        <Scissors className="w-6 h-6" style={{color: '#7B55A8'}} /> Grooming Salon
                    </h1>
                    {/* LIVE CLOCK DISPLAY - FORCES PH TIME */}
                    <div className="text-white px-3 py-1 rounded-lg text-sm font-mono flex items-center gap-2 shadow-lg" style={{background: 'linear-gradient(135deg, #4A2D7A, #7B55A8)'}}>
                        <Clock className="w-3 h-3" />
                        <span>{displayTime}</span>
                        <span className="text-purple-300">|</span>
                        <span className="text-xs text-purple-200 uppercase font-bold">{displayDate}</span>
                    </div>
                </div>
                <p className="text-purple-300 text-sm mt-1">Manage appointments and workflow</p>
             </div>
             
             <div className="flex gap-2">
                 <Button variant="secondary" onClick={() => window.location.reload()} title="Force Refresh">
                     <RotateCcw className="w-4 h-4" />
                 </Button>
                 <Button onClick={openAddModal}>
                     <Plus className="w-4 h-4" /> Book Appointment
                 </Button>
             </div>
         </div>

         <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
            <div className="flex bg-zinc-100 p-1 rounded-xl w-full xl:w-auto overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('UPCOMING')} className={`flex-1 min-w-[120px] px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'UPCOMING' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}>
                    <Calendar className="w-4 h-4" /> Upcoming <span className="bg-purple-100 text-purple-700 px-1.5 rounded text-xs">{getCount('UPCOMING')}</span>
                </button>
                <button onClick={() => setActiveTab('WAITING')} className={`flex-1 min-w-[120px] px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'WAITING' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>
                    <Clock className="w-4 h-4" /> Waiting <span className="bg-orange-100 text-orange-600 px-1.5 rounded text-xs">{getCount('WAITING')}</span>
                </button>
                <button onClick={() => setActiveTab('ONGOING')} className={`flex-1 min-w-[120px] px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'ONGOING' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
                    <Scissors className="w-4 h-4" /> Ongoing <span className="bg-blue-100 text-blue-600 px-1.5 rounded text-xs">{getCount('ONGOING')}</span>
                </button>
                <button onClick={() => setActiveTab('COMPLETED')} className={`flex-1 min-w-[120px] px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'COMPLETED' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>
                    <CheckCircle className="w-4 h-4" /> Completed <span className="bg-green-100 text-green-600 px-1.5 rounded text-xs">{getCount('COMPLETED')}</span>
                </button>
            </div>

            {/* History Filters - Only show when Completed tab is active */}
            {activeTab === 'COMPLETED' && (
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto animate-fade-in items-center">
                    {/* Search */}
                    <div className="relative w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Search history..." 
                            className="pl-9 pr-4 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-black w-full md:w-48 bg-zinc-50 focus:bg-white transition-colors"
                            value={historySearch}
                            onChange={(e) => setHistorySearch(e.target.value)}
                        />
                    </div>
                    {/* Time Filters */}
                    <div className="flex bg-zinc-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
                        {(['TODAY', 'WEEK', 'MONTH', 'YEAR'] as TimeRange[]).map(range => (
                            <button
                                key={range}
                                onClick={() => setHistoryTimeRange(range)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${historyTimeRange === range ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
            )}
         </div>
       </div>

       <div className="flex-1 overflow-auto" ref={scrollRef}>
           {paginatedAppointments.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-white rounded-3xl border border-dashed border-zinc-200">
                   <Dog className="w-16 h-16 mb-4 opacity-20" />
                   <p className="font-medium">No appointments found.</p>
                   {activeTab === 'COMPLETED' && <p className="text-xs mt-1">Try adjusting the time filter.</p>}
                   {activeTab === 'WAITING' && <p className="text-xs mt-1">Showing waiting list for: {today}</p>}
               </div>
           ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                   {paginatedAppointments.map(apt => {
                       const serviceName = groomingServices.find(s => s.id === apt.serviceId)?.name || 'Unknown Service';
                       const isWalkIn = (apt.hairCut || '').includes('Paid at POS');
                       
                       return (
                           <div key={apt.id} className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-100 flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
                               <div className="flex justify-between items-start mb-3 relative z-10">
                                   <div className={`text-xs font-bold px-3 py-1 rounded-full border ${apt.date === today ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-900 border-zinc-200'}`}>
                                       {apt.date === today ? 'TODAY' : new Date(apt.date).toLocaleDateString()} • {formatTime(apt.time)}
                                   </div>
                                   <div className="flex items-center gap-2">
                                     {(apt.status === 'SCHEDULED' || apt.status === 'COMPLETED') && (
                                       <div className="flex items-center bg-zinc-50 rounded-lg p-0.5 border border-zinc-100">
                                          <button onClick={() => openEditModal(apt)} className="p-1.5 text-gray-500 hover:text-black hover:bg-white rounded-md transition-all" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                          <div className="w-px h-3 bg-gray-200 mx-0.5"></div>
                                          <button onClick={() => handleCancelClick(apt.id, apt.petName)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded-md transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                       </div>
                                     )}
                                     <span className={`text-xs font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${apt.status === 'SCHEDULED' ? 'bg-orange-100 text-orange-600' : apt.status === 'ONGOING' ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>{apt.status}</span>
                                   </div>
                               </div>
                               <div className="mb-4 relative z-10">
                                   <div className="flex items-center gap-2">
                                       <h3 className="text-xl font-bold text-zinc-900 leading-tight">{apt.petName}</h3>
                                       {isWalkIn && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase">Walk-in</span>}
                                   </div>
                                   {apt.petBreed && <span className="text-sm font-normal text-gray-500 bg-zinc-50 px-2 py-0.5 rounded-md border border-zinc-100 inline-block mt-1">{apt.petBreed}</span>}
                                   
                                   <p className="text-sm text-gray-500 flex items-center gap-1 font-medium mt-1"><User className="w-3 h-3"/> {apt.ownerName} {apt.contactNumber && <span className="text-gray-400">({apt.contactNumber})</span>}</p>
                                   {apt.hairCut && <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 p-2 rounded-lg border border-yellow-100 italic"><span className="font-bold not-italic">✄ Style:</span> {apt.hairCut}</div>}
                               </div>
                               <div className="space-y-2 mb-6 relative z-10">
                                    <div className="flex justify-between items-center text-sm border-t border-zinc-100 pt-3"><span className="text-gray-400">Service</span><span className="font-bold text-zinc-800 text-right max-w-[60%] truncate">{serviceName}</span></div>
                                    <div className="flex justify-between items-center text-sm"><span className="text-gray-400">Groomer</span><span className="font-bold text-zinc-800">{apt.groomerId}</span></div>
                               </div>
                               <div className="mt-auto relative z-10">
                                   {apt.status === 'SCHEDULED' && (
                                       apt.date === today ? (
                                           <button 
                                                className="w-full bg-black text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-200" 
                                                onClick={() => updateAppointmentStatus(apt.id, 'ONGOING')}
                                            >
                                                Start Session <ArrowRight className="w-4 h-4" />
                                            </button>
                                       ) : <div className="w-full text-center py-2 text-sm text-gray-400 font-medium bg-zinc-50 rounded-xl border border-zinc-100">Scheduled</div>
                                   )}
                                   {apt.status === 'ONGOING' && (
                                       <button 
                                            className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-100" 
                                            onClick={() => handleProceedToPayment(apt)}
                                       >
                                           Complete Grooming
                                       </button>
                                   )}
                                   {apt.status === 'COMPLETED' && (
                                       <div className="flex gap-2">
                                           <div className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-green-700 font-bold bg-green-50 rounded-xl border border-green-100">
                                               <CheckCircle className="w-4 h-4" /> Finished
                                           </div>
                                           <Button 
                                               variant="secondary" 
                                               className="w-auto px-3 bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-600"
                                               title="Reprint Receipt"
                                               onClick={() => handlePrintReceipt(apt)}
                                           >
                                               <Printer className="w-4 h-4" />
                                           </Button>
                                           <Button 
                                               variant="secondary" 
                                               className="w-auto px-3 bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-600"
                                               title="Rebook Same Service"
                                               onClick={() => handleRebook(apt)}
                                           >
                                               <RotateCcw className="w-4 h-4" />
                                           </Button>
                                       </div>
                                   )}
                               </div>
                           </div>
                       );
                   })}
               </div>
           )}
       </div>

       {/* Pagination Footer */}
       {totalPages > 1 && (
          <div className="p-4 bg-white border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-xs text-gray-500">
                  Showing <span className="font-bold text-zinc-800">{Math.min(filteredAppointments.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="font-bold text-zinc-800">{Math.min(filteredAppointments.length, currentPage * itemsPerPage)}</span> of {filteredAppointments.length} records
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

       {/* --- PAYMENT MODAL (WITH DISCOUNT) --- */}
       <Dialog open={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} className="relative z-[60]">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-white rounded-3xl shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
            
            {/* Header Section */}
            <div className="p-6 pb-4 border-b border-zinc-100 flex-shrink-0">
                <h2 className="text-xl font-bold text-zinc-900 mb-4">Grooming Payment</h2>
                
                {/* Order Summary Section */}
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                    <div className="space-y-1 text-sm text-zinc-600 mb-2 border-b border-zinc-200 pb-2">
                        <div className="flex justify-between font-medium">
                            <span>{paymentDetails.name}</span>
                            <span>₱{paymentDetails.price.toFixed(2)}</span>
                        </div>
                        {/* Add-on line items */}
                        {(paymentApt?.addonIds || []).map(id => {
                            const product = products.find(p => p.id === id);
                            if (!product) return null;
                            return (
                                <div key={id} className="flex justify-between text-zinc-500">
                                    <span className="flex items-center gap-1 pl-2">
                                        <Plus className="w-2.5 h-2.5 text-zinc-400 flex-shrink-0" />{product.name}
                                    </span>
                                    <span>₱{product.price.toFixed(2)}</span>
                                </div>
                            );
                        })}
                        {selectedDiscount && (
                            <div className="flex justify-between text-green-600 font-bold">
                                <span className="flex items-center gap-1"><Tag className="w-3 h-3"/> {selectedDiscount.name}</span>
                                <span>-₱{paymentDetails.discount.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <span className="font-bold text-lg text-zinc-900 uppercase tracking-tight">TOTAL TO PAY</span>
                        <span className="font-bold text-2xl text-zinc-900">₱{paymentDetails.finalTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div ref={checkoutScrollRef} className="flex-1 overflow-y-auto p-6 pt-0 custom-scrollbar">
                
                {/* DISCOUNT SELECTION */}
                <p className="text-gray-500 text-xs font-bold mb-3 mt-4 uppercase tracking-widest">Apply Promo / Discount</p>
                <div className="grid grid-cols-2 gap-2 mb-6">
                    {discounts.filter(d => d.active).map(discount => (
                        <button
                            key={discount.id}
                            onClick={() => setSelectedDiscount(selectedDiscount?.id === discount.id ? null : discount)}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                                selectedDiscount?.id === discount.id 
                                ? 'bg-black text-white border-black shadow-md scale-[0.98]' 
                                : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400'
                            }`}
                        >
                            <span className="block font-bold text-[11px] truncate">{discount.name}</span>
                            <span className={`text-[10px] font-bold ${selectedDiscount?.id === discount.id ? 'text-zinc-300' : 'text-green-600'}`}>
                                {discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₱${discount.value} OFF`}
                            </span>
                        </button>
                    ))}
                    {discounts.filter(d => d.active).length === 0 && (
                        <p className="col-span-2 text-[10px] text-gray-400 italic text-center py-2 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">No active promotions available.</p>
                    )}
                </div>

                <p className="text-gray-500 text-xs font-bold mb-3 uppercase tracking-widest">Payment Method</p>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <button 
                        onClick={() => setPaymentMethod('CASH')} 
                        className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                            paymentMethod === 'CASH' 
                            ? 'border-green-500 bg-white shadow-md' 
                            : 'border-zinc-100 bg-white hover:border-green-200'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 ${paymentMethod === 'CASH' ? 'bg-green-500 text-white border-green-500' : 'bg-green-50 text-green-600 border-green-200'}`}>
                            P
                        </div>
                        <span className={`font-bold text-xs ${paymentMethod === 'CASH' ? 'text-green-700' : 'text-zinc-500'}`}>Cash</span>
                    </button>

                    <button 
                        onClick={() => setPaymentMethod('GCASH')} 
                        className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                            paymentMethod === 'GCASH' 
                            ? 'border-blue-500 bg-white shadow-md' 
                            : 'border-zinc-100 bg-white hover:border-blue-200'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 ${paymentMethod === 'GCASH' ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                            G
                        </div>
                        <span className={`font-bold text-xs ${paymentMethod === 'GCASH' ? 'text-blue-700' : 'text-zinc-500'}`}>GCash</span>
                    </button>

                    <button 
                        onClick={() => setPaymentMethod('SPLIT')} 
                        className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                            paymentMethod === 'SPLIT' 
                            ? 'border-purple-500 bg-white shadow-md' 
                            : 'border-zinc-100 bg-white hover:border-purple-200'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 ${paymentMethod === 'SPLIT' ? 'bg-purple-500 text-white border-purple-500' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>
                            S
                        </div>
                        <span className={`font-bold text-xs ${paymentMethod === 'SPLIT' ? 'text-purple-700' : 'text-zinc-500'}`}>Split</span>
                    </button>
                </div>

                {/* Payment Details Inputs */}
                <div className="space-y-4 mb-2">
                    {paymentMethod === 'GCASH' && (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in">
                            {storeSettings.gcashQr ? (
                                <div className="mb-4 flex justify-center">
                                    <div className="relative">
                                        <img src={storeSettings.gcashQr} alt="GCash QR" className="w-32 h-32 object-contain rounded-lg bg-white border border-blue-200" />
                                    </div>
                                </div>
                            ) : (
                                <div className="h-32 flex items-center justify-center bg-white border border-blue-200 rounded-lg mb-4 text-gray-400 text-xs flex-col gap-1">
                                    <CreditCard className="w-8 h-8 opacity-20" />
                                    <span>NO QR CODE AVAILABLE</span>
                                </div>
                            )}
                            <p className="text-center font-bold text-blue-800 mb-2 tracking-widest text-lg">{storeSettings.gcashNumber}</p>
                            <div className="mt-4">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">REFERENCE NUMBER</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    ref={gcashRefInputRef}
                                    className="w-full border border-blue-200 rounded-lg p-3 text-center font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-zinc-900" 
                                    placeholder="000 000 000" 
                                    value={gcashRef}
                                    onChange={e => setGcashRef(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'SPLIT' && (
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 animate-fade-in space-y-4">
                            <div>
                                <label className="text-xs font-bold text-purple-800 uppercase ml-1">CASH</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">₱</span>
                                    <input 
                                        autoFocus
                                        type="number" 
                                        ref={cashInputRef}
                                        className="w-full pl-8 border border-purple-200 rounded-lg p-3 font-mono text-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white text-zinc-900" 
                                        placeholder="0.00"
                                        value={splitCashAmount}
                                        onChange={e => setSplitCashAmount(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-purple-800 uppercase ml-1">GCASH</label>
                                <div className="bg-purple-100 border border-purple-200 rounded-lg p-3 text-center">
                                    <span className="text-3xl font-bold text-purple-700">
                                        ₱{Math.max(0, paymentDetails.finalTotal - (Number(splitCashAmount) || 0)).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-purple-800 uppercase ml-1">GCASH REFERENCE</label>
                                <input 
                                    type="text" 
                                    ref={gcashRefInputRef}
                                    className="w-full border border-purple-200 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-zinc-900" 
                                    placeholder="GCash Ref No." 
                                    value={gcashRef}
                                    onChange={e => setGcashRef(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 pt-4 border-t border-zinc-100 flex-shrink-0 flex gap-3">
                <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)} className="flex-1">
                    Cancel
                </Button>
                <Button onClick={handleFinalizePayment} className="flex-[2] text-lg shadow-xl">
                    Confirm & Complete
                </Button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

       {/* COMPLETION MODAL */}
       <Dialog open={completionModal.isOpen} onClose={() => setCompletionModal({isOpen: false, apt: null})} className="relative z-50">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative">
                    <button onClick={() => setCompletionModal({isOpen: false, apt: null})} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X className="w-5 h-5"/></button>
                    
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-zinc-900">Success!</h2>
                        <p className="text-sm text-gray-500 mt-2">
                            {completionModal.apt?.petName} is finished. How would you like to notify {completionModal.apt?.ownerName}?
                        </p>
                    </div>

                    <div className="space-y-3">
                        <button 
                            onClick={() => processCompletion('SMS')}
                            className="w-full p-4 rounded-xl border-2 border-blue-100 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 hover:border-blue-200 transition-all flex items-center gap-3 active:scale-95"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center"><Smartphone className="w-4 h-4" /></div>
                            SMS Only
                        </button>
                        <button 
                            onClick={() => processCompletion('EMAIL')}
                            className="w-full p-4 rounded-xl border-2 border-orange-100 bg-orange-50 text-orange-700 font-bold hover:bg-orange-100 hover:border-orange-200 transition-all flex items-center gap-3 active:scale-95"
                        >
                            <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center"><Mail className="w-4 h-4" /></div>
                            Email Only
                        </button>
                        <button 
                            onClick={() => processCompletion('BOTH')}
                            className="w-full p-4 rounded-xl border-2 border-zinc-900 bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-all flex items-center gap-3 active:scale-95 shadow-lg"
                        >
                            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center"><CheckCircle className="w-4 h-4" /></div>
                            Both (SMS + Email)
                        </button>
                        
                        <div className="pt-2 border-t border-zinc-100 mt-4">
                            <button 
                                onClick={() => processCompletion('NONE')}
                                className="w-full py-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                Close (No Notification)
                            </button>
                        </div>
                    </div>
                </Dialog.Panel>
            </div>
       </Dialog>

       {/* ADD/EDIT MODAL */}
       <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
            <Dialog.Title className="text-xl font-bold mb-4 text-zinc-900 border-b border-zinc-100 pb-2">
              {editingId ? 'Edit Appointment' : 'Book Appointment'}
            </Dialog.Title>
            
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              
              <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><User className="w-3 h-3" /> Owner Details</h4>
                  
                  <div className="relative" ref={dropdownRef}>
                      <label className={labelClass}>Owner Name</label>
                      <div className="relative">
                          <input 
                              required 
                              className={`${inputClass} pl-9`}
                              value={formData.ownerName} 
                              onChange={handleOwnerNameChange} 
                              onFocus={(e) => handleOwnerNameChange(e)}
                              placeholder="Type to search..." 
                              autoComplete="off"
                          />
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      </div>
                      
                      {/* Enhanced Owner Suggestions Dropdown */}
                      {showSuggestions && filteredClients.length > 0 && (
                          <div className="absolute z-50 w-full bg-white mt-2 rounded-2xl shadow-xl border border-zinc-100 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                  {filteredClients.map(client => (
                                      <div 
                                          key={client.id}
                                          onClick={() => selectClient(client)}
                                          className="p-3.5 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 last:border-0 flex justify-between items-center group transition-colors"
                                      >
                                          <div>
                                              <p className="text-sm font-bold text-zinc-900 group-hover:text-black">{client.name}</p>
                                              <p className="text-xs text-gray-500 group-hover:text-gray-700 flex items-center gap-2 mt-0.5">
                                                  {client.contactNumber && <span>{client.contactNumber}</span>}
                                                  {client.pets && client.pets.length > 0 && <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{client.pets.length} Pet(s)</span>}
                                              </p>
                                          </div>
                                          <ChevronDown className="-rotate-90 w-4 h-4 text-gray-300 group-hover:text-black transition-colors" />
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Contact #</label>
                        <input 
                            className={inputClass} 
                            value={formData.contactNumber} 
                            onChange={e => setFormData({...formData, contactNumber: e.target.value})} 
                            onBlur={(e) => setFormData({...formData, contactNumber: sanitizeContactNumber(e.target.value)})}
                            placeholder="09XX-XXX-XXXX" 
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Email Address</label>
                        <input type="email" className={inputClass} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@example.com" />
                    </div>
                  </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Dog className="w-3 h-3" /> Pet Details</h4>
                      {selectedClient && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold border border-blue-100">
                              {selectedClient.pets.length > 0 ? 'Select existing pet below' : 'New pet will be added'}
                          </span>
                      )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative" ref={petDropdownRef}>
                        <label className={labelClass}>Pet Name</label>
                        <input 
                            required 
                            className={inputClass} 
                            value={formData.petName} 
                            onChange={e => {
                                setFormData({...formData, petName: e.target.value});
                                if (selectedClient && selectedClient.pets && selectedClient.pets.length > 0) {
                                    setShowPetSuggestions(true);
                                }
                            }}
                            onFocus={handlePetNameFocus}
                            placeholder={selectedClient ? "Select or type new..." : "Pet's Name"} 
                            autoComplete="off"
                        />
                        {showPetSuggestions && selectedClient && selectedClient.pets.length > 0 && (
                            <div className="absolute z-50 w-full bg-white mt-2 rounded-2xl shadow-xl border border-zinc-100 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-2.5 bg-zinc-50 text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-zinc-100">
                                    {selectedClient.name}'s Pets
                                </div>
                                {selectedClient.pets
                                    .filter(p => normalizeText(p.name).includes(normalizeText(formData.petName || '')))
                                    .map(pet => (
                                    <div 
                                        key={pet.id}
                                        onClick={() => selectPet(pet)}
                                        className="p-3.5 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 last:border-0 flex justify-between items-center group"
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-zinc-900">{pet.name}</p>
                                            <p className="text-xs text-gray-500">{pet.breed}</p>
                                        </div>
                                        <Check className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                ))}
                                <div 
                                    className="p-3.5 hover:bg-blue-50 cursor-pointer text-blue-600 font-bold text-xs flex items-center gap-2 border-t border-zinc-100 transition-colors"
                                    onClick={() => {
                                        setShowPetSuggestions(false);
                                    }}
                                >
                                    <Plus className="w-3 h-3" /> Add New Pet "{formData.petName}"
                                </div>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className={labelClass}>Breed</label>
                        <input className={inputClass} value={formData.petBreed} onChange={e => setFormData({...formData, petBreed: e.target.value})} placeholder="e.g. Shih Tzu" />
                    </div>
                    <div>
                        <label className={labelClass}>Color</label>
                        <input className={inputClass} value={formData.petColor} onChange={e => setFormData({...formData, petColor: e.target.value})} placeholder="e.g. White/Brown" />
                    </div>
                    <div>
                        <label className={labelClass}>Weight / Size</label>
                        <input className={inputClass} value={formData.weightSize} onChange={e => setFormData({...formData, weightSize: e.target.value})} placeholder="e.g. 5kg / Small" />
                    </div>
                  </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Scissors className="w-3 h-3" /> Service & Style</h4>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="relative" ref={serviceDropdownRef}>
                        <label className={labelClass}>Service</label>
                        <div className="relative">
                            <input 
                                required 
                                className={`${inputClass} pl-9`}
                                value={serviceSearch} 
                                onChange={e => {
                                    setServiceSearch(e.target.value);
                                    setShowServiceSuggestions(true);
                                }}
                                onFocus={() => setShowServiceSuggestions(true)}
                                placeholder="Select or search..."
                                autoComplete="off"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        </div>
                        
                        {/* Enhanced Service Dropdown */}
                        {showServiceSuggestions && (
                            <div className="absolute z-50 w-full bg-white mt-2 rounded-2xl shadow-xl border border-zinc-100 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="max-h-56 overflow-y-auto custom-scrollbar">
                                    {groomingServices
                                        .filter(s => normalizeText(s.name).includes(normalizeText(serviceSearch)))
                                        .map(s => (
                                        <div 
                                            key={s.id} 
                                            onClick={() => {
                                                setFormData({...formData, serviceId: s.id});
                                                setServiceSearch(s.name);
                                                setShowServiceSuggestions(false);
                                            }}
                                            className="p-3.5 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 last:border-0 flex justify-between items-center group transition-colors"
                                        >
                                            <span className="text-sm font-bold text-zinc-900 group-hover:text-black">{s.name}</span>
                                            <span className="text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded-lg border border-zinc-200 group-hover:bg-white group-hover:shadow-sm transition-all">₱{s.price}</span>
                                        </div>
                                    ))}
                                    {groomingServices.filter(s => normalizeText(s.name).includes(normalizeText(serviceSearch))).length === 0 && (
                                        <div className="p-4 text-center text-gray-400 text-xs flex flex-col items-center">
                                            <Search className="w-6 h-6 mb-1 opacity-20" />
                                            No services match "{serviceSearch}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                     </div>
                     <div>
                        <label className={labelClass}>Groomer</label>
                        <select required className={inputClass} value={formData.groomerId} onChange={e => setFormData({...formData, groomerId: e.target.value})} disabled={groomers.length === 0}>
                        <option value="">{groomers.length === 0 ? 'No Groomers Available' : 'Select Groomer'}</option>
                        {groomers.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                        </select>
                     </div>
                  </div>
                  <div>
                      <label className={labelClass}>Hair Cut / Instructions</label>
                      <textarea className={`${inputClass} resize-none`} rows={2} value={formData.hairCut} onChange={e => setFormData({...formData, hairCut: e.target.value})} placeholder="e.g. Summer cut..." />
                  </div>
              </div>

              {/* ADD-ONS SECTION */}
              <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                      <Plus className="w-3 h-3" /> Add-Ons
                      <span className="text-gray-300 font-normal lowercase">(optional)</span>
                  </h4>

                  {/* Selected add-on items list */}
                  {addonItems.length > 0 && (
                      <div className="space-y-1.5">
                          {addonItems.map((productId) => {
                              const product = products.find(p => p.id === productId);
                              if (!product) return null;
                              return (
                                  <div key={productId} className="flex items-center justify-between bg-zinc-50 rounded-xl px-3 py-2 border border-zinc-100">
                                      <div className="flex items-center gap-2 min-w-0">
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${product.isService ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                              {product.isService ? 'SERVICE' : 'PRODUCT'}
                                          </span>
                                          <span className="text-sm font-bold text-zinc-800 truncate">{product.name}</span>
                                          <span className="text-xs text-gray-400 flex-shrink-0">₱{product.price.toFixed(2)}</span>
                                      </div>
                                      <button
                                          type="button"
                                          onClick={() => setAddonItems(prev => prev.filter(id => id !== productId))}
                                          className="ml-2 text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 flex-shrink-0"
                                      >
                                          <X className="w-3.5 h-3.5" />
                                      </button>
                                  </div>
                              );
                          })}
                      </div>
                  )}

                  {/* Add-on search input */}
                  <div className="relative" ref={addonDropdownRef}>
                      <div className="relative">
                          <input
                              type="text"
                              className={`${inputClass} pl-9`}
                              value={addonSearch}
                              onChange={e => {
                                  setAddonSearch(e.target.value);
                                  setShowAddonSuggestions(true);
                              }}
                            onFocus={() => setShowAddonSuggestions(true)}
                              placeholder="Search products or services to add..."
                              autoComplete="off"
                          />
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      </div>

                      {showAddonSuggestions && (
                          <div className="absolute z-50 w-full bg-white mt-2 rounded-2xl shadow-xl border border-zinc-100 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                              {/* Filter tabs */}
                              <div className="flex border-b border-zinc-100 bg-zinc-50">
                                  {(['ALL', 'SERVICE', 'PRODUCT'] as const).map(f => (
                                      <button
                                          key={f}
                                          type="button"
                                          onClick={() => setAddonFilter(f)}
                                          className={`flex-1 py-2 text-[11px] font-bold transition-all ${
                                              addonFilter === f
                                                  ? f === 'SERVICE'
                                                      ? 'text-purple-600 border-b-2 border-purple-500 bg-white'
                                                      : f === 'PRODUCT'
                                                          ? 'text-blue-600 border-b-2 border-blue-500 bg-white'
                                                          : 'text-zinc-900 border-b-2 border-zinc-900 bg-white'
                                                  : 'text-gray-400 hover:text-gray-600'
                                          }`}
                                      >
                                          {f === 'ALL' ? 'All' : f === 'SERVICE' ? '✂️ Services' : '🛍️ Products'}
                                      </button>
                                  ))}
                              </div>
                              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                  {products
                                      .filter(p =>
                                          p.id !== formData.serviceId &&
                                          !addonItems.includes(p.id) &&
                                          normalizeText(p.name).includes(normalizeText(addonSearch)) &&
                                          (addonFilter === 'ALL' || (addonFilter === 'SERVICE' ? p.isService : !p.isService))
                                      )
                                      .map(p => (
                                          <div
                                              key={p.id}
                                              onClick={() => {
                                                  setAddonItems(prev => [...prev, p.id]);
                                                  setAddonSearch('');
                                                  setShowAddonSuggestions(false);
                                              }}
                                              className="p-3.5 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 last:border-0 flex justify-between items-center group transition-colors"
                                          >
                                              <div className="flex items-center gap-2">
                                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.isService ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                      {p.isService ? 'SERVICE' : 'PRODUCT'}
                                                  </span>
                                                  <span className="text-sm font-bold text-zinc-900 group-hover:text-black">{p.name}</span>
                                              </div>
                                              <span className="text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded-lg border border-zinc-200 group-hover:bg-white group-hover:shadow-sm transition-all">₱{p.price}</span>
                                          </div>
                                      ))
                                  }
                                  {products.filter(p =>
                                      p.id !== formData.serviceId &&
                                      !addonItems.includes(p.id) &&
                                      normalizeText(p.name).includes(normalizeText(addonSearch)) &&
                                      (addonFilter === 'ALL' || (addonFilter === 'SERVICE' ? p.isService : !p.isService))
                                  ).length === 0 && (
                                      <div className="p-4 text-center text-gray-400 text-xs flex flex-col items-center gap-1">
                                          <Search className="w-5 h-5 opacity-20" />
                                          {addonSearch ? `No results for "${addonSearch}"` : 'All available items already added'}
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Schedule</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Date</label>
                        <input required type="date" className={inputClass} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                    <div>
                        <label className={labelClass}>Time</label>
                        <input required type="time" className={inputClass} value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                    </div>
                  </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-100">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={groomers.length === 0}>
                   {editingId ? 'Save Changes' : 'Book Appointment'}
                </Button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      <Dialog open={deleteConfirmation.isOpen} onClose={() => setDeleteConfirmation({...deleteConfirmation, isOpen: false})} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Delete Appointment?</Dialog.Title>
                    <p className="text-sm text-gray-500 mt-2">
                        Are you sure you want to delete the appointment record for <span className="font-bold text-zinc-800">"{deleteConfirmation.petName}"</span>?
                        <br/>
                        <span className="text-xs text-red-500 mt-1 block">This action will remove it from the database permanently.</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setDeleteConfirmation({...deleteConfirmation, isOpen: false})} className="flex-1">
                        Back
                    </Button>
                    <Button variant="danger" onClick={confirmDelete} className="flex-1">
                        Confirm Delete
                    </Button>
                </div>
            </Dialog.Panel>
        </div>
      </Dialog>

      {/* Receipt Preview Modal */}
      <Dialog open={showReceiptPreview} onClose={() => setShowReceiptPreview(false)} className="relative z-[70]">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-zinc-800 rounded-2xl p-4 shadow-2xl relative flex flex-col h-[90vh]">
             <div className="flex justify-between items-center mb-4 text-white">
                 <h3 className="font-bold text-lg flex items-center gap-2"><Printer className="w-5 h-5" /> Receipt Preview</h3>
                 <button onClick={() => setShowReceiptPreview(false)} className="p-2 hover:bg-zinc-700 rounded-full">
                     <X className="w-5 h-5" />
                 </button>
             </div>
             
             {/* Preview Controls */}
             <div className="bg-zinc-700/50 p-3 rounded-xl mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                    <Settings className="w-4 h-4" />
                    <span className="text-sm font-bold">Paper Size</span>
                </div>
                <div className="flex bg-zinc-900 rounded-lg p-1">
                    <button onClick={() => setPaperSize('58mm')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${paperSize === '58mm' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>58mm</button>
                    <button onClick={() => setPaperSize('80mm')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${paperSize === '80mm' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>80mm</button>
                </div>
             </div>

             <div className="flex-1 overflow-auto bg-zinc-700/50 rounded-xl p-6 flex justify-center items-start">
                 <div className="shadow-2xl shadow-black/50 transition-all duration-300">
                     {printingTransaction && <ReceiptTemplate transaction={printingTransaction} settings={storeSettings} paperSize={paperSize} isPreview={true} />}
                 </div>
             </div>

             <div className="mt-4 flex gap-3">
                <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/50" onClick={handleActualPrint}>
                    <Printer className="w-4 h-4 mr-2" /> Print Now
                </Button>
             </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Hidden Print Layout */}
      {printingTransaction && (
        <div id="printable-content" className="hidden print:block fixed inset-0 bg-white z-[9999] p-2">
            <ReceiptTemplate transaction={printingTransaction} settings={storeSettings} paperSize={paperSize} />
        </div>
      )}
    </div>
  );
};

export default Grooming;
