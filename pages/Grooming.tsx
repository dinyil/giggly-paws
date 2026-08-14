
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useBroadcast } from '../context/BroadcastContext'; 
import { GroomingAppointment, AdditionalPet, Role, Client, Pet, Transaction, Discount } from '../types';
import Button from '../components/ui/Button';
import { Plus, Calendar, Dog, User, Scissors, History, Clock, CheckCircle, ArrowRight, Pencil, Trash2, Smartphone, Scale, Palette, Check, MessageSquare, Mail, ChevronUp, ChevronDown, Search, X, RotateCcw, CreditCard, Printer, Settings, Tag, Percent } from '../components/ui/Icons';
import { Dialog } from '@headlessui/react';
import { getNotificationContent } from '../services/notifications';
import ReceiptTemplate from '../components/ReceiptTemplate';

type GroomingTab = 'UPCOMING' | 'WAITING' | 'ONGOING' | 'COMPLETED';
type TimeRange = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';
type PetSpecies = 'DOG' | 'CAT' | 'OTHER';
type SizeCategory = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

// Auto-detect dog size category from weight in kg
const detectSizeFromWeight = (weightKg: number): SizeCategory => {
  if (weightKg <= 2) return 'XS';
  if (weightKg <= 5) return 'S';
  if (weightKg <= 10) return 'M';
  if (weightKg <= 16) return 'L';
  if (weightKg <= 25) return 'XL';
  return 'XXL';
};

// Parse weight from a string input (e.g. "3.5kg", "3.5", "3")
const parseWeightKg = (input: string): number | null => {
  const cleaned = input.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

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
  const { appointments, addAppointment, updateAppointment, deleteAppointment, updateAppointmentStatus, products, users, clients, storeSettings, addLog, checkAndIncrementSms, addTransaction, currentUser, discounts, transactions } = useStore();
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
  const paperSize = (storeSettings.receiptPaperSize || '80mm') as '48mm' | '58mm' | '80mm';
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

  // Additional Pets State (2nd pet onward)
  const [additionalPets, setAdditionalPets] = useState<AdditionalPet[]>([]);
  const [addonSearch, setAddonSearch] = useState('');
  const [showAddonSuggestions, setShowAddonSuggestions] = useState(false);
  const [addonFilter, setAddonFilter] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');


  // Form Data
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<GroomingAppointment>>({
    petName: '', petBreed: '', petColor: '', weightSize: '',
    petSpecies: 'DOG',
    ownerName: '', contactNumber: '', email: '',
    serviceId: '', hairCut: '',
    date: today, time: '', status: 'SCHEDULED', groomerId: ''
  });

  // Detected size derived from weightSize input
  const detectedSize = useMemo((): SizeCategory | null => {
    if (formData.petSpecies !== 'DOG') return null;
    const kg = parseWeightKg(formData.weightSize || '');
    return kg !== null ? detectSizeFromWeight(kg) : null;
  }, [formData.weightSize, formData.petSpecies]);

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
          weightSize: pet.weightSize || '',
          // Auto-fill species from pet profile (map Pet.species to appointment petSpecies)
          petSpecies: (pet.species === 'CAT' ? 'CAT' : pet.species === 'OTHER' ? 'OTHER' : 'DOG') as 'DOG' | 'CAT' | 'OTHER'
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
      petSpecies: 'DOG',
      ownerName: '', contactNumber: '', email: '',
      serviceId: '', hairCut: '',
      date: getPhTodayStr(), time: '', status: 'SCHEDULED', groomerId: ''
    });
    setAdditionalPets([]);
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

    // Load additional pets
    setAdditionalPets(apt.pets || []);
    
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
      petSpecies: apt.petSpecies || 'DOG',
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
    
    // Pre-load add-ons and additional pets from previous appointment
    setAddonItems(apt.addonIds || []);
    setAddonSearch('');
    setAdditionalPets(apt.pets || []);
    
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

    // Compute detectedSizeCategory from weight before saving
    const kg = parseWeightKg(finalFormData.weightSize || '');
    const sizeCategory = kg !== null && finalFormData.petSpecies === 'DOG' ? detectSizeFromWeight(kg) : undefined;

    if (editingId) {
      const updatedApt: GroomingAppointment = { 
        ...finalFormData as GroomingAppointment, 
        id: editingId, 
        addonIds: addonItems,
        petSpecies: finalFormData.petSpecies as 'DOG' | 'CAT' | 'OTHER' | undefined,
        detectedSizeCategory: sizeCategory,
        pets: additionalPets
      };
      updateAppointment(updatedApt);
    } else {
      const apt: GroomingAppointment = {
        id: Date.now().toString(),
        petName: finalFormData.petName!,
        petBreed: finalFormData.petBreed,
        petColor: finalFormData.petColor,
        weightSize: finalFormData.weightSize,
        petSpecies: finalFormData.petSpecies as 'DOG' | 'CAT' | 'OTHER' | undefined,
        detectedSizeCategory: sizeCategory,
        ownerName: finalFormData.ownerName!,
        contactNumber: finalFormData.contactNumber,
        email: finalFormData.email,
        serviceId: finalFormData.serviceId!,
        hairCut: finalFormData.hairCut,
        date: finalFormData.date!,
        time: finalFormData.time!,
        status: 'SCHEDULED',
        groomerId: finalFormData.groomerId!,
        addonIds: addonItems,
        pets: additionalPets
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

      // Build add-on cart items (pet 1)
      const addonCartItems = (paymentApt.addonIds || []).flatMap(id => {
          const p = products.find(prod => prod.id === id);
          if (!p) return [];
          return [{ ...p, quantity: 1, appliedDiscounts: [] as Discount[] }];
      });
      const addonTotal = addonCartItems.reduce((sum, item) => sum + item.price, 0);

      // Build additional pets' service + add-on items
      const extraPetItems = (paymentApt.pets || []).flatMap(pet => {
          const petService = products.find(p => p.id === pet.serviceId);
          const petAddons = (pet.addonIds || []).flatMap(id => {
              const p = products.find(prod => prod.id === id);
              return p ? [{ ...p, quantity: 1, appliedDiscounts: [] as Discount[] }] : [];
          });
          return petService ? [{ ...petService, name: `${petService.name} (${pet.petName})`, quantity: 1, appliedDiscounts: [] as Discount[] }, ...petAddons] : petAddons;
      });
      const extraPetTotal = extraPetItems.reduce((sum, item) => sum + item.price, 0);

      const combinedPrice = price + addonTotal + extraPetTotal;
      
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

      // Create Transaction Record (main service + all add-ons + extra pets)
      const transaction: Transaction = {
          id: Date.now().toString(),
          items: [
              {
                  ...service!,
                  name: (paymentApt.pets || []).length > 0 ? `${service!.name} (${paymentApt.petName})` : service!.name,
                  quantity: 1,
                  appliedDiscounts: selectedDiscount ? [selectedDiscount] : []
              },
              ...addonCartItems,
              ...extraPetItems
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

      // Auto-open receipt preview after completion
      setTimeout(() => handlePrintReceipt(apt), 150);
  };


  // --- PRINT RECEIPT LOGIC ---
  const handlePrintReceipt = (apt: GroomingAppointment) => {
      const service = products.find(p => p.id === apt.serviceId);
      const price = service ? service.price : 0;

      // 1. Try to find the REAL transaction from the database first
      //    Match: transaction must contain this service as an item AND owner name matches (via grooming appointment)
      const realTransaction = transactions.find(t =>
          t.items?.some(item => item.id === apt.serviceId)
          && new Date(t.date).toDateString() === new Date(apt.date).toDateString()
      );

      if (realTransaction) {
          // Use the actual saved transaction — correct payment method, cashier, date, totals
          setPrintingTransaction(realTransaction);
          setShowReceiptPreview(true);
          return;
      }

      // 2. Fallback: build from appointment data (no saved transaction found, e.g. old records)
      const addonCartItems = (apt.addonIds || []).flatMap(id => {
          const p = products.find(prod => prod.id === id);
          if (!p) return [];
          return [{ ...p, quantity: 1, appliedDiscounts: [] as Discount[] }];
      });
      const addonTotal = addonCartItems.reduce((sum, item) => sum + item.price, 0);

      // Include additional pets in fallback receipt
      const extraPetItems = (apt.pets || []).flatMap(pet => {
          const petService = products.find(p => p.id === pet.serviceId);
          const petAddons = (pet.addonIds || []).flatMap(id => {
              const p = products.find(prod => prod.id === id);
              return p ? [{ ...p, quantity: 1, appliedDiscounts: [] as Discount[] }] : [];
          });
          return petService
              ? [{ ...petService, name: `${petService.name} (${pet.petName})`, quantity: 1, appliedDiscounts: [] as Discount[] }, ...petAddons]
              : petAddons;
      });
      const extraPetTotal = extraPetItems.reduce((sum, item) => sum + item.price, 0);
      const combinedPrice = price + addonTotal + extraPetTotal;

      const vatRate = storeSettings.vatRate / 100;
      const total = combinedPrice;
      const vat = (total / (1 + vatRate)) * vatRate;
      const subtotal = total - vat;

      const fallbackTransaction: Transaction = {
          id: `A-${apt.id.slice(-6)}`,
          items: [
              { ...service!, quantity: 1, appliedDiscounts: [] },
              ...addonCartItems,
              ...extraPetItems
          ],
          subtotal,
          vat,
          total,
          discount: 0,
          paymentMethod: 'CASH',
          date: apt.date,
          cashierId: 'REPRINT'
      };

      setPrintingTransaction(fallbackTransaction);
      setShowReceiptPreview(true);
  };

  const handleActualPrint = () => {
      // Inject dynamic @page size before printing so the browser uses correct thermal width
      const existingStyle = document.getElementById('thermal-print-style');
      if (existingStyle) existingStyle.remove();
      const style = document.createElement('style');
      style.id = 'thermal-print-style';
      style.textContent = `@media print { @page { size: ${paperSize} auto; margin: 0; } }`;
      document.head.appendChild(style);
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
      if (!paymentApt) return { name: '', price: 0, discount: 0, finalTotal: 0, addonTotal: 0, extraPetTotal: 0 };
      const s = products.find(p => p.id === paymentApt.serviceId);
      const basePrice = s?.price || 0;

      // Sum up primary pet add-ons
      const addonTotal = (paymentApt.addonIds || []).reduce((sum, id) => {
          const product = products.find(p => p.id === id);
          return sum + (product ? product.price : 0);
      }, 0);

      // Sum up additional pets (service + add-ons each)
      const extraPetTotal = (paymentApt.pets || []).reduce((sum, pet) => {
          const petSvc = products.find(p => p.id === pet.serviceId);
          const petAddonTotal = (pet.addonIds || []).reduce((s2, id) => {
              const p = products.find(pr => pr.id === id);
              return s2 + (p ? p.price : 0);
          }, 0);
          return sum + (petSvc ? petSvc.price : 0) + petAddonTotal;
      }, 0);

      const combinedPrice = basePrice + addonTotal + extraPetTotal;
      
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
          extraPetTotal,
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
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${historyTimeRange === range ? 'bg-white shadow-sm text-purple-900' : 'text-gray-500 hover:text-purple-900'}`}
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
                        const isWalkIn = (apt.hairCut || '').includes('Paid at POS');
                        const baseServicePrice = products.find(p => p.id === apt.serviceId)?.price || 0;
                        const aptAddonTotal = (apt.addonIds || []).reduce((sum, id) => sum + (products.find(p => p.id === id)?.price || 0), 0);
                        const extraPetsTotal = (apt.pets || []).reduce((sum, pet) => {
                            const ps = products.find(p => p.id === pet.serviceId)?.price || 0;
                            const pa = (pet.addonIds || []).reduce((s, id) => s + (products.find(p => p.id === id)?.price || 0), 0);
                            return sum + ps + pa;
                        }, 0);
                        const aptTotal = baseServicePrice + aptAddonTotal + extraPetsTotal;

                        return (
                            <div key={apt.id} className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-100 flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
                                {/* Date + status */}
                                <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div className={`text-xs font-bold px-3 py-1 rounded-full border ${apt.date === today ? 'bg-purple-900 text-white border-zinc-900' : 'bg-white text-zinc-900 border-zinc-200'}`}>
                                        {apt.date === today ? 'TODAY' : new Date(apt.date).toLocaleDateString()} • {formatTime(apt.time)}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(apt.status === 'SCHEDULED' || apt.status === 'COMPLETED') && (
                                            <div className="flex items-center bg-zinc-50 rounded-lg p-0.5 border border-zinc-100">
                                                <button onClick={() => openEditModal(apt)} className="p-1.5 text-gray-500 hover:text-purple-900 hover:bg-white rounded-md transition-all" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                <div className="w-px h-3 bg-gray-200 mx-0.5"></div>
                                                <button onClick={() => handleCancelClick(apt.id, apt.petName)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded-md transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        )}
                                        <span className={`text-xs font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${apt.status === 'SCHEDULED' ? 'bg-orange-100 text-orange-600' : apt.status === 'ONGOING' ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>{apt.status}</span>
                                    </div>
                                </div>

                                {/* Owner (shown once) */}
                                <div className="mb-3 relative z-10">
                                    <p className="text-sm text-gray-500 flex items-center gap-1 font-medium flex-wrap">
                                        <User className="w-3 h-3 flex-shrink-0"/>
                                        {apt.ownerName}
                                        {apt.contactNumber && <span className="text-gray-400">({apt.contactNumber})</span>}
                                        {isWalkIn && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 uppercase">Walk-in</span>}
                                        {(apt.pets || []).length > 0 && <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{(apt.pets || []).length + 1} Pets</span>}
                                    </p>
                                </div>

                                {/* Pets — primary + additional */}
                                <div className="space-y-2 mb-4 relative z-10">
                                    {[
                                        { petName: apt.petName, petBreed: apt.petBreed, serviceId: apt.serviceId, hairCut: apt.hairCut, addonIds: apt.addonIds || [] },
                                        ...(apt.pets || [])
                                    ].map((pet, pi) => {
                                        const petSvc = products.find(p => p.id === pet.serviceId);
                                        const petAddons = (pet.addonIds || []).map(id => products.find(p => p.id === id)).filter(Boolean);
                                        const petTotal = (petSvc?.price || 0) + petAddons.reduce((s, p) => s + (p!.price || 0), 0);
                                        return (
                                            <div key={pi} className={`rounded-2xl border p-3 ${pi === 0 ? 'border-purple-100 bg-purple-50/40' : 'border-zinc-100 bg-zinc-50/50'}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-zinc-900 text-sm">🐾 {pet.petName}</span>
                                                    {pet.petBreed && <span className="text-xs text-gray-400 bg-white border border-zinc-100 px-2 py-0.5 rounded-lg">{pet.petBreed}</span>}
                                                </div>
                                                <div className="flex justify-between items-center text-xs text-gray-500">
                                                    <span>{petSvc?.name || '—'}</span>
                                                    <span className="font-bold text-purple-700">₱{petTotal.toFixed(2)}</span>
                                                </div>
                                                {petAddons.length > 0 && (
                                                    <div className="mt-1 space-y-0.5">
                                                        {petAddons.map((p, ai) => (
                                                            <div key={ai} className="flex justify-between items-center">
                                                                <span className="text-zinc-400 text-xs pl-2">• {p!.name}</span>
                                                                <span className="text-xs text-gray-400">₱{p!.price}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {pet.hairCut && <div className="mt-1 text-xs text-yellow-700 italic">✄ {pet.hairCut}</div>}
                                                {'groomerId' in pet && (pet as any).groomerId && (pet as any).groomerId !== apt.groomerId && (
                                                    <div className="mt-1 text-xs text-blue-600 font-medium">✂ {(pet as any).groomerId}</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Groomer + total */}
                                <div className="space-y-1 mb-5 relative z-10">
                                    <div className="flex justify-between items-center text-sm"><span className="text-gray-400">Groomer</span><span className="font-bold text-zinc-800">{apt.groomerId}</span></div>
                                    {!isWalkIn && (
                                        <div className="flex justify-between items-center text-sm border-t border-zinc-100 pt-2 mt-1">
                                            <span className="font-bold text-zinc-700">Total</span>
                                            <span className="font-bold text-purple-700">₱{aptTotal.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="mt-auto relative z-10">
                                    {apt.status === 'SCHEDULED' && (
                                        apt.date === today ? (
                                            <button className="w-full bg-purple-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-purple-800 transition-all active:scale-95 shadow-lg shadow-zinc-200" onClick={() => updateAppointmentStatus(apt.id, 'ONGOING')}>
                                                Start Session <ArrowRight className="w-4 h-4" />
                                            </button>
                                        ) : <div className="w-full text-center py-2 text-sm text-gray-400 font-medium bg-zinc-50 rounded-xl border border-zinc-100">Scheduled</div>
                                    )}
                                    {apt.status === 'ONGOING' && (
                                        <button className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-100" onClick={() => handleProceedToPayment(apt)}>
                                            Complete Grooming
                                        </button>
                                    )}
                                    {apt.status === 'COMPLETED' && (
                                        <div className="flex gap-2">
                                            <div className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-green-700 font-bold bg-green-50 rounded-xl border border-green-100">
                                                <CheckCircle className="w-4 h-4" /> Finished
                                            </div>
                                            <Button variant="secondary" className="w-auto px-3 bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-600" title="Reprint Receipt" onClick={() => handlePrintReceipt(apt)}>
                                                <Printer className="w-4 h-4" />
                                            </Button>
                                            <Button variant="secondary" className="w-auto px-3 bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-600" title="Rebook Same Service" onClick={() => handleRebook(apt)}>
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
        <div className="fixed inset-0 bg-purple-700/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-white rounded-3xl shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
            
            {/* Header Section */}
            <div className="p-6 pb-4 border-b border-zinc-100 flex-shrink-0">
                <h2 className="text-xl font-bold text-zinc-900 mb-4">Grooming Payment</h2>
                
                {/* Order Summary Section */}
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                    <div className="space-y-1 text-sm text-zinc-600 mb-2 border-b border-zinc-200 pb-2">
                        {/* ── Primary Pet ── */}
                        {(paymentApt?.pets || []).length > 0 && (
                            <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">🐾 {paymentApt?.petName || 'Pet 1'}</p>
                        )}
                        <div className="flex justify-between font-medium">
                            <span>{paymentDetails.name}</span>
                            <span>₱{paymentDetails.price.toFixed(2)}</span>
                        </div>
                        {/* Primary pet add-ons */}
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

                        {/* ── Additional Pets ── */}
                        {(paymentApt?.pets || []).map((extraPet, pi) => {
                            const petSvc = products.find(p => p.id === extraPet.serviceId);
                            const petAddonTotal = (extraPet.addonIds || []).reduce((s, id) => s + (products.find(p => p.id === id)?.price || 0), 0);
                            const petSubtotal = (petSvc?.price || 0) + petAddonTotal;
                            return (
                                <div key={pi} className="mt-2 pt-2 border-t border-zinc-200">
                                    <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">🐾 {extraPet.petName || `Pet ${pi + 2}`}</p>
                                    {petSvc && (
                                        <div className="flex justify-between font-medium">
                                            <span>{petSvc.name}</span>
                                            <span>₱{petSvc.price.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {(extraPet.addonIds || []).map(id => {
                                        const p = products.find(pr => pr.id === id);
                                        if (!p) return null;
                                        return (
                                            <div key={id} className="flex justify-between text-zinc-500">
                                                <span className="flex items-center gap-1 pl-2">
                                                    <Plus className="w-2.5 h-2.5 text-zinc-400 flex-shrink-0" />{p.name}
                                                </span>
                                                <span>₱{p.price.toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                    <div className="flex justify-between text-xs text-zinc-400 mt-0.5">
                                        <span>Subtotal</span>
                                        <span>₱{petSubtotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Discount */}
                        {selectedDiscount && (
                            <div className="flex justify-between text-green-600 font-bold mt-2 pt-2 border-t border-zinc-200">
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
                                ? 'bg-purple-700 text-white border-purple-700 shadow-md scale-[0.98]' 
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
            <div className="fixed inset-0 bg-purple-700/50 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative">
                    <button onClick={() => setCompletionModal({isOpen: false, apt: null})} className="absolute top-4 right-4 text-gray-400 hover:text-purple-900"><X className="w-5 h-5"/></button>
                    
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
                            className="w-full p-4 rounded-xl border-2 border-zinc-900 bg-purple-900 text-white font-bold hover:bg-purple-800 transition-all flex items-center gap-3 active:scale-95 shadow-lg"
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
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
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
                                              <p className="text-sm font-bold text-zinc-900 group-hover:text-purple-900">{client.name}</p>
                                              <p className="text-xs text-gray-500 group-hover:text-gray-700 flex items-center gap-2 mt-0.5">
                                                  {client.contactNumber && <span>{client.contactNumber}</span>}
                                                  {client.pets && client.pets.length > 0 && <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{client.pets.length} Pet(s)</span>}
                                              </p>
                                          </div>
                                          <ChevronDown className="-rotate-90 w-4 h-4 text-gray-300 group-hover:text-purple-900 transition-colors" />
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

                  {/* SPECIES SELECTOR */}
                  <div>
                    <label className={labelClass}>Pet Species</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {([
                        { key: 'DOG', emoji: '🐶', label: 'Dog', color: 'amber' },
                        { key: 'CAT', emoji: '🐱', label: 'Cat', color: 'purple' },
                        { key: 'OTHER', emoji: '🐾', label: 'Other', color: 'zinc' },
                      ] as const).map(({ key, emoji, label, color }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, petSpecies: key, serviceId: '', }));
                            setServiceSearch('');
                            setAddonItems([]);
                          }}
                          className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 font-bold text-xs transition-all ${
                            formData.petSpecies === key
                              ? color === 'amber'
                                ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm scale-[1.02]'
                                : color === 'purple'
                                  ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm scale-[1.02]'
                                  : 'border-zinc-700 bg-zinc-100 text-zinc-800 shadow-sm scale-[1.02]'
                              : 'border-zinc-100 bg-white text-zinc-400 hover:border-zinc-300'
                          }`}
                        >
                          <span className="text-xl">{emoji}</span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
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
                                {(() => {
                                    // Names already chosen in additional pet slots
                                    const takenNames = additionalPets.map(ap => ap.petName.toLowerCase()).filter(Boolean);
                                    return selectedClient.pets
                                        .filter(p =>
                                            !takenNames.includes(p.name.toLowerCase()) &&
                                            normalizeText(p.name).includes(normalizeText(formData.petName || ''))
                                        )
                                        .map(pet => (
                                    <div 
                                        key={pet.id}
                                        onClick={() => selectPet(pet)}
                                        className="p-3.5 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 last:border-0 flex justify-between items-center group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{pet.species === 'CAT' ? '🐱' : pet.species === 'OTHER' ? '🐾' : '🐶'}</span>
                                            <div>
                                                <p className="text-sm font-bold text-zinc-900">{pet.name}</p>
                                                <p className="text-xs text-gray-500">{pet.species === 'OTHER' ? (pet.speciesLabel || 'Other') : pet.species}{pet.species ? ' · ' : ''}{pet.breed || 'Unknown Breed'}</p>
                                            </div>
                                        </div>
                                        <Check className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    ));
                                })()}
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
                        <label className={labelClass}>
                          Weight (kg)
                          {detectedSize && (
                            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              detectedSize === 'XS' ? 'bg-sky-50 text-sky-600 border-sky-200' :
                              detectedSize === 'S' ? 'bg-green-50 text-green-600 border-green-200' :
                              detectedSize === 'M' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                              detectedSize === 'L' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                              detectedSize === 'XL' ? 'bg-red-50 text-red-600 border-red-200' :
                              'bg-purple-50 text-purple-600 border-purple-200'
                            }`}>
                              → {detectedSize}
                            </span>
                          )}
                        </label>
                        <input 
                          className={inputClass} 
                          type="number"
                          min="0"
                          step="0.1"
                          value={formData.weightSize} 
                          onChange={e => setFormData({...formData, weightSize: e.target.value})} 
                          placeholder={formData.petSpecies === 'DOG' ? "e.g. 3.5 → auto-detects size" : "e.g. 4.2"} 
                        />
                        {detectedSize && (
                          <p className="text-[10px] text-gray-400 mt-1 font-medium">
                            Services & add-ons filtered to: <span className="font-bold text-purple-700">{formData.petSpecies} · {detectedSize}</span>
                          </p>
                        )}
                        {formData.petSpecies !== 'DOG' && (
                          <p className="text-[10px] text-gray-400 mt-1 font-medium">
                            Showing services for: <span className="font-bold text-purple-700">{formData.petSpecies}</span>
                          </p>
                        )}
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
                        
                        {/* Enhanced Service Dropdown - filtered by species + size */}
                        {showServiceSuggestions && (
                             <div className="absolute z-50 w-full bg-white mt-2 rounded-2xl shadow-xl border border-zinc-100 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                 {/* Active filter indicator */}
                                 <div className="px-3 py-1.5 bg-zinc-50 border-b border-zinc-100 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                   <span>{formData.petSpecies === 'DOG' ? '🐶' : formData.petSpecies === 'CAT' ? '🐱' : '🐾'}</span>
                                   <span className="uppercase tracking-wider">{formData.petSpecies}</span>
                                   {detectedSize && <><span>·</span><span className="text-purple-600">{detectedSize}</span></>}
                                   <span className="ml-auto normal-case">Filtered</span>
                                 </div>
                                 <div className="max-h-56 overflow-y-auto custom-scrollbar">
                                     {groomingServices
                                         .filter(s => {
                                           const nameMatch = normalizeText(s.name).includes(normalizeText(serviceSearch));
                                           // Species match: show if species matches or product is BOTH
                                           const speciesMatch = !s.petSpecies || s.petSpecies === 'BOTH' || s.petSpecies === formData.petSpecies;
                                           // Size match (only for dogs with a detected size)
                                           const sizeMatch = !detectedSize || !s.weightSizeCategory || s.weightSizeCategory === 'ALL' || s.weightSizeCategory === detectedSize;
                                           return nameMatch && speciesMatch && sizeMatch;
                                         })
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
                                             <span className="text-sm font-bold text-zinc-900 group-hover:text-purple-900">{s.name}</span>
                                             <span className="text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded-lg border border-zinc-200 group-hover:bg-white group-hover:shadow-sm transition-all">₱{s.price}</span>
                                         </div>
                                     ))}
                                     {groomingServices.filter(s => {
                                       const nameMatch = normalizeText(s.name).includes(normalizeText(serviceSearch));
                                       const speciesMatch = !s.petSpecies || s.petSpecies === 'BOTH' || s.petSpecies === formData.petSpecies;
                                       const sizeMatch = !detectedSize || !s.weightSizeCategory || s.weightSizeCategory === 'ALL' || s.weightSizeCategory === detectedSize;
                                       return nameMatch && speciesMatch && sizeMatch;
                                     }).length === 0 && (
                                         <div className="p-4 text-center text-gray-400 text-xs flex flex-col items-center gap-1">
                                             <Search className="w-6 h-6 mb-1 opacity-20" />
                                             {serviceSearch ? `No ${formData.petSpecies} services match "${serviceSearch}"` : `No services found for ${formData.petSpecies}${detectedSize ? ` · ${detectedSize}` : ''}`}
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
                               {/* Species + size filter badge */}
                               <div className="px-3 py-1.5 bg-zinc-50 border-b border-zinc-100 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                 <span>{formData.petSpecies === 'DOG' ? '🐶' : formData.petSpecies === 'CAT' ? '🐱' : '🐾'}</span>
                                 <span className="uppercase tracking-wider">{formData.petSpecies}</span>
                                 {detectedSize && <><span>·</span><span className="text-purple-600">{detectedSize}</span></>}
                                 <span className="ml-auto normal-case">Showing matching items</span>
                               </div>
                               <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                   {products
                                       .filter(p => {
                                         const notSelected = p.id !== formData.serviceId;
                                         const notAdded = !addonItems.includes(p.id);
                                         const nameMatch = normalizeText(p.name).includes(normalizeText(addonSearch));
                                         const typeMatch = addonFilter === 'ALL' || (addonFilter === 'SERVICE' ? p.isService : !p.isService);
                                         // Species filter: show BOTH, OTHER (for other pets), or matching species
                                         const speciesMatch = p.petSpecies === 'BOTH' || p.petSpecies === formData.petSpecies || !p.petSpecies;
                                         // Size filter (only for dogs)
                                         const sizeMatch = !detectedSize || !p.weightSizeCategory || p.weightSizeCategory === 'ALL' || p.weightSizeCategory === detectedSize;
                                         return notSelected && notAdded && nameMatch && typeMatch && speciesMatch && sizeMatch;
                                       })
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
                                                   <span className="text-sm font-bold text-zinc-900 group-hover:text-purple-900">{p.name}</span>
                                               </div>
                                               <span className="text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded-lg border border-zinc-200 group-hover:bg-white group-hover:shadow-sm transition-all">₱{p.price}</span>
                                           </div>
                                       ))
                                   }
                                   {products.filter(p => {
                                     const notSelected = p.id !== formData.serviceId;
                                     const notAdded = !addonItems.includes(p.id);
                                     const nameMatch = normalizeText(p.name).includes(normalizeText(addonSearch));
                                     const typeMatch = addonFilter === 'ALL' || (addonFilter === 'SERVICE' ? p.isService : !p.isService);
                                     const speciesMatch = p.petSpecies === 'BOTH' || p.petSpecies === formData.petSpecies || !p.petSpecies;
                                     const sizeMatch = !detectedSize || !p.weightSizeCategory || p.weightSizeCategory === 'ALL' || p.weightSizeCategory === detectedSize;
                                     return notSelected && notAdded && nameMatch && typeMatch && speciesMatch && sizeMatch;
                                   }).length === 0 && (
                                       <div className="p-4 text-center text-gray-400 text-xs flex flex-col items-center gap-1">
                                           <Search className="w-5 h-5 opacity-20" />
                                           {addonSearch ? `No results for "${addonSearch}"` : 'All available items already added or none match the filter'}
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

              {/* ADDITIONAL PETS SECTION */}
              <div className="space-y-4 pt-2 border-t-2 border-dashed border-purple-100">
                  <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-purple-500 uppercase flex items-center gap-1.5">
                          <Dog className="w-3.5 h-3.5" /> Additional Pets
                          <span className="text-purple-300 font-normal normal-case text-[10px]">— same owner, each pet billed separately</span>
                      </h4>
                  </div>

                  {additionalPets.map((pet, idx) => {
                      const updatePet = (field: keyof typeof pet, val: any) =>
                          setAdditionalPets(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));

                      const petWeightKg = parseWeightKg(pet.weightSize || '');
                      const petDetectedSize = pet.petSpecies === 'DOG' && petWeightKg !== null ? detectSizeFromWeight(petWeightKg) : null;

                      // Filtered services — same logic as primary pet
                      const filteredPetServices = groomingServices.filter(s => {
                          const nameMatch = normalizeText(s.name).includes(normalizeText(pet._serviceSearch || ''));
                          const speciesMatch = !s.petSpecies || s.petSpecies === 'BOTH' || s.petSpecies === pet.petSpecies;
                          const sizeMatch = !petDetectedSize || !s.weightSizeCategory || s.weightSizeCategory === 'ALL' || s.weightSizeCategory === petDetectedSize;
                          return nameMatch && speciesMatch && sizeMatch;
                      });

                      // Filtered add-ons — same logic as primary pet
                      const filteredPetAddons = products.filter(p => {
                          const notSelected = p.id !== pet.serviceId;
                          const notAdded = !(pet.addonIds || []).includes(p.id);
                          const nameMatch = normalizeText(p.name).includes(normalizeText(pet._addonSearch || ''));
                          const typeMatch = (pet._addonFilter || 'ALL') === 'ALL' || ((pet._addonFilter || 'ALL') === 'SERVICE' ? p.isService : !p.isService);
                          const speciesMatch = p.petSpecies === 'BOTH' || p.petSpecies === pet.petSpecies || !p.petSpecies;
                          const sizeMatch = !petDetectedSize || !p.weightSizeCategory || p.weightSizeCategory === 'ALL' || p.weightSizeCategory === petDetectedSize;
                          return notSelected && notAdded && nameMatch && typeMatch && speciesMatch && sizeMatch;
                      });

                      const petSvc = products.find(p => p.id === pet.serviceId);
                      const petAddonTotal = (pet.addonIds || []).reduce((s, id) => s + (products.find(p => p.id === id)?.price || 0), 0);
                      const petTotal = (petSvc?.price || 0) + petAddonTotal;

                      return (
                          <div key={pet.id} className="border-2 border-purple-100 rounded-3xl bg-white shadow-sm">
                              {/* ── Pet Header ── */}
                              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-purple-100/50 border-b border-purple-100">
                                  <span className="text-xs font-black text-purple-700 uppercase tracking-wide flex items-center gap-1.5">
                                      🐾 Pet #{idx + 2}
                                      {pet.petName && <span className="font-bold text-purple-500 normal-case tracking-normal">— {pet.petName}</span>}
                                  </span>
                                  <div className="flex items-center gap-2">
                                      {petTotal > 0 && <span className="text-xs font-bold text-purple-600 bg-white px-2 py-0.5 rounded-lg border border-purple-200">₱{petTotal.toFixed(2)}</span>}
                                      <button type="button" onClick={() => setAdditionalPets(prev => prev.filter((_, i) => i !== idx))}
                                          className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors">
                                          <X className="w-4 h-4" />
                                      </button>
                                  </div>
                              </div>

                              <div className="p-4 space-y-4">
                                  {/* ── PET DETAILS ── */}
                                  <div className="space-y-3">
                                      <h5 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Dog className="w-3 h-3" /> Pet Details</h5>

                                      {/* Species — identical to primary */}
                                      <div>
                                          <label className={labelClass}>Pet Species</label>
                                          <div className="grid grid-cols-3 gap-2 mt-1">
                                              {([
                                                  { key: 'DOG', emoji: '🐶', label: 'Dog', color: 'amber' },
                                                  { key: 'CAT', emoji: '🐱', label: 'Cat', color: 'purple' },
                                                  { key: 'OTHER', emoji: '🐾', label: 'Other', color: 'zinc' },
                                              ] as const).map(({ key, emoji, label, color }) => (
                                                  <button key={key} type="button"
                                                      onClick={() => { updatePet('petSpecies', key); updatePet('serviceId', ''); updatePet('_serviceSearch', ''); updatePet('addonIds', []); }}
                                                      className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 font-bold text-xs transition-all ${
                                                          pet.petSpecies === key
                                                              ? color === 'amber' ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm scale-[1.02]'
                                                              : color === 'purple' ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm scale-[1.02]'
                                                              : 'border-zinc-700 bg-zinc-100 text-zinc-800 shadow-sm scale-[1.02]'
                                                              : 'border-zinc-100 bg-white text-zinc-400 hover:border-zinc-300'
                                                      }`}>
                                                      <span className="text-xl">{emoji}</span>
                                                      <span>{label}</span>
                                                  </button>
                                              ))}
                                          </div>
                                      </div>

                                      {/* Name + Breed + Color + Weight — identical grid */}
                                      <div className="grid grid-cols-2 gap-4">
                                          {/* Pet Name — autocomplete from owner's existing pets */}
                                          <div className="relative">
                                              <label className={labelClass}>Pet Name</label>
                                              <input
                                                  required
                                                  className={inputClass}
                                                  value={pet.petName}
                                                  onChange={e => {
                                                      updatePet('petName', e.target.value);
                                                      updatePet('_showPetSug', true);
                                                  }}
                                                  onFocus={() => {
                                                      if (selectedClient && selectedClient.pets && selectedClient.pets.length > 0) {
                                                          updatePet('_showPetSug', true);
                                                      }
                                                  }}
                                                  placeholder={selectedClient ? 'Select or type new...' : "Pet's Name"}
                                                  autoComplete="off"
                                              />
                                              {pet._showPetSug && selectedClient && selectedClient.pets && selectedClient.pets.length > 0 && (
                                                  <div className="absolute z-50 w-full bg-white mt-2 rounded-2xl shadow-xl border border-zinc-100 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                                      <div className="p-2.5 bg-zinc-50 text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-zinc-100">
                                                          {selectedClient.name}'s Pets
                                                      </div>
                                                      {(() => {
                                                           // Exclude primary pet + all other additional pets
                                                           const takenNames = [
                                                               formData.petName?.toLowerCase() || '',
                                                               ...additionalPets
                                                                   .filter((_, i) => i !== idx)
                                                                   .map(ap => ap.petName.toLowerCase())
                                                           ].filter(Boolean);
                                                           return selectedClient.pets
                                                               .filter(p =>
                                                                   !takenNames.includes(p.name.toLowerCase()) &&
                                                                   normalizeText(p.name).includes(normalizeText(pet.petName || ''))
                                                               )
                                                               .map(existPet => (
                                                              <div
                                                                  key={existPet.id}
                                                                  onClick={() => {
                                                                      updatePet('petName', existPet.name);
                                                                      updatePet('petBreed', existPet.breed || '');
                                                                      updatePet('petColor', existPet.color || '');
                                                                      updatePet('weightSize', existPet.weightSize || '');
                                                                      updatePet('petSpecies', existPet.species === 'CAT' ? 'CAT' : existPet.species === 'OTHER' ? 'OTHER' : 'DOG');
                                                                      updatePet('_showPetSug', false);
                                                                      updatePet('serviceId', '');
                                                                      updatePet('_serviceSearch', '');
                                                                      updatePet('addonIds', []);
                                                                  }}
                                                                  className="p-3.5 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 last:border-0 flex justify-between items-center group transition-colors"
                                                              >
                                                                  <div className="flex items-center gap-2">
                                                                      <span className="text-lg">{existPet.species === 'CAT' ? '🐱' : existPet.species === 'OTHER' ? '🐾' : '🐶'}</span>
                                                                      <div>
                                                                          <p className="text-sm font-bold text-zinc-900">{existPet.name}</p>
                                                                          <p className="text-xs text-gray-500">{existPet.species === 'OTHER' ? (existPet.speciesLabel || 'Other') : existPet.species}{existPet.species ? ' · ' : ''}{existPet.breed || 'Unknown Breed'}</p>
                                                                      </div>
                                                                  </div>
                                                                  <Check className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                              </div>
                                                           ));
                                                       })()}

                                                      <div
                                                          className="p-3.5 hover:bg-blue-50 cursor-pointer text-blue-600 font-bold text-xs flex items-center gap-2 border-t border-zinc-100 transition-colors"
                                                          onClick={() => updatePet('_showPetSug', false)}
                                                      >
                                                          <Plus className="w-3 h-3" /> Add New Pet "{pet.petName}"
                                                      </div>
                                                  </div>
                                              )}
                                          </div>
                                          <div>
                                              <label className={labelClass}>Breed</label>
                                              <input className={inputClass} value={pet.petBreed || ''} onChange={e => updatePet('petBreed', e.target.value)} placeholder="e.g. Shih Tzu" />
                                          </div>
                                          <div>
                                              <label className={labelClass}>Color</label>
                                              <input className={inputClass} value={pet.petColor || ''} onChange={e => updatePet('petColor', e.target.value)} placeholder="e.g. White/Brown" />
                                          </div>
                                          <div>
                                              <label className={labelClass}>
                                                  Weight (kg)
                                                  {petDetectedSize && (
                                                      <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                          petDetectedSize === 'XS' ? 'bg-sky-50 text-sky-600 border-sky-200' :
                                                          petDetectedSize === 'S' ? 'bg-green-50 text-green-600 border-green-200' :
                                                          petDetectedSize === 'M' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                                          petDetectedSize === 'L' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                                          petDetectedSize === 'XL' ? 'bg-red-50 text-red-600 border-red-200' :
                                                          'bg-purple-50 text-purple-600 border-purple-200'
                                                      }`}>→ {petDetectedSize}</span>
                                                  )}
                                              </label>
                                              <input type="number" min="0" step="0.1" className={inputClass}
                                                  value={pet.weightSize || ''}
                                                  onChange={e => updatePet('weightSize', e.target.value)}
                                                  placeholder={pet.petSpecies === 'DOG' ? 'e.g. 3.5 → auto-detects size' : 'e.g. 4.2'} />
                                              {petDetectedSize && <p className="text-[10px] text-gray-400 mt-1 font-medium">Services & add-ons filtered to: <span className="font-bold text-purple-700">{pet.petSpecies} · {petDetectedSize}</span></p>}
                                          </div>
                                      </div>
                                  </div>

                                  {/* ── SERVICE & STYLE ── */}
                                  <div className="space-y-3 pt-2 border-t border-zinc-100">
                                      <h5 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Scissors className="w-3 h-3" /> Service & Style</h5>

                                      <div className="grid grid-cols-2 gap-4">
                                          {/* Searchable Service — identical to primary */}
                                          <div className="relative">
                                              <label className={labelClass}>Service</label>
                                              <div className="relative">
                                                  <input
                                                      required
                                                      className={`${inputClass} pl-9`}
                                                      value={pet._serviceSearch ?? (petSvc?.name || '')}
                                                      onChange={e => { updatePet('_serviceSearch', e.target.value); updatePet('_showServiceSug', true); }}
                                                      onFocus={() => updatePet('_showServiceSug', true)}
                                                      placeholder="Select or search..."
                                                      autoComplete="off"
                                                  />
                                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                              </div>
                                              {pet._showServiceSug && (
                                                  <div className="absolute z-50 w-full bg-white mt-2 rounded-2xl shadow-xl border border-zinc-100 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                                      <div className="px-3 py-1.5 bg-zinc-50 border-b border-zinc-100 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                                          <span>{pet.petSpecies === 'DOG' ? '🐶' : pet.petSpecies === 'CAT' ? '🐱' : '🐾'}</span>
                                                          <span className="uppercase tracking-wider">{pet.petSpecies}</span>
                                                          {petDetectedSize && <><span>·</span><span className="text-purple-600">{petDetectedSize}</span></>}
                                                          <span className="ml-auto normal-case">Filtered</span>
                                                      </div>
                                                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                          {filteredPetServices.length === 0 ? (
                                                              <div className="p-4 text-center text-gray-400 text-xs flex flex-col items-center gap-1">
                                                                  <Search className="w-5 h-5 opacity-20" />
                                                                  {pet._serviceSearch ? `No services match "${pet._serviceSearch}"` : `No services for ${pet.petSpecies}${petDetectedSize ? ` · ${petDetectedSize}` : ''}`}
                                                              </div>
                                                          ) : filteredPetServices.map(s => (
                                                              <div key={s.id}
                                                                  onClick={() => { updatePet('serviceId', s.id); updatePet('_serviceSearch', s.name); updatePet('_showServiceSug', false); }}
                                                                  className="p-3.5 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 last:border-0 flex justify-between items-center group transition-colors">
                                                                  <span className="text-sm font-bold text-zinc-900 group-hover:text-purple-900">{s.name}</span>
                                                                  <span className="text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded-lg border border-zinc-200 group-hover:bg-white group-hover:shadow-sm transition-all">₱{s.price}</span>
                                                              </div>
                                                           ))}

                                                      </div>
                                                  </div>
                                              )}
                                          </div>

                                          {/* Groomer — required, same select style as primary */}
                                          <div>
                                              <label className={labelClass}>Groomer</label>
                                              <select required className={inputClass} value={pet.groomerId || ''} onChange={e => updatePet('groomerId', e.target.value)} disabled={groomers.length === 0}>
                                                  <option value="">{groomers.length === 0 ? 'No Groomers Available' : 'Select Groomer'}</option>
                                                  {groomers.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                                              </select>
                                          </div>
                                      </div>

                                      {/* Hair Cut / Instructions — identical */}
                                      <div>
                                          <label className={labelClass}>Hair Cut / Instructions</label>
                                          <textarea className={`${inputClass} resize-none`} rows={2} value={pet.hairCut || ''} onChange={e => updatePet('hairCut', e.target.value)} placeholder="e.g. Summer cut..." />
                                      </div>
                                  </div>

                                  {/* ── ADD-ONS — identical to primary ── */}
                                  <div className="space-y-3 pt-2 border-t border-zinc-100">
                                      <h5 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                          <Plus className="w-3 h-3" /> Add-Ons
                                          <span className="text-gray-300 font-normal lowercase">(optional)</span>
                                      </h5>

                                      {/* Selected add-ons list */}
                                      {(pet.addonIds || []).length > 0 && (
                                          <div className="space-y-1.5">
                                              {(pet.addonIds || []).map((productId) => {
                                                  const p = products.find(pr => pr.id === productId);
                                                  if (!p) return null;
                                                  return (
                                                      <div key={productId} className="flex items-center justify-between bg-zinc-50 rounded-xl px-3 py-2 border border-zinc-100">
                                                          <div className="flex items-center gap-2 min-w-0">
                                                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${p.isService ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                  {p.isService ? 'SERVICE' : 'PRODUCT'}
                                                              </span>
                                                              <span className="text-sm font-bold text-zinc-800 truncate">{p.name}</span>
                                                              <span className="text-xs text-gray-400 flex-shrink-0">₱{p.price.toFixed(2)}</span>
                                                          </div>
                                                          <button type="button" onClick={() => updatePet('addonIds', (pet.addonIds || []).filter(id => id !== productId))}
                                                              className="ml-2 text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 flex-shrink-0">
                                                              <X className="w-3.5 h-3.5" />
                                                          </button>
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      )}

                                      {/* Searchable add-on input — identical to primary */}
                                      <div className="relative">
                                          <div className="relative">
                                              <input
                                                  type="text"
                                                  className={`${inputClass} pl-9`}
                                                  value={pet._addonSearch || ''}
                                                  onChange={e => { updatePet('_addonSearch', e.target.value); updatePet('_showAddonSug', true); }}
                                                  onFocus={() => updatePet('_showAddonSug', true)}
                                                  placeholder="Search products or services to add..."
                                                  autoComplete="off"
                                              />
                                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                          </div>
                                          {pet._showAddonSug && (
                                              <div className="absolute z-50 w-full bg-white mt-2 rounded-2xl shadow-xl border border-zinc-100 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                                  {/* Filter tabs — ALL / SERVICE / PRODUCT */}
                                                  <div className="flex border-b border-zinc-100 bg-zinc-50">
                                                      {(['ALL', 'SERVICE', 'PRODUCT'] as const).map(f => (
                                                          <button key={f} type="button" onClick={() => updatePet('_addonFilter', f)}
                                                              className={`flex-1 py-2 text-[11px] font-bold transition-all ${
                                                                  (pet._addonFilter || 'ALL') === f
                                                                      ? f === 'SERVICE' ? 'text-purple-600 border-b-2 border-purple-500 bg-white'
                                                                      : f === 'PRODUCT' ? 'text-blue-600 border-b-2 border-blue-500 bg-white'
                                                                      : 'text-zinc-900 border-b-2 border-zinc-900 bg-white'
                                                                      : 'text-gray-400 hover:text-gray-600'
                                                              }`}>
                                                              {f === 'ALL' ? 'All' : f === 'SERVICE' ? '✂️ Services' : '🛍️ Products'}
                                                          </button>
                                                      ))}
                                                  </div>
                                                  {/* Species + size badge */}
                                                  <div className="px-3 py-1.5 bg-zinc-50 border-b border-zinc-100 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                                      <span>{pet.petSpecies === 'DOG' ? '🐶' : pet.petSpecies === 'CAT' ? '🐱' : '🐾'}</span>
                                                      <span className="uppercase tracking-wider">{pet.petSpecies}</span>
                                                      {petDetectedSize && <><span>·</span><span className="text-purple-600">{petDetectedSize}</span></>}
                                                      <span className="ml-auto normal-case">Showing matching items</span>
                                                  </div>
                                                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                      {filteredPetAddons.length === 0 ? (
                                                          <div className="p-4 text-center text-gray-400 text-xs flex flex-col items-center gap-1">
                                                              <Search className="w-5 h-5 opacity-20" />
                                                              {pet._addonSearch ? `No results for "${pet._addonSearch}"` : 'All available items already added or none match the filter'}
                                                          </div>
                                                      ) : filteredPetAddons.map(p => (
                                                          <div key={p.id}
                                                              onClick={() => { updatePet('addonIds', [...(pet.addonIds || []), p.id]); updatePet('_addonSearch', ''); updatePet('_showAddonSug', false); }}
                                                              className="p-3.5 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 last:border-0 flex justify-between items-center group transition-colors">
                                                              <div className="flex items-center gap-2">
                                                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.isService ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                      {p.isService ? 'SERVICE' : 'PRODUCT'}
                                                                  </span>
                                                                  <span className="text-sm font-bold text-zinc-900 group-hover:text-purple-900">{p.name}</span>
                                                              </div>
                                                              <span className="text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded-lg border border-zinc-200 group-hover:bg-white group-hover:shadow-sm transition-all">₱{p.price}</span>
                                                          </div>
                                                      ))}
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      );
                  })}

                  {/* Add Another Pet — always at bottom so no scroll-up needed */}
                  <button
                      type="button"
                      onClick={() => setAdditionalPets(prev => [...prev, {
                          id: Date.now().toString(),
                          petName: '', petBreed: '', petColor: '', weightSize: '',
                          petSpecies: 'DOG', serviceId: '', hairCut: '',
                          groomerId: '',
                          addonIds: [],
                          _serviceSearch: '',
                          _showServiceSug: false,
                          _addonSearch: '',
                          _showAddonSug: false,
                          _addonFilter: 'ALL',
                          _showPetSug: false
                      }])}
                      className="w-full flex items-center justify-center gap-2 text-sm font-bold text-purple-700 bg-purple-50 border-2 border-dashed border-purple-200 px-3 py-3 rounded-2xl hover:bg-purple-100 hover:border-purple-300 transition-all"
                  >
                      <Plus className="w-4 h-4" /> Add Another Pet
                  </button>
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
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
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
        <div className="fixed inset-0 bg-purple-700/80 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-purple-800 rounded-2xl p-4 shadow-2xl relative flex flex-col h-[90vh]">
             <div className="flex justify-between items-center mb-4 text-white">
                 <h3 className="font-bold text-lg flex items-center gap-2"><Printer className="w-5 h-5" /> Receipt Preview</h3>
                 <button onClick={() => setShowReceiptPreview(false)} className="p-2 hover:bg-zinc-700 rounded-full">
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
