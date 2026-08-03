
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, CartItem, Category, Transaction, StoreSettings, Discount, GroomingAppointment, Role, Client, Pet } from '../types';
import Button from '../components/ui/Button';
import { Search, ShoppingBag, Trash2, Plus, Minus, CreditCard, Bone, Dog, Printer, Check, X, Settings, ArrowRight, Scissors, DollarSign, User, ChevronDown, Tag, Percent, Info, CheckCircle, AlertCircle } from '../components/ui/Icons';
import { Dialog } from '@headlessui/react';
import ReceiptTemplate from '../components/ReceiptTemplate';
import { useNavigate } from 'react-router-dom';

// Helper for loose search matching
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
    // Case: 0917... (Already correct) -> Keep as is
    
    return cleaned;
};

// Reusable Cart UI Component
interface CartPanelProps {
    cart: CartItem[];
    updateQuantity: (id: string, delta: number) => void;
    removeFromCart: (id: string) => void;
    openDiscountModal: () => void;
    openBreakdownModal: (item: CartItem) => void; 
    onRemoveAllDiscountsClick: () => void; // Changed from direct action to open modal
    subtotal: number;
    discountAmount: number;
    total: number;
    onCheckout: () => void;
    onClose?: () => void; 
}

const CartPanel: React.FC<CartPanelProps> = ({ 
    cart, updateQuantity, removeFromCart, openDiscountModal, openBreakdownModal, onRemoveAllDiscountsClick,
    subtotal, discountAmount, total, onCheckout, onClose
}) => {
    
    // Calculate percentage for display
    const discountPercentage = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;

    return (
        <div className="flex flex-col h-full bg-white lg:rounded-3xl shadow-xl border border-zinc-100 overflow-hidden">
            <div className="p-5 border-b border-zinc-100 bg-zinc-50 lg:rounded-t-3xl flex justify-between items-center z-10 relative">
                <h2 className="font-bold text-lg flex items-center gap-2 text-zinc-900">
                    <ShoppingBag className="w-5 h-5" />
                    Current Order
                </h2>
                {onClose && (
                    <button onClick={onClose} className="lg:hidden p-2 text-gray-500 hover:bg-zinc-200 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <ShoppingBag className="w-12 h-12 mb-2 opacity-20" />
                        <p>Cart is empty</p>
                    </div>
                ) : (
                    cart.map(item => {
                        const isMaxStock = !item.isService && item.quantity >= item.stock;
                        const discounts = item.appliedDiscounts || [];
                        const hasDiscount = discounts.length > 0;

                        // Calculate display price per unit with discount
                        const originalTotal = item.price * item.quantity;
                        let totalDiscountValue = 0;
                        
                        // Additive Discount Calculation
                        discounts.forEach(d => {
                            if (d.type === 'PERCENTAGE') {
                                totalDiscountValue += originalTotal * (d.value / 100);
                            } else {
                                totalDiscountValue += d.value * item.quantity;
                            }
                        });
                        
                        // CAP: Ensure we don't discount more than the price (100% Max Rule)
                        totalDiscountValue = Math.min(totalDiscountValue, originalTotal);
                        
                        return (
                            <div 
                                key={item.id} 
                                className={`flex items-center gap-3 bg-white p-3 rounded-2xl border shadow-sm relative group hover:z-50 transition-all ${
                                    hasDiscount ? 'border-green-200 bg-green-50/30' : 'border-zinc-100'
                                }`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-sm text-zinc-900 line-clamp-1">{item.name}</p>
                                        {isMaxStock && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">MAX</span>}
                                        
                                        {/* IMPROVED Discount Icon Badge with Custom Tooltip */}
                                        {hasDiscount && (
                                            <div className="relative group/tooltip inline-block">
                                                <button 
                                                    onClick={() => openBreakdownModal(item)}
                                                    className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold hover:bg-green-200 transition-colors cursor-help border border-green-200"
                                                >
                                                    <Tag className="w-3 h-3" />
                                                    <span>{discounts.length > 1 ? `${discounts.length} Promos` : discounts[0].name}</span>
                                                </button>
                                                
                                                {/* Custom Hover Tooltip - Positioned DOWN (top-full) to avoid being covered by header */}
                                                <div className="absolute top-full left-0 mt-2 w-56 hidden group-hover/tooltip:block z-[9999] animate-fade-in origin-top-left">
                                                    <div className="bg-purple-900 text-white text-xs rounded-xl p-3 shadow-2xl border border-zinc-700 relative">
                                                        <div className="flex justify-between items-center mb-2 border-b border-zinc-700 pb-1">
                                                            <span className="font-bold text-zinc-300">Active Promos</span>
                                                            <span className="text-[10px] bg-purple-800 px-1.5 rounded">
                                                                Max 100%
                                                            </span>
                                                        </div>
                                                        <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                                            {discounts.map((d, idx) => (
                                                                <div key={d.id + idx} className="flex justify-between items-center">
                                                                    <span className="truncate max-w-[120px] text-zinc-300">{d.name}</span>
                                                                    <span className="text-green-400 font-mono font-bold">
                                                                        {d.type === 'PERCENTAGE' ? `${d.value}%` : `₱${d.value}`}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-2 pt-1 border-t border-zinc-700 flex justify-between font-bold text-green-400">
                                                            <span>Total Off:</span>
                                                            <span>-₱{totalDiscountValue.toFixed(2)}</span>
                                                        </div>
                                                        {/* Arrow pointing up */}
                                                        <div className="absolute bottom-full left-4 -mb-px border-4 border-transparent border-b-zinc-900"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 items-end mt-1">
                                        <p className="text-xs text-gray-500">₱{item.price} each</p>
                                        {hasDiscount && (
                                            <p className="text-xs text-green-600 font-bold">(-₱{totalDiscountValue.toFixed(2)})</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1">
                                    <button
                                        onClick={() => updateQuantity(item.id, -1)}
                                        className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm hover:bg-zinc-50 active:scale-95 transition-all text-zinc-900"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm font-bold w-8 text-center text-zinc-900">{item.quantity}</span>
                                    <button
                                        onClick={() => updateQuantity(item.id, 1)}
                                        disabled={isMaxStock}
                                        className={`w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm transition-all text-zinc-900 ${isMaxStock ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50 active:scale-95'
                                            }`}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                
                                <button
                                    onClick={() => removeFromCart(item.id)}
                                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                                    title="Remove Item"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )
                    })
                )}
            </div>

            <div className="p-5 text-white lg:rounded-b-3xl mt-auto shadow-inner z-20 relative" style={{background: 'linear-gradient(135deg, #3D2468, #6B4FA0)'}}>
                <div className="mb-4 space-y-2">
                    <button 
                        onClick={openDiscountModal}
                        className="w-full border border-white/20 hover:bg-white/10 text-white rounded-xl p-3 text-sm font-bold flex items-center justify-center gap-2 transition-all"
                        style={{background: 'rgba(255,255,255,0.1)'}}
                        disabled={cart.length === 0}
                    >
                        <Percent className="w-4 h-4" /> Apply Discount / Promo
                    </button>
                    
                    {/* Remove All Discounts Button */}
                    {discountAmount > 0 && (
                        <button
                            onClick={onRemoveAllDiscountsClick}
                            className="w-full bg-red-900/30 border border-red-900/50 hover:bg-red-900/50 text-red-300 rounded-xl p-2 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                        >
                            <Trash2 className="w-3 h-3" /> Remove All Discounts
                        </button>
                    )}
                </div>

                <div className="space-y-2 text-sm mb-4 border-t border-white/20 pt-4">
                    <div className="flex justify-between text-purple-200"><span>Subtotal</span><span>₱{subtotal.toFixed(2)}</span></div>
                    <div className="flex justify-between text-purple-200">
                        <span>Total Discount</span>
                        <div className="text-right">
                            <span className="text-yellow-300 block">-₱{discountAmount.toFixed(2)}</span>
                            {discountAmount > 0 && (
                                <span className="text-[10px] text-purple-300 font-mono">({discountPercentage.toFixed(1)}%)</span>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-white/20">
                        <span>Total</span>
                        <span style={{color: '#F5D657'}}>₱{total.toFixed(2)}</span>
                    </div>
                </div>
                
                <button
                    className="w-full font-bold text-lg py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    style={{background: '#F5D657', color: '#4A2D7A'}}
                    disabled={cart.length === 0}
                    onClick={onCheckout}
                >
                    Checkout
                </button>
            </div>
        </div>
    );
}

const POS: React.FC = () => {
  const { products, discounts, addTransaction, addAppointment, currentUser, productCategories, serviceCategories, storeSettings, clients, users } = useStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  
  const navigate = useNavigate();

  // New: Tab state for splitting Products and Services
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'SERVICES'>('PRODUCTS');
  const [activeCategory, setActiveCategory] = useState<string | 'ALL'>('ALL');
  
  // Checkout Modals
  const [showGroomingModal, setShowGroomingModal] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Discount Management
  const [isDiscountManagerOpen, setIsDiscountManagerOpen] = useState(false);
  const [selectedDiscountToApply, setSelectedDiscountToApply] = useState<Discount | null>(null);
  const [itemSelectionForDiscount, setItemSelectionForDiscount] = useState<string[]>([]); // Array of CartItem IDs
  const [isRemoveDiscountModalOpen, setIsRemoveDiscountModalOpen] = useState(false); // Confirmation for remove all
  
  // Item Specific Discount Breakdown
  const [breakdownItem, setBreakdownItem] = useState<CartItem | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH' | 'SPLIT'>('CASH');
  const [gcashRef, setGcashRef] = useState('');
  const [splitCashAmount, setSplitCashAmount] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<string>(''); // For CASH payment change calc
  
  // Input Refs for Auto-Scroll Validation
  const cashInputRef = useRef<HTMLInputElement>(null);
  const gcashRefInputRef = useRef<HTMLInputElement>(null);
  const checkoutScrollRef = useRef<HTMLDivElement>(null); // For Auto-Scrolling Modal

  // Mobile UI States
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Modal States
  const [receiptSuccessOpen, setReceiptSuccessOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  
  // Printer Settings
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('80mm');
  
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  // Grooming Details State
  const [groomingFormData, setGroomingFormData] = useState({
      ownerName: '', contactNumber: '', email: '', petName: '', petBreed: '', petColor: '', weightSize: '', groomerId: '', hairCut: ''
  });
  // Client Autocomplete Logic for POS
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Pet Autocomplete Logic
  const [showPetSuggestions, setShowPetSuggestions] = useState(false);
  const petDropdownRef = useRef<HTMLDivElement>(null);

  const groomers = users.filter(u => u.role === Role.GROOMER || u.role === 'GROOMER');

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
              setShowClientSuggestions(false);
          }
          if (petDropdownRef.current && !petDropdownRef.current.contains(event.target as Node)) {
              setShowPetSuggestions(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-scroll logic when payment method changes
  useEffect(() => {
      if (isCheckoutOpen && checkoutScrollRef.current) {
          checkoutScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  }, [paymentMethod, isCheckoutOpen]);

  // --- CLIENT & PET LOGIC (SAME AS BEFORE) ---
  const handleOwnerSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setGroomingFormData(prev => ({...prev, ownerName: val}));
      if(selectedClient && selectedClient.name !== val) setSelectedClient(null);
      if (val.length > 0) {
          const normalizedSearch = normalizeText(val);
          const matches = clients.filter(c => 
              normalizeText(c.name).includes(normalizedSearch) || 
              (c.contactNumber && c.contactNumber.replace(/\D/g,'').includes(normalizedSearch))
          );
          setFilteredClients(matches.slice(0, 5));
          setShowClientSuggestions(true);
      } else {
          setShowClientSuggestions(false);
      }
  };

  const selectClient = (client: Client) => {
      setGroomingFormData(prev => ({
          ...prev,
          ownerName: client.name,
          contactNumber: client.contactNumber,
          email: client.email || '',
          petName: '', petBreed: '', petColor: '', weightSize: ''
      }));
      setSelectedClient(client);
      setShowClientSuggestions(false);
  };

  const handlePetNameFocus = () => {
      if (selectedClient && selectedClient.pets && selectedClient.pets.length > 0) {
          setShowPetSuggestions(true);
      }
  };

  const selectPet = (pet: Pet) => {
      setGroomingFormData(prev => ({
          ...prev,
          petName: pet.name,
          petBreed: pet.breed || '',
          petColor: pet.color || '',
          weightSize: pet.weightSize || ''
      }));
      setShowPetSuggestions(false);
  };

  // Determine which categories to show based on active tab
  const currentCategories = activeTab === 'PRODUCTS' ? productCategories : serviceCategories;

  // Filtering Logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const isService = p.isService;
      if (activeTab === 'PRODUCTS' && isService) return false;
      if (activeTab === 'SERVICES' && !isService) return false;
      const normalizedSearch = normalizeText(search);
      const normalizedName = normalizeText(p.name);
      const matchesSearch = normalizedName.includes(normalizedSearch);
      const matchesCategory = activeCategory === 'ALL' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, activeCategory, activeTab]);

  // Cart Logic
  const addToCart = (product: Product) => {
    if (!product.isService && product.stock <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (!product.isService && existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1, appliedDiscounts: [] }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          if (newQty < 1) return item;
          if (!item.isService && newQty > item.stock) return item;
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  // --- DISCOUNT MANAGEMENT ---

  // Removes a specific discount from a cart item
  const removeSpecificDiscount = (itemId: string, discountId: string) => {
      setCart(prev => prev.map(item => {
          if (item.id === itemId) {
              return { 
                  ...item, 
                  appliedDiscounts: (item.appliedDiscounts || []).filter(d => d.id !== discountId)
              };
          }
          return item;
      }));
      // Also update the breakdown modal view if it's open for this item
      if (breakdownItem && breakdownItem.id === itemId) {
          setBreakdownItem(prev => prev ? {
              ...prev,
              appliedDiscounts: (prev.appliedDiscounts || []).filter(d => d.id !== discountId)
          } : null);
      }
  };

  // Triggered by the "Remove All Discounts" button - opens confirmation modal
  const handleRemoveAllDiscountsClick = () => {
      const hasDiscounts = cart.some(item => item.appliedDiscounts && item.appliedDiscounts.length > 0);
      if (!hasDiscounts) return;
      setIsRemoveDiscountModalOpen(true);
  };

  // Actual action to clear discounts
  const confirmRemoveAllDiscounts = () => {
      setCart(prev => prev.map(item => ({ ...item, appliedDiscounts: [] })));
      setIsRemoveDiscountModalOpen(false);
  };

  const handleOpenDiscountManager = () => {
      setSelectedDiscountToApply(null);
      setItemSelectionForDiscount([]);
      setIsDiscountManagerOpen(true);
  };

  const handleToggleItemForDiscount = (itemId: string) => {
      // Toggle logic
      setItemSelectionForDiscount(prev => 
          prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
      );
  };

  const handleSelectAllForDiscount = () => {
      // Filter out items that already have this discount to find eligible ones
      const eligibleItems = cart.filter(item => 
          !item.appliedDiscounts?.some(d => d.id === selectedDiscountToApply?.id)
      );
      
      const eligibleIds = eligibleItems.map(i => i.id);

      // If all eligible are selected, deselect. Else select all eligible.
      const allSelected = eligibleIds.length > 0 && eligibleIds.every(id => itemSelectionForDiscount.includes(id));
      
      if (allSelected) {
          setItemSelectionForDiscount([]);
      } else {
          setItemSelectionForDiscount(eligibleIds);
      }
  };

  const applySelectedDiscount = () => {
      if (!selectedDiscountToApply) return;
      
      setCart(prev => prev.map(item => {
          if (itemSelectionForDiscount.includes(item.id)) {
              // Append to existing array, ensure no duplicates (safety check)
              const existing = item.appliedDiscounts || [];
              if (existing.some(d => d.id === selectedDiscountToApply.id)) {
                  return item;
              }
              return { ...item, appliedDiscounts: [...existing, selectedDiscountToApply] };
          }
          return item;
      }));
      
      setIsDiscountManagerOpen(false);
  };

  // --- TOTALS CALCULATION (Updated for Multiple Discounts) ---
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  const discountAmount = cart.reduce((sum, item) => {
      const discounts = item.appliedDiscounts || [];
      if (discounts.length === 0) return sum;

      const originalItemTotal = item.price * item.quantity;
      let itemDiscount = 0;
      
      discounts.forEach(d => {
          if (d.type === 'PERCENTAGE') {
              itemDiscount += originalItemTotal * (d.value / 100);
          } else {
              itemDiscount += d.value * item.quantity;
          }
      });
      
      // Cap discount at item total price (can't go below zero) - 100% Rule
      return sum + Math.min(itemDiscount, originalItemTotal);
  }, 0);
  
  const total = Math.max(0, subtotal - discountAmount);
  const vatRate = storeSettings.vatRate / 100;
  const vatAmount = (total / (1 + vatRate)) * vatRate; 

  // --- CHECKOUT HANDLERS ---
  const handleCheckoutClick = () => {
      const hasService = cart.some(item => item.isService);
      if (hasService) {
          setShowGroomingModal(true);
      } else {
          setIsCheckoutOpen(true);
      }
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
      e.preventDefault();
      
      // Sanitization Check before proceeding (In case user didn't blur)
      const sanitizedContact = sanitizeContactNumber(groomingFormData.contactNumber);
      if (sanitizedContact !== groomingFormData.contactNumber) {
          setGroomingFormData(prev => ({ ...prev, contactNumber: sanitizedContact }));
      }

      if (!groomingFormData.ownerName || !groomingFormData.petName || !groomingFormData.groomerId) {
          alert("Please fill in Owner Name, Pet Name, and select a Groomer.");
          return;
      }
      setShowGroomingModal(false);
      setIsCheckoutOpen(true);
  };

  const handleFinalizeTransaction = () => {
    if (paymentMethod === 'CASH') {
        const received = Number(cashReceived);
        if (!cashReceived || isNaN(received) || received <= 0) {
            alert('Please enter the cash amount received.');
            if (cashInputRef.current) {
                cashInputRef.current.focus();
                cashInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        if (received < total) {
            alert(`Insufficient cash. Total is ₱${total.toFixed(2)} but received ₱${received.toFixed(2)}.`);
            if (cashInputRef.current) {
                cashInputRef.current.focus();
            }
            return;
        }
    }
    if (paymentMethod === 'GCASH' && !gcashRef) {
      alert('Please enter GCash Reference Number');
      if (gcashRefInputRef.current) {
          gcashRefInputRef.current.focus();
          gcashRefInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    if (paymentMethod === 'SPLIT') {
        const cash = Number(splitCashAmount);
        if (isNaN(cash) || cash <= 0) { 
            alert("Please enter a valid Cash amount"); 
            if (cashInputRef.current) {
                cashInputRef.current.focus();
                cashInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return; 
        }
        if (cash >= total) { 
            alert("Cash amount covers the total. Please switch to 'CASH' payment method."); 
            return; 
        }
        if (!gcashRef) { 
            alert('Please enter GCash Reference Number for the balance'); 
            if (gcashRefInputRef.current) {
                gcashRefInputRef.current.focus();
                gcashRefInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return; 
        }
    }
    
    // Auto-sanitize one last time for safety
    const finalContactNumber = sanitizeContactNumber(groomingFormData.contactNumber);

    // Create Transaction
    const transaction: Transaction = {
      id: Date.now().toString(),
      items: [...cart],
      subtotal,
      vat: vatAmount,
      total,
      discount: discountAmount,
      paymentMethod,
      gcashRef: (paymentMethod === 'GCASH' || paymentMethod === 'SPLIT') ? gcashRef : undefined,
      cashReceived: paymentMethod === 'CASH' ? Number(cashReceived) : paymentMethod === 'SPLIT' ? Number(splitCashAmount) : undefined,
      date: new Date().toISOString(),
      cashierId: currentUser?.id || 'unknown',
    };

    addTransaction(transaction);
    setLastTransaction(transaction);

    // Appointments Logic
    const serviceItems = cart.filter(i => i.isService);
    let hasServices = false;

    if (serviceItems.length > 0) {
        hasServices = true;
        serviceItems.forEach(item => {
            for(let i=0; i < item.quantity; i++) {
                const now = new Date();
                const instructions = groomingFormData.hairCut 
                    ? `${groomingFormData.hairCut} (Paid at POS Tx:#${transaction.id.slice(-4)})`
                    : `Paid at POS (Tx: #${transaction.id.slice(-4)})`;

                const newApt: GroomingAppointment = {
                    id: Date.now().toString() + Math.random().toString().slice(2, 5),
                    petName: groomingFormData.petName,
                    petBreed: groomingFormData.petBreed,
                    petColor: groomingFormData.petColor,
                    weightSize: groomingFormData.weightSize,
                    ownerName: groomingFormData.ownerName,
                    contactNumber: finalContactNumber, // Use sanitized
                    email: groomingFormData.email,
                    groomerId: groomingFormData.groomerId,
                    serviceId: item.id,
                    hairCut: instructions,
                    date: now.toLocaleDateString('en-CA', {timeZone: 'Asia/Manila'}),
                    time: now.toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Manila'}),
                    status: 'SCHEDULED',
                };
                addAppointment(newApt);
            }
        });
    }

    setCart([]);
    setIsCheckoutOpen(false);
    setIsMobileCartOpen(false); 
    setGcashRef('');
    setSplitCashAmount('');
    setCashReceived('');
    setGroomingFormData({ ownerName: '', contactNumber: '', email: '', petName: '', petBreed: '', petColor: '', weightSize: '', groomerId: '', hairCut: '' });
    setSelectedClient(null);

    if (hasServices) {
        navigate('/grooming'); 
    } else {
        setReceiptSuccessOpen(true); 
    }
  };

  const handleActualPrint = () => {
    setTimeout(() => { window.print(); }, 500);
  };

  const handleOpenPreview = () => {
      setPreviewOpen(true);
  };

  const handleTabChange = (tab: 'PRODUCTS' | 'SERVICES') => {
      setActiveTab(tab);
      setActiveCategory('ALL');
  };

  const inputClass = "w-full border border-zinc-300 rounded-xl p-3 mt-1 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder-zinc-400 font-medium text-sm";
  const labelClass = "text-xs font-bold text-gray-500 uppercase";

  return (
    <>
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] lg:h-[calc(100vh-100px)] gap-6 print:hidden relative">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden h-full">
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 space-y-4">
          <div className="flex gap-4">
             <button onClick={() => handleTabChange('PRODUCTS')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'PRODUCTS' ? 'bg-purple-700 text-white shadow-lg' : 'bg-zinc-50 text-gray-500 hover:bg-zinc-100 border border-zinc-200'}`}>
                <Bone className="w-5 h-5" /> Products
             </button>
             <button onClick={() => handleTabChange('SERVICES')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'SERVICES' ? 'bg-purple-700 text-white shadow-lg' : 'bg-zinc-50 text-gray-500 hover:bg-zinc-100 border border-zinc-200'}`}>
                <Scissors className="w-5 h-5" /> Services
             </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder={`Search ${activeTab === 'PRODUCTS' ? 'products' : 'services'}...`} className="w-full pl-10 pr-4 py-3 bg-white text-zinc-900 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <Button size="sm" variant={activeCategory === 'ALL' ? 'primary' : 'secondary'} onClick={() => setActiveCategory('ALL')}>All</Button>
            {currentCategories.map(cat => (
              <Button key={cat} size="sm" variant={activeCategory === cat ? 'primary' : 'secondary'} onClick={() => setActiveCategory(cat)}>{cat}</Button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start pb-24 lg:pb-4">
          {filteredProducts.map(product => {
            const isOutOfStock = !product.isService && product.stock <= 0;
            return (
            <button key={product.id} onClick={() => !isOutOfStock && addToCart(product)} disabled={isOutOfStock} className={`group flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-200 ${isOutOfStock ? 'border-zinc-100 bg-zinc-50 opacity-60 cursor-not-allowed' : 'border-zinc-100 hover:border-purple-700 hover:shadow-lg bg-zinc-50/50'}`}>
              <div className={`w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm transition-transform ${!isOutOfStock && 'group-hover:scale-110'}`}>
                {product.isService ? <Scissors className="w-8 h-8 text-purple-900" /> : <ShoppingBag className="w-8 h-8 text-purple-900" />}
              </div>
              <h3 className="font-bold text-zinc-900 text-sm line-clamp-1 group-hover:text-purple-900">{product.name}</h3>
              <p className="text-zinc-500 text-xs font-bold mt-1">₱{product.price}</p>
              {!product.isService && (
                 <span className={`text-[10px] mt-2 px-2 py-0.5 rounded-full font-bold ${product.stock > 10 ? 'bg-green-100 text-green-700' : isOutOfStock ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {isOutOfStock ? 'Out of Stock' : `${product.stock} left`}
                 </span>
              )}
            </button>
            )
          })}
        </div>
      </div>

      {/* Cart (Desktop) */}
      <div className="hidden lg:block w-96 h-full flex-shrink-0">
         <CartPanel 
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            openDiscountModal={handleOpenDiscountManager}
            openBreakdownModal={setBreakdownItem}
            onRemoveAllDiscountsClick={handleRemoveAllDiscountsClick}
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={total}
            onCheckout={handleCheckoutClick}
         />
      </div>

      {/* Mobile Cart Toggle */}
      <div className="lg:hidden fixed bottom-4 right-4 left-4 z-40">
          <button 
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center font-bold"
            style={{background: "linear-gradient(135deg, #4A2D7A, #7B55A8)"}}
          >
              <div className="flex items-center gap-3">
                  <div className="bg-purple-800 w-8 h-8 rounded-full flex items-center justify-center text-sm">{totalItems}</div>
                  <span>View Cart</span>
              </div>
              <span>₱{total.toFixed(2)}</span>
          </button>
      </div>

      {/* Mobile Cart Modal */}
      {isMobileCartOpen && (
          <div className="lg:hidden fixed inset-0 bg-white z-50 animate-slide-up">
              <CartPanel 
                cart={cart}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
                openDiscountModal={handleOpenDiscountManager}
                openBreakdownModal={setBreakdownItem}
                onRemoveAllDiscountsClick={handleRemoveAllDiscountsClick}
                subtotal={subtotal}
                discountAmount={discountAmount}
                total={total}
                onCheckout={handleCheckoutClick}
                onClose={() => setIsMobileCartOpen(false)}
             />
          </div>
      )}

      {/* Grooming Modal */}
      <Dialog open={showGroomingModal} onClose={() => setShowGroomingModal(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <Dialog.Title className="text-xl font-bold mb-4 text-zinc-900 border-b border-zinc-100 pb-2">
              Walk-In Grooming Details
            </Dialog.Title>
            
            <form onSubmit={handleProceedToPayment} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                {/* Search / Select Owner */}
                <div className="relative" ref={clientDropdownRef}>
                    <label className={labelClass}>Owner Name</label>
                    <div className="relative">
                        <input 
                            required 
                            className={`${inputClass} pl-9 bg-white text-zinc-900`}
                            value={groomingFormData.ownerName} 
                            onChange={handleOwnerSearch} 
                            onFocus={(e) => handleOwnerSearch(e)}
                            placeholder="Type to search..." 
                            autoComplete="off"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    </div>
                    {showClientSuggestions && filteredClients.length > 0 && (
                        <div className="absolute z-50 w-full bg-white mt-1 rounded-xl shadow-xl border border-zinc-100 overflow-hidden">
                            {filteredClients.map(c => (
                                <div key={c.id} onClick={() => selectClient(c)} className="p-3 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 flex justify-between">
                                    <span className="font-bold text-sm text-zinc-900">{c.name}</span>
                                    <span className="text-xs text-gray-500">{c.contactNumber}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Contact #</label>
                        <input 
                            required 
                            className={`${inputClass} bg-white text-zinc-900`}
                            value={groomingFormData.contactNumber} 
                            onChange={e => setGroomingFormData({...groomingFormData, contactNumber: e.target.value})} 
                            onBlur={(e) => setGroomingFormData({...groomingFormData, contactNumber: sanitizeContactNumber(e.target.value)})}
                            placeholder="09XX..." 
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Email (Optional)</label>
                        <input type="email" className={`${inputClass} bg-white text-zinc-900`} value={groomingFormData.email} onChange={e => setGroomingFormData({...groomingFormData, email: e.target.value})} placeholder="email@ex.com" />
                    </div>
                </div>

                {/* Pet Details */}
                <div className="pt-2 border-t border-zinc-100 mt-2">
                    <div className="relative" ref={petDropdownRef}>
                        <label className="text-xs font-bold text-gray-500 uppercase">Pet Name</label>
                        <input 
                            required 
                            className={`${inputClass} bg-white text-zinc-900`}
                            value={groomingFormData.petName} 
                            onChange={e => {
                                setGroomingFormData({...groomingFormData, petName: e.target.value});
                                if (selectedClient && selectedClient.pets && selectedClient.pets.length > 0) setShowPetSuggestions(true);
                            }}
                            onFocus={handlePetNameFocus}
                            placeholder="Pet's Name" 
                            autoComplete="off"
                        />
                        {showPetSuggestions && selectedClient && selectedClient.pets.length > 0 && (
                            <div className="absolute z-50 w-full bg-white mt-1 rounded-xl shadow-xl border border-zinc-100 overflow-hidden">
                                {selectedClient.pets.filter(p => normalizeText(p.name).includes(normalizeText(groomingFormData.petName))).map(p => (
                                    <div key={p.id} onClick={() => selectPet(p)} className="p-3 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50">
                                        <p className="font-bold text-sm text-zinc-900">{p.name}</p>
                                        <p className="text-xs text-gray-500">{p.breed}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-3">
                        <div><label className="text-xs font-bold text-gray-500 uppercase">Breed</label><input className={`${inputClass} bg-white text-zinc-900`} value={groomingFormData.petBreed} onChange={e => setGroomingFormData({...groomingFormData, petBreed: e.target.value})} /></div>
                        <div><label className="text-xs font-bold text-gray-500 uppercase">Color</label><input className={`${inputClass} bg-white text-zinc-900`} value={groomingFormData.petColor} onChange={e => setGroomingFormData({...groomingFormData, petColor: e.target.value})} /></div>
                        <div><label className="text-xs font-bold text-gray-500 uppercase">Weight/Size</label><input className={`${inputClass} bg-white text-zinc-900`} value={groomingFormData.weightSize} onChange={e => setGroomingFormData({...groomingFormData, weightSize: e.target.value})} /></div>
                    </div>
                </div>

                {/* Service Details */}
                <div className="pt-2 border-t border-zinc-100 mt-2">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Groomer</label>
                        <select required className={`${inputClass} bg-white text-zinc-900`} value={groomingFormData.groomerId} onChange={e => setGroomingFormData({...groomingFormData, groomerId: e.target.value})} disabled={groomers.length === 0}>
                            <option value="">Select Groomer</option>
                            {groomers.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                        </select>
                    </div>
                    <div className="mt-3">
                        <label className="text-xs font-bold text-gray-500 uppercase">Instructions / Style</label>
                        <textarea className={`${inputClass} bg-white text-zinc-900 resize-none`} rows={2} value={groomingFormData.hairCut} onChange={e => setGroomingFormData({...groomingFormData, hairCut: e.target.value})} placeholder="Specific cut or notes..." />
                    </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-zinc-100">
                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowGroomingModal(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1">Proceed to Payment</Button>
                </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-white rounded-3xl shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
            
            {/* Header Section (Fixed) */}
            <div className="p-6 pb-4 border-b border-zinc-100 flex-shrink-0">
                <h2 className="text-xl font-bold text-zinc-900 mb-4">Order Summary & Payment</h2>
                
                {/* Order Summary Section */}
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                    <div className="space-y-1 text-sm text-zinc-600 mb-2 border-b border-zinc-200 pb-2">
                        <div className="flex justify-between"><span>Items ({totalItems})</span><span>₱{subtotal.toFixed(2)}</span></div>
                        {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₱{discountAmount.toFixed(2)}</span></div>}
                        <div className="flex justify-between text-zinc-400 text-xs"><span>VAT (% Included)</span><span>₱{vatAmount.toFixed(2)}</span></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <span className="font-bold text-lg text-zinc-900">TOTAL TO PAY</span>
                        <span className="font-bold text-lg text-zinc-900">₱{total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div ref={checkoutScrollRef} className="flex-1 overflow-y-auto p-6 pt-0 custom-scrollbar">
                <p className="text-gray-500 text-sm font-bold mb-3 mt-4">Select Payment Method</p>

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
                    {paymentMethod === 'CASH' && (
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100 animate-fade-in space-y-3">
                            <div>
                                <label className="text-xs font-bold text-green-800 uppercase ml-1 block mb-1">Cash Received</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">₱</span>
                                    <input
                                        autoFocus
                                        type="number"
                                        ref={cashInputRef}
                                        className="w-full pl-8 border border-green-200 rounded-lg p-3 font-mono text-xl focus:ring-2 focus:ring-green-500 outline-none bg-white text-zinc-900"
                                        placeholder="0.00"
                                        value={cashReceived}
                                        onChange={e => setCashReceived(e.target.value)}
                                        min={0}
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            {/* Quick amount buttons */}
                            <div className="grid grid-cols-4 gap-2">
                                {[20, 50, 100, 200, 500, 1000].filter(v => v >= total).slice(0, 4).concat(
                                    [20, 50, 100, 200, 500, 1000].filter(v => v < total).slice(-2)
                                ).slice(0, 4).map(amt => (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setCashReceived(String(amt))}
                                        className="py-2 text-xs font-bold border border-green-200 rounded-lg bg-white hover:bg-green-100 text-green-800 transition-colors"
                                    >
                                        ₱{amt}
                                    </button>
                                ))}
                            </div>

                            {/* Change Display */}
                            <div className={`rounded-xl p-3 text-center border-2 transition-all ${
                                Number(cashReceived) >= total
                                    ? 'bg-white border-green-400'
                                    : Number(cashReceived) > 0
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-white border-green-100'
                            }`}>
                                {Number(cashReceived) > 0 && Number(cashReceived) < total ? (
                                    <>
                                        <p className="text-[10px] font-bold text-red-400 uppercase">Short By</p>
                                        <p className="text-2xl font-bold text-red-500">₱{(total - Number(cashReceived)).toFixed(2)}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-[10px] font-bold text-green-600 uppercase">Change</p>
                                        <p className={`text-3xl font-bold ${
                                            Number(cashReceived) >= total ? 'text-green-600' : 'text-gray-300'
                                        }`}>
                                            ₱{Math.max(0, Number(cashReceived) - total).toFixed(2)}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'GCASH' && (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in">
                            {storeSettings.gcashQr ? (
                                <div className="mb-4 flex justify-center">
                                    <div className="relative cursor-pointer transition-transform duration-300 hover:scale-105" onClick={() => setIsQrZoomed(true)}>
                                        <img src={storeSettings.gcashQr} alt="GCash QR" className="w-32 h-32 object-contain rounded-lg bg-white border border-blue-200" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-purple-700/10 rounded-lg opacity-0 hover:opacity-100 transition-opacity"><Search className="w-6 h-6 text-white"/></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-32 flex items-center justify-center bg-white border border-blue-200 rounded-lg mb-4 text-gray-400 text-xs flex-col gap-1">
                                    <CreditCard className="w-8 h-8 opacity-20" />
                                    <span>NO QR CODE AVAILABLE</span>
                                    <span className="text-[10px]">Please upload a GCash QR in Settings.</span>
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
                            <div className="bg-white rounded-lg p-3 border border-purple-100 text-center">
                                <p className="text-xs text-purple-400 font-bold uppercase mb-2">SPLIT BREAKDOWN</p>
                                {storeSettings.gcashQr ? (
                                    <div className="flex justify-center mb-2">
                                        <div className="relative cursor-pointer transition-transform duration-300 hover:scale-105" onClick={() => setIsQrZoomed(true)}>
                                            <img src={storeSettings.gcashQr} alt="GCash QR" className="w-20 h-20 object-contain rounded-lg bg-white border border-purple-200" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-2 border border-dashed border-purple-200 rounded mb-2 text-xs text-purple-300">No QR Code Setup</div>
                                )}
                            </div>

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
                                        ₱{Math.max(0, total - (Number(splitCashAmount) || 0)).toFixed(2)}
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

            {/* Footer Actions (Fixed) */}
            <div className="p-6 pt-4 border-t border-zinc-100 flex-shrink-0 flex gap-3">
                <Button variant="ghost" onClick={() => setIsCheckoutOpen(false)} className="flex-1">
                    Cancel
                </Button>
                <Button onClick={handleFinalizeTransaction} className="flex-[2] text-lg shadow-xl">
                    Confirm & Process
                </Button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Success / Receipt Modal */}
      <Dialog open={receiptSuccessOpen} onClose={() => setReceiptSuccessOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/80 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm bg-purple-900 rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-blue-500"></div>
             
             <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
                 <Check className="w-10 h-10 text-white" />
             </div>
             
             <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
             <p className="text-zinc-400 mb-8">Transaction has been recorded.</p>
             
             <div className="flex flex-col gap-3">
                 <Button onClick={handleActualPrint} className="w-full bg-white text-purple-900 hover:bg-zinc-200 font-bold shadow-lg">
                     <Printer className="w-4 h-4 mr-2" /> Print Receipt
                 </Button>
                 <Button onClick={handleOpenPreview} className="w-full bg-blue-600 text-white border border-blue-500 hover:bg-blue-500 shadow-blue-900/30">
                     Preview Receipt
                 </Button>
                 <Button variant="ghost" onClick={() => setReceiptSuccessOpen(false)} className="w-full text-zinc-500 hover:text-white hover:bg-transparent">
                     Close
                 </Button>
             </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Discount Manager Modal */}
      <Dialog open={isDiscountManagerOpen} onClose={() => setIsDiscountManagerOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <Dialog.Title className="text-xl font-bold mb-4 text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-2">
                <Percent className="w-5 h-5" /> Manage Discounts
            </Dialog.Title>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                
                {/* 1. Select Discount */}
                <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Choose a Promo / Discount</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {discounts.filter(d => d.active).map(discount => (
                            <button
                                key={discount.id}
                                onClick={() => {
                                    setSelectedDiscountToApply(discount);
                                    // Auto-select eligible items logic could go here but let's keep it manual or "Select All"
                                }}
                                className={`p-3 rounded-xl border text-left transition-all relative ${
                                    selectedDiscountToApply?.id === discount.id 
                                    ? 'bg-purple-700 text-white border-purple-700 shadow-lg ring-2 ring-purple-300 ring-offset-2' 
                                    : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400'
                                }`}
                            >
                                <span className="block font-bold text-sm truncate">{discount.name}</span>
                                <span className={`text-xs font-bold ${selectedDiscountToApply?.id === discount.id ? 'text-zinc-300' : 'text-green-600'}`}>
                                    {discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `₱${discount.value} OFF`}
                                </span>
                                {/* Badge for Rules */}
                                {discount.triggerType !== 'MANUAL' && (
                                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" title="Has conditions"></span>
                                )}
                            </button>
                        ))}
                        {discounts.filter(d => d.active).length === 0 && (
                            <p className="col-span-full text-sm text-gray-400 italic text-center py-4">No active discounts configured.</p>
                        )}
                    </div>
                </div>

                {/* 2. Select Items */}
                {selectedDiscountToApply && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase">Apply to Items</h4>
                            <button 
                                onClick={handleSelectAllForDiscount}
                                className="text-xs text-blue-600 font-bold hover:underline"
                            >
                                Select Eligible
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            {cart.map(item => {
                                // Check compatibility if needed, for now allow all
                                const isSelected = itemSelectionForDiscount.includes(item.id);
                                const hasThisDiscount = item.appliedDiscounts?.some(d => d.id === selectedDiscountToApply.id);
                                
                                return (
                                    <div 
                                        key={item.id} 
                                        onClick={() => {
                                            if (!hasThisDiscount) handleToggleItemForDiscount(item.id);
                                        }}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                            hasThisDiscount 
                                                ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' 
                                                : isSelected 
                                                    ? 'bg-green-50 border-green-300 cursor-pointer' 
                                                    : 'bg-white border-zinc-200 hover:bg-zinc-50 cursor-pointer'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}>
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-zinc-900">{item.name}</p>
                                                <p className="text-xs text-gray-500">{item.quantity} x ₱{item.price}</p>
                                            </div>
                                        </div>
                                        {hasThisDiscount && <span className="text-[10px] bg-gray-200 px-2 py-1 rounded text-gray-600 font-bold">Applied</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            <div className="pt-4 mt-4 border-t border-zinc-100 flex gap-3">
                <Button variant="ghost" onClick={() => setIsDiscountManagerOpen(false)} className="flex-1">Cancel</Button>
                <Button 
                    className="flex-1" 
                    disabled={!selectedDiscountToApply || itemSelectionForDiscount.length === 0}
                    onClick={applySelectedDiscount}
                >
                    Apply Discount
                </Button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Remove All Discounts Confirmation Modal */}
      <Dialog open={isRemoveDiscountModalOpen} onClose={() => setIsRemoveDiscountModalOpen(false)} className="relative z-[60]">
        <div className="fixed inset-0 bg-purple-700/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto text-red-600">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Remove All Discounts?</Dialog.Title>
                    <p className="text-sm text-gray-500 mt-2">
                        Are you sure you want to clear <strong>all</strong> applied promos and discounts from the current order?
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setIsRemoveDiscountModalOpen(false)} className="flex-1">
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmRemoveAllDiscounts} className="flex-1">
                        Yes, Remove All
                    </Button>
                </div>
            </Dialog.Panel>
        </div>
      </Dialog>

      {/* Item Breakdown Modal */}
      <Dialog open={!!breakdownItem} onClose={() => setBreakdownItem(null)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-lg text-zinc-900">{breakdownItem?.name}</h3>
                        <p className="text-xs text-gray-500">Quantity: {breakdownItem?.quantity} | Price: ₱{breakdownItem?.price}</p>
                    </div>
                    <button onClick={() => setBreakdownItem(null)} className="p-1 hover:bg-zinc-100 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                <div className="space-y-3 mb-6">
                    <h4 className="text-xs font-bold text-gray-400 uppercase border-b border-zinc-100 pb-1">Applied Discounts</h4>
                    {breakdownItem?.appliedDiscounts && breakdownItem.appliedDiscounts.length > 0 ? (
                        breakdownItem.appliedDiscounts.map(d => (
                            <div key={d.id} className="flex justify-between items-center bg-green-50 p-2 rounded-lg border border-green-100">
                                <span className="text-sm font-bold text-green-800">{d.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-green-700">
                                        {d.type === 'PERCENTAGE' ? `${d.value}%` : `₱${d.value}`}
                                    </span>
                                    <button 
                                        onClick={() => removeSpecificDiscount(breakdownItem.id, d.id)}
                                        className="text-red-400 hover:text-red-600 p-1"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-gray-400 italic">No discounts applied.</p>
                    )}
                </div>
            </Dialog.Panel>
        </div>
      </Dialog>

      {/* Preview Modal (Full Receipt) */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/80 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-purple-800 rounded-2xl p-4 shadow-2xl relative flex flex-col h-[90vh]">
             <div className="flex justify-between items-center mb-4 text-white">
                 <h3 className="font-bold text-lg flex items-center gap-2"><Printer className="w-5 h-5" /> Receipt Preview</h3>
                 <button onClick={() => setPreviewOpen(false)} className="p-2 hover:bg-zinc-700 rounded-full">
                     <X className="w-5 h-5" />
                 </button>
             </div>
             
             {/* Preview Controls */}
             <div className="bg-zinc-700/50 p-3 rounded-xl mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                    <Settings className="w-4 h-4" />
                    <span className="text-sm font-bold">Paper Size</span>
                </div>
                <div className="flex bg-purple-900 rounded-lg p-1">
                    <button onClick={() => setPaperSize('58mm')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${paperSize === '58mm' ? 'bg-white text-purple-900' : 'text-gray-400 hover:text-white'}`}>58mm</button>
                    <button onClick={() => setPaperSize('80mm')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${paperSize === '80mm' ? 'bg-white text-purple-900' : 'text-gray-400 hover:text-white'}`}>80mm</button>
                </div>
             </div>

             <div className="flex-1 overflow-auto bg-zinc-700/50 rounded-xl p-6 flex justify-center items-start">
                 <div className="shadow-2xl shadow-black/50 transition-all duration-300">
                     {lastTransaction && <ReceiptTemplate transaction={lastTransaction} settings={storeSettings} paperSize={paperSize} isPreview={true} />}
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

      {/* QR Code Full Screen Overlay as a Dialog to handle stacking properly */}
      <Dialog open={isQrZoomed} onClose={() => setIsQrZoomed(false)} className="relative z-[100]">
        <div className="fixed inset-0 bg-purple-700/90 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-8" onClick={() => setIsQrZoomed(false)}>
            <Dialog.Panel className="relative max-w-full max-h-full flex flex-col items-center animate-fade-in">
                <img 
                    src={storeSettings.gcashQr} 
                    alt="Large GCash QR" 
                    className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl bg-white p-2" 
                />
                <p className="mt-6 text-white font-bold text-lg animate-pulse tracking-wide bg-purple-700/50 px-4 py-2 rounded-full backdrop-blur-md">
                    Tap anywhere to close
                </p>
            </Dialog.Panel>
        </div>
      </Dialog>
    </div>

    {/* Hidden Print Layout */}
    {lastTransaction && (
      <div id="printable-content" className="hidden print:block fixed inset-0 bg-white z-[9999] p-2">
          <ReceiptTemplate transaction={lastTransaction} settings={storeSettings} paperSize={paperSize} />
      </div>
    )}
    </>
  );
};

export default POS;
