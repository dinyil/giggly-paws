
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, CartItem, Category, Transaction, StoreSettings, Discount, GroomingAppointment, Role, Client, Pet } from '../types';
import Button from '../components/ui/Button';
import { Search, ShoppingBag, Trash2, Plus, Minus, CreditCard, Bone, Dog, Printer, Check, X, Settings, ArrowRight, Scissors, DollarSign, User, ChevronDown, Tag, Percent, Info, CheckCircle, AlertCircle, MapPin, Pencil, Users } from '../components/ui/Icons';
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
  const { products, discounts, addTransaction, addAppointment, currentUser, productCategories, serviceCategories, storeSettings, clients, users, addClient } = useStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  
  const navigate = useNavigate();

  // ── New Client Form State (mirrors Clients page Add New Client) ──────
  const [ncFormData, setNcFormData] = useState({ ownerName: '', contactNumber: '', email: '', address: '', notes: '' });
  const [ncTempPets, setNcTempPets] = useState<Pet[]>([]);
  const [ncEditingPetIndex, setNcEditingPetIndex] = useState<number | null>(null);
  const [ncPetInput, setNcPetInput] = useState({ petName: '', petBreed: '', petColor: '', weightSize: '', species: '' as '' | 'DOG' | 'CAT' | 'OTHER', speciesOther: '' });

  const ncHandleAddPet = () => {
    if (!ncPetInput.petName || !ncPetInput.species) return;
    const newPet: Pet = { id: Date.now().toString() + Math.random().toString().slice(2,5), name: ncPetInput.petName, species: ncPetInput.species, speciesLabel: ncPetInput.species === 'OTHER' ? (ncPetInput.speciesOther || 'Other') : undefined, breed: ncPetInput.petBreed, color: ncPetInput.petColor, weightSize: ncPetInput.weightSize };
    setNcTempPets(prev => [...prev, newPet]);
    setNcPetInput({ petName: '', petBreed: '', petColor: '', weightSize: '', species: '', speciesOther: '' });
  };
  const ncResetForm = () => {
    setNcFormData({ ownerName: '', contactNumber: '', email: '', address: '', notes: '' });
    setNcTempPets([]);
    setNcEditingPetIndex(null);
    setNcPetInput({ petName: '', petBreed: '', petColor: '', weightSize: '', species: '', speciesOther: '' });
  };

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
  
  // Printer Settings — read from store settings (configured globally)
  const paperSize = (storeSettings.receiptPaperSize || '80mm') as '48mm' | '58mm' | '80mm';
  
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  // Grooming Details State
  const [groomingFormData, setGroomingFormData] = useState({
      ownerName: '', contactNumber: '', email: '', petName: '', petBreed: '', petColor: '', weightSize: '', groomerId: '', hairCut: ''
  });
  // Client Autocomplete Logic for POS
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // Services tab: pet species + weight filter
  const [serviceSpecies, setServiceSpecies] = useState<'DOG' | 'CAT' | 'OTHER' | null>(null);
  const [serviceWeightKg, setServiceWeightKg] = useState<string>('');
  // Modal to collect pet info before browsing services
  const [showServicePetModal, setShowServicePetModal] = useState(false);
  const [isNewClientMode, setIsNewClientMode] = useState(false);
  const [servicePetInfo, setServicePetInfo] = useState({
    ownerName: '', contactNumber: '', email: '', petName: '',
    species: '' as 'DOG' | 'CAT' | 'OTHER' | '',
    weightKg: '',
  });
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

  // Auto-detect dog size from weight input
  const detectSizeFromWeight = (kg: number) => {
    if (kg <= 2)  return 'XS';
    if (kg <= 5)  return 'S';
    if (kg <= 10) return 'M';
    if (kg <= 16) return 'L';
    if (kg <= 25) return 'XL';
    return 'XXL';
  };
  const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const serviceWeightNum = parseFloat(serviceWeightKg);
  const serviceDetectedSize: string | null = serviceSpecies === 'DOG'
    ? (!isNaN(serviceWeightNum) && serviceWeightNum > 0
        ? detectSizeFromWeight(serviceWeightNum)                        // numeric kg → detect size
        : VALID_SIZES.includes((serviceWeightKg || '').toUpperCase())
          ? (serviceWeightKg || '').toUpperCase()                       // already a size label (S, M, L…)
          : null)
    : null;


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

      // Species + size filtering for services
      if (activeTab === 'SERVICES' && serviceSpecies) {
        const species = (p as any).pet_species || (p as any).petSpecies || 'BOTH';
        // Species match: BOTH/null means available for all
        const speciesMatch = species === 'BOTH' || !species ||
          (serviceSpecies === 'DOG' && species === 'DOG') ||
          (serviceSpecies === 'CAT' && species === 'CAT') ||
          (serviceSpecies === 'OTHER' && (species === 'BOTH' || !species));
        if (!speciesMatch) return false;

        // Size filter (only for dogs with a detected size)
        if (serviceSpecies === 'DOG' && serviceDetectedSize) {
          const sizeCol = (p as any).weight_size_category || (p as any).weightSizeCategory;
          if (sizeCol && sizeCol !== 'ALL' && sizeCol !== serviceDetectedSize) return false;
        }
      }

      return matchesSearch && matchesCategory;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, activeCategory, activeTab, serviceSpecies, serviceDetectedSize]);

  // Pending service — holds an item the user tried to add before pet info was entered
  const [pendingServiceProduct, setPendingServiceProduct] = React.useState<Product | null>(null);

  // Cart Logic
  const addToCart = (product: Product) => {
    if (!product.isService && product.stock <= 0) return;

    // Guard: services require pet info first
    if (product.isService && !servicePetInfo.ownerName && !servicePetInfo.petName) {
      setPendingServiceProduct(product); // remember what they tried to add
      setIsNewClientMode(false);
      setShowServicePetModal(true);
      return;
    }

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
  
  const vatRate       = storeSettings.vatRate / 100;
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const vatAmount     = subtotalAfterDiscount * vatRate;          // VAT added ON TOP
  const total         = subtotalAfterDiscount + vatAmount;        // Total includes VAT


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

    // Appointments Logic — group ALL services into ONE appointment
    const serviceItems = cart.filter(i => i.isService);
    let hasServices = false;

    if (serviceItems.length > 0) {
        hasServices = true;
        const now = new Date();
        const instructions = groomingFormData.hairCut
            ? `${groomingFormData.hairCut} (Paid at POS Tx:#${transaction.id.slice(-4)})`
            : `Paid at POS (Tx: #${transaction.id.slice(-4)})`;

        // First service = main serviceId, rest = addonIds
        const allServiceIds: string[] = [];
        serviceItems.forEach(item => {
            for (let q = 0; q < item.quantity; q++) allServiceIds.push(item.id);
        });
        const [mainServiceId, ...addonServiceIds] = allServiceIds;

        const newApt: GroomingAppointment = {
            id: Date.now().toString() + Math.random().toString().slice(2, 5),
            petName: groomingFormData.petName,
            petBreed: groomingFormData.petBreed,
            petColor: groomingFormData.petColor,
            weightSize: groomingFormData.weightSize,
            ownerName: groomingFormData.ownerName,
            contactNumber: finalContactNumber,
            email: groomingFormData.email,
            groomerId: groomingFormData.groomerId,
            serviceId: mainServiceId,
            addonIds: addonServiceIds.length > 0 ? addonServiceIds : undefined,
            hairCut: instructions,
            date: now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
            time: now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' }),
            status: 'SCHEDULED',
        };
        addAppointment(newApt);
    }

    setCart([]);
    setIsCheckoutOpen(false);
    setIsMobileCartOpen(false); 
    setGcashRef('');
    setSplitCashAmount('');
    setCashReceived('');
    setGroomingFormData({ ownerName: '', contactNumber: '', email: '', petName: '', petBreed: '', petColor: '', weightSize: '', groomerId: '', hairCut: '' });
    setSelectedClient(null);

    // Always show receipt — if services were included, offer a shortcut to Grooming page
    setReceiptSuccessOpen(true);
  };

  const handleActualPrint = () => {
    // Inject @page rule with exact mm width and auto height.
    // index.css handles visibility isolation via visibility:hidden/visible.
    const existingStyle = document.getElementById('thermal-print-style');
    if (existingStyle) existingStyle.remove();
    const style = document.createElement('style');
    style.id = 'thermal-print-style';
    style.textContent = `@media print { @page { size: ${paperSize} auto; margin: 0mm; } }`;
    document.head.appendChild(style);
    setTimeout(() => { window.print(); }, 300);
  };

  const handleOpenPreview = () => {
      setPreviewOpen(true);
  };

  const handleTabChange = (tab: 'PRODUCTS' | 'SERVICES') => {
      setActiveTab(tab);
      setActiveCategory('ALL');
      // Open pet-info modal when entering services tab ONLY if no client is set yet
      if (tab === 'SERVICES') {
        if (!servicePetInfo.ownerName && !servicePetInfo.petName) {
          // No client chosen yet — prompt for info
          setIsNewClientMode(false);
          setServicePetInfo({ ownerName: '', contactNumber: '', email: '', petName: '', species: '', weightKg: '' });
          setShowServicePetModal(true);
        }
        // If client already chosen — keep existing info and species/size filter active
      } else {
        // Switching away from Services — preserve species filter so it's still set when returning
      }
  };


  const inputClass = "w-full border border-zinc-300 rounded-xl p-3 mt-1 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder-zinc-400 font-medium text-sm";
  const labelClass = "text-xs font-bold text-gray-500 uppercase";

  return (
    <>
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] lg:h-[calc(100vh-100px)] gap-6 print:hidden relative">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden h-full">
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 space-y-3">
          <div className="flex gap-4">
             <button onClick={() => handleTabChange('PRODUCTS')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'PRODUCTS' ? 'bg-purple-700 text-white shadow-lg' : 'bg-zinc-50 text-gray-500 hover:bg-zinc-100 border border-zinc-200'}`}>
                <Bone className="w-5 h-5" /> Products
             </button>
             <button onClick={() => handleTabChange('SERVICES')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'SERVICES' ? 'bg-purple-700 text-white shadow-lg' : 'bg-zinc-50 text-gray-500 hover:bg-zinc-100 border border-zinc-200'}`}>
                <Scissors className="w-5 h-5" /> Services
             </button>
          </div>

          {/* ── Active pet filter banner (Services tab) ───────────── */}
          {activeTab === 'SERVICES' && serviceSpecies && (
            <div className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-bold text-purple-800">
                <span>{serviceSpecies === 'DOG' ? '🐶' : serviceSpecies === 'CAT' ? '🐱' : '🐾'}</span>
                <span>
                  {servicePetInfo.petName || 'Pet'}
                  {serviceSpecies === 'DOG' && serviceDetectedSize && ` · ${serviceDetectedSize}`}
                  {servicePetInfo.ownerName && ` — ${servicePetInfo.ownerName}`}
                </span>
              </div>
              <button
                onClick={() => setShowServicePetModal(true)}
                className="text-xs text-purple-600 font-bold underline"
              >
                Edit
              </button>
            </div>
          )}
          {activeTab === 'SERVICES' && !serviceSpecies && (
            <button
              onClick={() => setShowServicePetModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-purple-300 text-purple-500 text-sm font-bold hover:bg-purple-50 transition-all"
            >
              <Scissors className="w-4 h-4" /> Select pet to filter services
            </button>
          )}

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
              <h3 className="font-bold text-zinc-900 text-sm group-hover:text-purple-900 leading-tight break-words w-full">{product.name}</h3>
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

      {/* Grooming Modal — smart: compact confirm if pre-filled, full form if walk-in */}
      <Dialog open={showGroomingModal} onClose={() => setShowGroomingModal(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <Dialog.Title className="text-xl font-bold mb-4 text-zinc-900 border-b border-zinc-100 pb-2">
              {groomingFormData.ownerName && groomingFormData.petName ? 'Confirm Grooming Details' : 'Walk-In Grooming Details'}
            </Dialog.Title>

            <form onSubmit={handleProceedToPayment} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">

              {/* ── PRE-FILLED MODE: client/pet info already captured ─────── */}
              {groomingFormData.ownerName && groomingFormData.petName ? (
                <>
                  {/* Read-only summary card */}
                  <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl">
                        {servicePetInfo.species === 'CAT' ? '🐱' : servicePetInfo.species === 'OTHER' ? '🐾' : '🐶'}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900">{groomingFormData.petName}</p>
                        <p className="text-xs text-gray-500">{groomingFormData.petBreed ? `${groomingFormData.petBreed} · ` : ''}{groomingFormData.weightSize || 'No weight'}</p>
                      </div>
                    </div>
                    <div className="border-t border-zinc-100 pt-3">
                      <p className="text-xs text-gray-400 uppercase font-bold mb-1">Owner</p>
                      <p className="text-sm font-bold text-zinc-900">{groomingFormData.ownerName}</p>
                      {groomingFormData.contactNumber && <p className="text-xs text-gray-500">{groomingFormData.contactNumber}</p>}
                    </div>
                    <button type="button" onClick={() => setGroomingFormData(prev => ({ ...prev, ownerName: '', petName: '' }))} className="text-[10px] text-purple-600 hover:underline font-bold">
                      ✎ Edit details
                    </button>
                  </div>

                  {/* Only ask for Groomer + Instructions */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Groomer <span className="text-red-500">*</span></label>
                      <select required className={`${inputClass} bg-white text-zinc-900`} value={groomingFormData.groomerId} onChange={e => setGroomingFormData({...groomingFormData, groomerId: e.target.value})} disabled={groomers.length === 0}>
                        <option value="">Select Groomer</option>
                        {groomers.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Instructions / Style</label>
                      <textarea className={`${inputClass} bg-white text-zinc-900 resize-none`} rows={2} value={groomingFormData.hairCut} onChange={e => setGroomingFormData({...groomingFormData, hairCut: e.target.value})} placeholder="Specific cut or notes..." />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* ── WALK-IN MODE: full form ──────────────────────────────── */}
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
                      <input required className={`${inputClass} bg-white text-zinc-900`} value={groomingFormData.contactNumber} onChange={e => setGroomingFormData({...groomingFormData, contactNumber: e.target.value})} onBlur={(e) => setGroomingFormData({...groomingFormData, contactNumber: sanitizeContactNumber(e.target.value)})} placeholder="09XX..." />
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
                </>
              )}

              <div className="pt-3 border-t border-zinc-100">
                {/* Skip option */}
                <button
                  type="button"
                  onClick={() => { setShowGroomingModal(false); setIsCheckoutOpen(true); }}
                  className="w-full text-xs text-zinc-400 hover:text-zinc-600 py-2 transition-colors underline underline-offset-2 mb-2"
                >
                  Skip details → Go straight to payment
                </button>
                <div className="flex gap-3">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowGroomingModal(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1">Proceed to Payment</Button>
                </div>
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
                        <div className="flex justify-between text-zinc-400 text-xs"><span>VAT ({storeSettings.vatRate}%)</span><span>+₱{vatAmount.toFixed(2)}</span></div>
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
      <Dialog
        open={receiptSuccessOpen}
        onClose={() => {
          setReceiptSuccessOpen(false);
          if (lastTransaction?.items?.some((i: any) => i.isService)) navigate('/grooming');
        }}
        className="relative z-50"
      >
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
                 <Button
                     variant="ghost"
                     onClick={() => {
                         setReceiptSuccessOpen(false);
                         if (lastTransaction?.items?.some((i: any) => i.isService)) navigate('/grooming');
                     }}
                     className="w-full text-zinc-500 hover:text-white hover:bg-transparent"
                 >
                     {lastTransaction?.items?.some((i: any) => i.isService) ? '✂️ Close & Go to Grooming' : 'Close'}
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

    {/* Hidden Print Layout — visible only during window.print() via injected @media print CSS */}
    {lastTransaction && (
      <div
        id="printable-content"
        style={{
          display: 'none',          // hidden normally; shown by injected @media print rule
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 'auto',
          backgroundColor: '#fff',
          zIndex: 9999,
          overflow: 'visible',
        }}
      >
        <ReceiptTemplate transaction={lastTransaction} settings={storeSettings} paperSize={paperSize} />
      </div>
    )}

    {/* ── Pet Info Modal — Existing / New Client ─────────────────────────── */}
    <Dialog open={showServicePetModal} onClose={() => setShowServicePetModal(false)} className="relative z-50">
      <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
          <Dialog.Title className="text-xl font-bold mb-3 text-zinc-900 border-b border-zinc-100 pb-2">
            Pet Info
          </Dialog.Title>

          {/* Existing / New toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setIsNewClientMode(false);
                setServicePetInfo(prev => ({ ...prev, petName: '', species: '', weightKg: '', contactNumber: '', email: '' }));
                setSelectedClient(null);
              }}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border ${!isNewClientMode ? 'bg-purple-700 text-white border-purple-700 shadow-md' : 'bg-zinc-50 text-gray-500 border-zinc-200 hover:border-purple-300'}`}
            >
              Existing Client
            </button>
            <button
              onClick={() => {
                setIsNewClientMode(true);
                setSelectedClient(null);
                setServicePetInfo({ ownerName: '', contactNumber: '', email: '', petName: '', species: '', weightKg: '' });
                ncResetForm();
              }}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border ${isNewClientMode ? 'bg-purple-700 text-white border-purple-700 shadow-md' : 'bg-zinc-50 text-gray-500 border-zinc-200 hover:border-purple-300'}`}
            >
              New Client
            </button>
          </div>

          {/* ── Owner search — OUTSIDE scroll area so dropdown is never clipped ── */}
          {!isNewClientMode && (
            <div className="relative mb-4" ref={clientDropdownRef} style={{ overflow: 'visible' }}>
              <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1 mb-2">
                <User className="w-3 h-3" /> Owner
              </h4>
              <label className={labelClass}>Owner Name</label>
              <div className="relative">
                <input
                  className={`${inputClass} pl-9`}
                  value={servicePetInfo.ownerName}
                  onChange={e => {
                    const val = e.target.value;
                    setServicePetInfo(prev => ({ ...prev, ownerName: val, petName: '', species: '' }));
                    setSelectedClient(null);
                    if (val.length > 0) {
                      const norm = normalizeText(val);
                      setFilteredClients(clients.filter(c =>
                        normalizeText(c.name).includes(norm) ||
                        (c.contactNumber && c.contactNumber.replace(/\D/g,'').includes(norm))
                      ).slice(0, 6));
                      setShowClientSuggestions(true);
                    } else {
                      setShowClientSuggestions(false);
                    }
                  }}
                  placeholder="Type to search existing client..."
                  autoComplete="off"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              </div>
              {showClientSuggestions && filteredClients.length > 0 && (
                <div className="absolute z-[9999] w-full bg-white mt-2 rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden ring-1 ring-black/5" style={{ top: '100%', left: 0 }}>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredClients.map(c => (
                      <div key={c.id}
                        onClick={() => {
                          setServicePetInfo(prev => ({ ...prev, ownerName: c.name, petName: '', species: '' }));
                          setSelectedClient(c);
                          setShowClientSuggestions(false);
                        }}
                        className="p-3.5 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 last:border-0 flex justify-between items-center group transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-zinc-900 group-hover:text-purple-900">{c.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            {c.contactNumber && <span>{c.contactNumber}</span>}
                            {(c.pets?.length ?? 0) > 0 && <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{c.pets!.length} Pet(s)</span>}
                          </p>
                        </div>
                        <ChevronDown className="-rotate-90 w-4 h-4 text-gray-300 group-hover:text-purple-900 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Pet picker — OUTSIDE scroll area so dropdown never clips ── */}
          {!isNewClientMode && selectedClient && (
            <div className="space-y-3 pt-2 border-t border-zinc-100 mb-2" style={{ overflow: 'visible' }}>
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                  <Dog className="w-3 h-3" /> Pet
                </h4>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold border border-blue-100">
                  {(selectedClient.pets?.length ?? 0) > 0 ? 'Select existing pet below' : 'No pets on record'}
                </span>
              </div>

              <div className="relative" ref={petDropdownRef} style={{ overflow: 'visible' }}>
                <label className={labelClass}>Pet Name</label>
                <input
                  className={inputClass}
                  value={servicePetInfo.petName}
                  onChange={e => {
                    setServicePetInfo(prev => ({ ...prev, petName: e.target.value, species: '' }));
                    if (selectedClient?.pets?.length) setShowPetSuggestions(true);
                  }}
                  onFocus={() => { if (selectedClient?.pets?.length) setShowPetSuggestions(true); }}
                  placeholder={selectedClient ? 'Click to select pet...' : "Pet's Name"}
                  autoComplete="off"
                />
                {showPetSuggestions && (selectedClient.pets?.length ?? 0) > 0 && (
                  <div className="absolute z-[9999] w-full bg-white mt-2 rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden ring-1 ring-black/5" style={{ top: '100%', left: 0 }}>
                    <div className="p-2.5 bg-zinc-50 text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-zinc-100">
                      {selectedClient.name}'s Pets
                    </div>
                    {selectedClient.pets!
                      .filter(p => normalizeText(p.name).includes(normalizeText(servicePetInfo.petName || '')))
                      .map((pet, i) => (
                        <div key={i}
                          onClick={() => {
                            const autoSpecies = (pet.species === 'CAT' ? 'CAT' : pet.species === 'OTHER' ? 'OTHER' : 'DOG') as 'DOG'|'CAT'|'OTHER';
                            // Auto-fill ALL pet + client details from DB
                            setServicePetInfo(prev => ({
                              ...prev,
                              ownerName: selectedClient.name,
                              contactNumber: selectedClient.contactNumber || '',
                              email: selectedClient.email || '',
                              petName: pet.name,
                              species: autoSpecies,
                              weightKg: pet.weightSize || '',
                              petBreed: pet.breed || '',
                              petColor: (pet as any).color || '',
                            }));
                            setShowPetSuggestions(false);
                          }}
                          className="p-3.5 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50 last:border-0 flex justify-between items-center group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{pet.species === 'CAT' ? '🐱' : pet.species === 'OTHER' ? '🐾' : '🐶'}</span>
                            <div>
                              <p className="text-sm font-bold text-zinc-900">{pet.name}</p>
                              <p className="text-xs text-gray-500">{pet.species || 'Dog'}{pet.breed ? ` · ${pet.breed}` : ''}</p>
                            </div>
                          </div>
                          <Check className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* ── Full confirmation card after pet is selected ── */}
              {servicePetInfo.species && servicePetInfo.petName && (
                <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl border border-purple-100 p-4 space-y-3 shadow-sm">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">✓ Client & Pet Details</p>
                    <button type="button" onClick={() => setServicePetInfo(prev => ({ ...prev, petName: '', species: '', petBreed: '', petColor: '', weightKg: '' }))} className="text-[10px] text-purple-400 hover:text-purple-700 font-bold hover:underline">✎ Change pet</button>
                  </div>

                  {/* Owner row */}
                  <div className="flex items-start gap-3 pb-3 border-b border-purple-100">
                    <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                      {servicePetInfo.ownerName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 text-sm truncate">{servicePetInfo.ownerName}</p>
                      {servicePetInfo.contactNumber && <p className="text-xs text-gray-500">{servicePetInfo.contactNumber}</p>}
                      {servicePetInfo.email && <p className="text-xs text-gray-400 truncate">{servicePetInfo.email}</p>}
                    </div>
                  </div>

                  {/* Pet row */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-xl flex-shrink-0">
                      {servicePetInfo.species === 'CAT' ? '🐱' : servicePetInfo.species === 'OTHER' ? '🐾' : '🐶'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 text-sm">{servicePetInfo.petName}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-gray-500">{servicePetInfo.species === 'CAT' ? 'Cat' : servicePetInfo.species === 'OTHER' ? 'Other' : 'Dog'}</span>
                        {(servicePetInfo as any).petBreed && <span className="text-xs text-gray-500">· {(servicePetInfo as any).petBreed}</span>}
                        {(servicePetInfo as any).petColor && <span className="text-xs text-gray-500">· {(servicePetInfo as any).petColor}</span>}
                        {servicePetInfo.weightKg && (() => {
                          const kg = parseFloat(servicePetInfo.weightKg);
                          if (!isNaN(kg) && kg > 0 && servicePetInfo.species === 'DOG') {
                            const sz = detectSizeFromWeight(kg);
                            const cols: Record<string,string> = { XS:'bg-sky-100 text-sky-700', S:'bg-green-100 text-green-700', M:'bg-yellow-100 text-yellow-700', L:'bg-orange-100 text-orange-700', XL:'bg-red-100 text-red-700', XXL:'bg-purple-100 text-purple-700' };
                            return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cols[sz]}`}>{kg}kg · {sz}</span>;
                          }
                          return <span className="text-xs text-gray-500">· {servicePetInfo.weightKg}</span>;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Only New Client form needs scrolling */}
          <div className="space-y-4 overflow-y-auto pr-1 custom-scrollbar">
            {/* ════════════════════════════════════════
                NEW CLIENT MODE — mirrors Clients page Add New Client form
                ════════════════════════════════════════ */}
            {isNewClientMode && (

              <>
                {/* 1. Owner Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Users className="w-3 h-3" /> Owner Details</h4>
                  <div>
                    <label className={labelClass}>Owner Name</label>
                    <input required className={inputClass} value={ncFormData.ownerName} onChange={e => setNcFormData({...ncFormData, ownerName: e.target.value})} placeholder="Name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Contact no.</label>
                      <input className={inputClass} value={ncFormData.contactNumber} onChange={e => setNcFormData({...ncFormData, contactNumber: e.target.value})} onBlur={e => setNcFormData({...ncFormData, contactNumber: sanitizeContactNumber(e.target.value)})} placeholder="09XX..." />
                    </div>
                    <div>
                      <label className={labelClass}>Email Address</label>
                      <input type="email" className={inputClass} value={ncFormData.email} onChange={e => setNcFormData({...ncFormData, email: e.target.value})} placeholder="email@example.com" />
                    </div>
                  </div>
                </div>

                {/* 2. Pet Details */}
                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Dog className="w-3 h-3" /> Pets ({ncTempPets.length})</h4>
                    <span className="text-[10px] text-gray-400 italic">Click a pet to edit</span>
                  </div>

                  {/* Added pets list */}
                  {ncTempPets.length > 0 && (
                    <div className="space-y-2 mb-4 bg-zinc-50 p-2 rounded-xl border border-zinc-100">
                      {ncTempPets.map((p, idx) => (
                        <div key={p.id || idx}
                          onClick={() => {
                            setNcEditingPetIndex(idx);
                            setNcPetInput({ petName: p.name, petBreed: p.breed || '', petColor: p.color || '', weightSize: p.weightSize || '', species: p.species || '', speciesOther: p.speciesLabel || '' });
                          }}
                          className={`flex justify-between items-center p-2 rounded-lg border shadow-sm cursor-pointer transition-all ${ncEditingPetIndex === idx ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-white border-zinc-200 hover:border-blue-300'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${ncEditingPetIndex === idx ? 'bg-blue-500 text-white' : 'bg-zinc-100'}`}>
                              {p.species === 'CAT' ? '🐱' : p.species === 'OTHER' ? '🐾' : '🐶'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-zinc-900">{p.name}</p>
                              <p className="text-[10px] text-gray-500 uppercase">{p.species === 'OTHER' ? (p.speciesLabel || 'Other') : p.species}{p.species ? ' · ' : ''}{p.breed || 'Unknown'}</p>
                            </div>
                          </div>
                          <button type="button" onClick={e => { e.stopPropagation(); setNcTempPets(prev => prev.filter((_, i) => i !== idx)); if (ncEditingPetIndex === idx) { setNcEditingPetIndex(null); setNcPetInput({ petName: '', petBreed: '', petColor: '', weightSize: '', species: '', speciesOther: '' }); } }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add/Edit Pet Form */}
                  <div className={`p-4 rounded-xl border relative transition-all ${ncEditingPetIndex !== null ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50/50 border-blue-100'}`}>
                    <p className={`text-xs font-bold mb-3 uppercase flex items-center gap-1 ${ncEditingPetIndex !== null ? 'text-yellow-700' : 'text-blue-600'}`}>
                      {ncEditingPetIndex !== null ? <Pencil className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {ncEditingPetIndex !== null ? 'Editing Pet Details' : 'Add New Pet'}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {/* Species Toggle */}
                      <div className="col-span-2">
                        <label className={labelClass}>Species <span className="text-red-500">*</span></label>
                        <div className="flex gap-2 mt-1">
                          {(['DOG', 'CAT', 'OTHER'] as const).map(s => (
                            <button key={s} type="button"
                              onClick={() => setNcPetInput({...ncPetInput, species: s, speciesOther: s !== 'OTHER' ? '' : ncPetInput.speciesOther})}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${ncPetInput.species === s ? s === 'DOG' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : s === 'CAT' ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-zinc-600 text-white border-zinc-600 shadow-md' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}
                            >
                              {s === 'DOG' ? '🐶 Dog' : s === 'CAT' ? '🐱 Cat' : '🐾 Other'}
                            </button>
                          ))}
                        </div>
                        {ncPetInput.species === 'OTHER' && (
                          <input type="text" className={`${inputClass} mt-2`} value={ncPetInput.speciesOther} onChange={e => setNcPetInput({...ncPetInput, speciesOther: e.target.value})} placeholder="e.g. Rabbit, Bird, Hamster..." autoFocus />
                        )}
                        {!ncPetInput.species && <p className="text-[10px] text-red-500 mt-1 font-medium">Please select a species to continue</p>}
                      </div>
                      <div>
                        <label className={labelClass}>Pet Name</label>
                        <input className={inputClass} value={ncPetInput.petName} onChange={e => setNcPetInput({...ncPetInput, petName: e.target.value})} placeholder="Pet Name" />
                      </div>
                      <div>
                        <label className={labelClass}>Breed</label>
                        <input className={inputClass} value={ncPetInput.petBreed} onChange={e => setNcPetInput({...ncPetInput, petBreed: e.target.value})} placeholder="Breed" />
                      </div>
                      <div>
                        <label className={labelClass}>Color</label>
                        <input className={inputClass} value={ncPetInput.petColor} onChange={e => setNcPetInput({...ncPetInput, petColor: e.target.value})} placeholder="Color" />
                      </div>
                      <div>
                        <label className={labelClass}>Weight / Size</label>
                        <input className={inputClass} value={ncPetInput.weightSize} onChange={e => setNcPetInput({...ncPetInput, weightSize: e.target.value})} placeholder="e.g. 5kg" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {ncEditingPetIndex !== null ? (
                        <>
                          <Button type="button" size="sm" variant="ghost" onClick={() => { setNcEditingPetIndex(null); setNcPetInput({ petName: '', petBreed: '', petColor: '', weightSize: '', species: '', speciesOther: '' }); }} className="flex-1 bg-white border border-zinc-200">Cancel</Button>
                          <Button type="button" size="sm" variant="primary" onClick={() => {
                            const updated = { ...ncTempPets[ncEditingPetIndex!], name: ncPetInput.petName, species: ncPetInput.species || undefined, speciesLabel: ncPetInput.species === 'OTHER' ? (ncPetInput.speciesOther || 'Other') : undefined, breed: ncPetInput.petBreed, color: ncPetInput.petColor, weightSize: ncPetInput.weightSize };
                            const newList = [...ncTempPets]; newList[ncEditingPetIndex!] = updated as Pet;
                            setNcTempPets(newList); setNcEditingPetIndex(null); setNcPetInput({ petName: '', petBreed: '', petColor: '', weightSize: '', species: '', speciesOther: '' });
                          }} className="flex-1 bg-yellow-500 hover:bg-yellow-600 border-yellow-600 text-white">Update Pet</Button>
                        </>
                      ) : (
                        <Button type="button" size="sm" variant="secondary" onClick={ncHandleAddPet} disabled={!ncPetInput.petName || !ncPetInput.species || (ncPetInput.species === 'OTHER' && !ncPetInput.speciesOther.trim())} className="w-full border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-40">
                          Add Pet to List
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Additional Info */}
                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><MapPin className="w-3 h-3" /> Additional Info</h4>
                  <div>
                    <label className={labelClass}>Address</label>
                    <input className={inputClass} value={ncFormData.address} onChange={e => setNcFormData({...ncFormData, address: e.target.value})} placeholder="City/Address..." />
                  </div>
                  <div>
                    <label className={labelClass}>Notes</label>
                    <textarea rows={2} className={`${inputClass} resize-none`} value={ncFormData.notes} onChange={e => setNcFormData({...ncFormData, notes: e.target.value})} placeholder="Important notes..." />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-zinc-100 mt-4">
            <button onClick={() => setShowServicePetModal(false)}
              className="flex-1 py-3 rounded-xl border border-zinc-200 text-gray-500 font-bold text-sm hover:bg-zinc-50 transition-colors">
              Cancel
            </button>

            {/* EXISTING CLIENT: Browse Services */}
            {!isNewClientMode && (
              <button
                disabled={!servicePetInfo.species}
                onClick={() => {
                  const kg = parseFloat(servicePetInfo.weightKg);
                  const SIZES = ['XS','S','M','L','XL','XXL'];
                  const resolvedSize = servicePetInfo.species === 'DOG'
                    ? (!isNaN(kg) && kg > 0
                        ? detectSizeFromWeight(kg)
                        : SIZES.includes((servicePetInfo.weightKg || '').toUpperCase())
                          ? (servicePetInfo.weightKg || '').toUpperCase()
                          : servicePetInfo.weightKg)
                    : servicePetInfo.weightKg;
                  setServiceSpecies(servicePetInfo.species as 'DOG'|'CAT'|'OTHER');
                  setServiceWeightKg(servicePetInfo.weightKg);
                  // Pass ALL details to groomingFormData — fully auto-filled from DB
                  setGroomingFormData(prev => ({
                    ...prev,
                    ownerName: servicePetInfo.ownerName,
                    contactNumber: servicePetInfo.contactNumber || prev.contactNumber,
                    email: servicePetInfo.email || prev.email,
                    petName: servicePetInfo.petName,
                    petBreed: (servicePetInfo as any).petBreed || prev.petBreed,
                    petColor: (servicePetInfo as any).petColor || prev.petColor,
                    weightSize: resolvedSize,
                  }));
                  setShowServicePetModal(false);
                  // Auto-add the service the user tried to click before setting pet info
                  if (pendingServiceProduct) {
                    setCart(prev => {
                      const existing = prev.find(i => i.id === pendingServiceProduct.id);
                      if (existing) return prev.map(i => i.id === pendingServiceProduct.id ? { ...i, quantity: i.quantity + 1 } : i);
                      return [...prev, { ...pendingServiceProduct, quantity: 1, appliedDiscounts: [] }];
                    });
                    setPendingServiceProduct(null);
                  }
                }}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${servicePetInfo.species ? 'bg-purple-700 text-white hover:bg-purple-800 shadow-lg' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}>
                Browse Services →
              </button>
            )}

            {/* NEW CLIENT: Save Client then browse */}
            {isNewClientMode && (
              <button
                disabled={!ncFormData.ownerName}
                onClick={() => {
                  // Build final pets list — auto-add if petInput has data but wasn't saved yet
                  let finalPets = [...ncTempPets];
                  if (ncEditingPetIndex === null && ncPetInput.petName && ncPetInput.species) {
                    finalPets.push({ id: Date.now().toString() + Math.random().toString().slice(2,5), name: ncPetInput.petName, species: ncPetInput.species, speciesLabel: ncPetInput.species === 'OTHER' ? (ncPetInput.speciesOther || 'Other') : undefined, breed: ncPetInput.petBreed, color: ncPetInput.petColor, weightSize: ncPetInput.weightSize });
                  }
                  const newClient: Client = { id: Date.now().toString(), name: ncFormData.ownerName, contactNumber: sanitizeContactNumber(ncFormData.contactNumber), email: ncFormData.email, address: ncFormData.address, notes: ncFormData.notes, pets: finalPets, firstSeen: new Date().toISOString() };
                  addClient(newClient);

                  // Auto-use first pet for service filter
                  const firstPet = finalPets[0];
                  if (firstPet) {
                    const sp = (firstPet.species === 'CAT' ? 'CAT' : firstPet.species === 'OTHER' ? 'OTHER' : 'DOG') as 'DOG'|'CAT'|'OTHER';
                    setServiceSpecies(sp);
                    setServiceWeightKg(firstPet.weightSize || '');
                    setServicePetInfo({ ownerName: ncFormData.ownerName, contactNumber: ncFormData.contactNumber, email: ncFormData.email, petName: firstPet.name, species: sp, weightKg: firstPet.weightSize || '' });
                    setGroomingFormData(prev => ({ ...prev, ownerName: ncFormData.ownerName, contactNumber: ncFormData.contactNumber, email: ncFormData.email, petName: firstPet.name, weightSize: firstPet.weightSize || '' }));
                  }
                  ncResetForm();
                  setShowServicePetModal(false);
                  // Auto-add the service the user tried to click before setting pet info
                  if (pendingServiceProduct) {
                    setCart(prev => {
                      const existing = prev.find(i => i.id === pendingServiceProduct.id);
                      if (existing) return prev.map(i => i.id === pendingServiceProduct.id ? { ...i, quantity: i.quantity + 1 } : i);
                      return [...prev, { ...pendingServiceProduct, quantity: 1, appliedDiscounts: [] }];
                    });
                    setPendingServiceProduct(null);
                  }
                }}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${ncFormData.ownerName ? 'bg-purple-700 text-white hover:bg-purple-800 shadow-lg' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}>
                Save Client →
              </button>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
    </>
  );
};

export default POS;
