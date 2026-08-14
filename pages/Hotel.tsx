
import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../context/StoreContext';
import { HotelRoom, HotelBooking, HotelBookingStatus, Role, Client, Pet, Transaction } from '../types';
import ReceiptTemplate from '../components/ReceiptTemplate';
import AdminPinModal from '../components/AdminPinModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import {
  BedDouble, Plus, X, Pencil, Trash2, Search, Calendar, CalendarDays,
  CheckCircle, Clock, Ban, Building2, ConciergeBell, LogIn, ChevronLeft,
  ChevronRight, Phone, Mail, User, SlidersHorizontal, Check, Printer,
  ArrowRight, RotateCcw, AlertCircle, Dog, Wallet, CreditCard, Star
} from '../components/ui/Icons';

// ─── helpers ────────────────────────────────────────────────────────────────

const getPhToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const addDays = (date: string, n: number): string => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const diffDays = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

const fmtDate = (d: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const normalizeText = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

// ─── Official Giggly Paws Hotel Rate Matrix ────────────────────────────────────

export type BookingTypeKey = 'DAYCARE' | 'OVERNIGHT' | 'STAYCATION_3D2N' | 'STAYCATION_4D3N' | 'VACATION';
export type PetSizeKey = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export const BOOKING_TYPE_LABELS: Record<BookingTypeKey, string> = {
  DAYCARE:          'Daycare (9AM–5:30PM)',
  OVERNIGHT:        'Overnight (9AM–9AM)',
  STAYCATION_3D2N:  'Staycation · 3 Days & 2 Nights',
  STAYCATION_4D3N:  'Staycation · 4 Days & 3 Nights (FREE Basic Groom)',
  VACATION:         'Vacation · 7 Days & 6 Nights (FREE Luxury Groom)',
};

export const BOOKING_TYPE_NIGHTS: Record<BookingTypeKey, number> = {
  DAYCARE:          1,
  OVERNIGHT:        1,
  STAYCATION_3D2N:  3,
  STAYCATION_4D3N:  4,
  VACATION:         7,
};

export const PET_SIZES: PetSizeKey[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const HOTEL_RATES: Record<BookingTypeKey, Record<PetSizeKey, number>> = {
  DAYCARE:         { XS: 400,  S: 450,  M: 500,  L: 650,  XL: 700,  XXL: 800  },
  OVERNIGHT:       { XS: 700,  S: 800,  M: 850,  L: 1100, XL: 1200, XXL: 1500 },
  STAYCATION_3D2N: { XS: 1300, S: 1500, M: 1600, L: 2100, XL: 2300, XXL: 3800 },
  STAYCATION_4D3N: { XS: 2000, S: 2300, M: 2450, L: 3200, XL: 3500, XXL: 4400 },
  VACATION:        { XS: 4000, S: 4600, M: 4900, L: 6400, XL: 7000, XXL: 8800 },
};

// Late checkout rates: [XS/S/M rate, L/XL/XXL rate]
export const LATE_CHECKOUT_RATES: { label: string; small: number | 'daycare'; large: number | 'daycare' }[] = [
  { label: '1 Hour Late', small: 100, large: 150 },
  { label: '2 Hours Late', small: 200, large: 300 },
  { label: '3 Hours Late (Daycare Fee)', small: 'daycare', large: 'daycare' },
];

// Additional hotel services (flat fees)
export const HOTEL_EXTRAS = [
  { id: 'meal-boiled-chicken', label: 'Meal Prep: Boiled Chicken w/ Veggies', price: 150 },
  { id: 'reheat-food', label: 'Reheating (per overnight stay)', price: 100 },
  { id: 'special-instruction', label: 'Special Instruction (per overnight stay)', price: 250 },
];

type HotelTab = 'UPCOMING' | 'ARRIVING' | 'OCCUPIED' | 'COMPLETED';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: HotelBookingStatus }> = ({ status }) => {
  const map: Record<HotelBookingStatus, { label: string; cls: string }> = {
    RESERVED:    { label: 'RESERVED',    cls: 'bg-amber-100 text-amber-700' },
    CHECKED_IN:  { label: 'CHECKED IN',  cls: 'bg-blue-100 text-blue-700 animate-pulse' },
    CHECKED_OUT: { label: 'DONE',        cls: 'bg-green-100 text-green-700' },
    CANCELLED:   { label: 'CANCELLED',   cls: 'bg-zinc-100 text-zinc-500' },
  };
  const { label, cls } = map[status];
  return <span className={`text-xs font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${cls}`}>{label}</span>;
};

// ─── Room Form Modal ─────────────────────────────────────────────────────────

const RoomForm: React.FC<{ room?: HotelRoom | null; onSave: (r: HotelRoom) => void; onClose: () => void }> = ({ room, onSave, onClose }) => {
  const [form, setForm] = useState({
    room_number: room?.room_number || '',
    room_name: room?.room_name || '',
    room_type: room?.room_type || 'Standard',
    capacity: room?.capacity || 1,
    description: room?.description || '',
    is_active: room?.is_active ?? true,
  });
  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));
  const [showRates, setShowRates] = useState(false);

  const canSave = form.room_number.trim() && form.room_name.trim();

  return (
    <div className="fixed inset-0 bg-purple-700/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-zinc-900">{room?.id ? 'Edit Room' : 'Add New Room'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Room No. *</label>
              <input value={form.room_number} onChange={e => set('room_number', e.target.value)} placeholder="A1" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Room Name *</label>
              <input value={form.room_name} onChange={e => set('room_name', e.target.value)} placeholder="Sunny Suite" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Type</label>
              <input value={form.room_type} onChange={e => set('room_type', e.target.value)} placeholder="Standard / Deluxe" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Max Pets</label>
              <input type="number" min={1} value={form.capacity} onChange={e => set('capacity', parseInt(e.target.value) || 1)} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none" />
          </div>

          {/* Rate matrix info box */}
          <div className="bg-purple-50 border border-purple-100 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRates(r => !r)}
              className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div>
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">📊 Giggly Paws Rate Matrix</p>
                <p className="text-xs text-purple-400 mt-0.5">Rates are auto-calculated by booking type × pet size</p>
              </div>
              <span className="text-purple-500 text-lg">{showRates ? '▲' : '▼'}</span>
            </button>
            {showRates && (
              <div className="px-4 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-purple-100">
                        <th className="text-left py-1.5 font-bold text-purple-600 pr-2">Type</th>
                        {PET_SIZES.map(s => <th key={s} className="text-center py-1.5 font-bold text-purple-600 px-1">{s}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(Object.keys(BOOKING_TYPE_LABELS) as BookingTypeKey[]).map(type => (
                        <tr key={type} className="border-b border-purple-50 last:border-0">
                          <td className="py-1.5 pr-2 text-zinc-600 font-medium whitespace-nowrap">
                            {type === 'DAYCARE' ? '☀️' : type === 'OVERNIGHT' ? '🌙' : type === 'STAYCATION_3D2N' ? '🏠' : type === 'STAYCATION_4D3N' ? '🏡' : '🌴'}{' '}
                            {type === 'DAYCARE' ? 'Daycare' : type === 'OVERNIGHT' ? 'Overnight' : type === 'STAYCATION_3D2N' ? '3D2N' : type === 'STAYCATION_4D3N' ? '4D3N' : 'Vacation'}
                          </td>
                          {PET_SIZES.map(s => (
                            <td key={s} className="text-center py-1.5 px-1 text-zinc-700 font-semibold">₱{HOTEL_RATES[type][s].toLocaleString()}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-10 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-purple-700' : 'bg-zinc-300'}`} onClick={() => set('is_active', !form.is_active)}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_active ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-sm font-medium text-zinc-700">{form.is_active ? 'Active (bookable)' : 'Inactive'}</span>
          </label>
        </div>
        <div className="p-6 pt-0 flex gap-3 sticky bottom-0 bg-white border-t border-zinc-100">
          <button onClick={onClose} className="flex-1 border border-zinc-200 text-zinc-700 py-3 rounded-xl font-semibold hover:bg-zinc-50">Cancel</button>
          <button
            onClick={() => {
              if (!canSave) return;
              onSave({ id: room?.id || crypto.randomUUID(), ...form, daily_rate: 0 });
            }}
            disabled={!canSave}
            className="flex-1 bg-purple-700 text-white py-3 rounded-xl font-semibold hover:bg-purple-800 disabled:opacity-40"
          >Save Room</button>
        </div>
      </div>
    </div>
  );
};

// ─── Size Helper ─────────────────────────────────────────────────────────────

const getSizeFromWeight = (weightSize: string): PetSizeKey | null => {
  if (!weightSize) return null;
  const ws = weightSize.toUpperCase().trim();
  if (['XS','S','M','L','XL','XXL'].includes(ws)) return ws as PetSizeKey;
  const kg = parseFloat(ws);
  if (isNaN(kg)) return null;
  if (kg <= 2) return 'XS';
  if (kg <= 5) return 'S';
  if (kg <= 10) return 'M';
  if (kg <= 16) return 'L';
  if (kg <= 25) return 'XL';
  return 'XXL';
};

// ─── Booking Form Modal ───────────────────────────────────────────────────────

const BookingForm: React.FC<{
  booking?: HotelBooking | null;
  preselectedRoomId?: string;
  preselectedDate?: string;
  onSave: (b: HotelBooking) => void;
  onClose: () => void;
}> = ({ booking, preselectedRoomId, preselectedDate, onSave, onClose }) => {
  const { hotelRooms, hotelBookings, clients, currentUser, addClient, storeSettings } = useStore();
  const today = getPhToday();
  const activeRooms = hotelRooms.filter(r => r.is_active);

  // Live rates with DB overrides
  const activeRates: Record<BookingTypeKey, Record<PetSizeKey, number>> = {
    ...HOTEL_RATES,
    ...(storeSettings.hotelRates as Record<BookingTypeKey, Record<PetSizeKey, number>> | undefined),
  } as Record<BookingTypeKey, Record<PetSizeKey, number>>;
  const activeLabels: Record<BookingTypeKey, string> = {
    ...BOOKING_TYPE_LABELS,
    ...(storeSettings.hotelBookingTypeLabels as Record<BookingTypeKey, string> | undefined),
  } as Record<BookingTypeKey, string>;
  const activeExtras: { id: string; label: string; price: number }[] =
    storeSettings.hotelExtras && storeSettings.hotelExtras.length > 0
      ? storeSettings.hotelExtras
      : HOTEL_EXTRAS;

  // ── Wizard step ──
  const [step, setStep] = useState<1 | 2>(1);

  // ── Booking type & size ──
  const existingType = (booking?.booking_type as BookingTypeKey) || 'OVERNIGHT';
  const existingSize = (booking?.pet_size as PetSizeKey) || 'S';
  const [bookingType, setBookingType] = useState<BookingTypeKey>(existingType);
  const [petSize, setPetSize] = useState<PetSizeKey>(existingSize);

  const defaultCheckIn = booking?.check_in || preselectedDate || today;
  const defaultCheckOut = booking?.check_out || addDays(defaultCheckIn, BOOKING_TYPE_NIGHTS[existingType]);
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);

  useEffect(() => {
    setCheckOut(addDays(checkIn, BOOKING_TYPE_NIGHTS[bookingType]));
  }, [bookingType]);

  // ── Client mode ──
  const [clientMode, setClientMode] = useState<'EXISTING' | 'NEW'>(booking?.client_id ? 'EXISTING' : 'EXISTING');

  // ── Existing client ──
  const [clientSearch, setClientSearch] = useState(booking?.owner_name || '');
  const [showClientSugg, setShowClientSugg] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const clientRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{top:number;left:number;width:number} | null>(null);

  useEffect(() => {
    if (booking?.client_id) {
      const c = clients.find(x => x.id === booking.client_id);
      if (c) {
        setSelectedClient(c);
        setClientSearch(c.name);
        const p = c.pets.find(p => p.id === booking.pet_id);
        if (p) { setSelectedPet(p); const s = getSizeFromWeight(p.weightSize || ''); if (s) setPetSize(s); }
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideInput = clientRef.current && clientRef.current.contains(target);
      const insideDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      if (!insideInput && !insideDropdown) setShowClientSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return [];
    const norm = normalizeText(clientSearch);
    return clients.filter(c => normalizeText(c.name).includes(norm) || normalizeText(c.contactNumber || '').includes(norm)).slice(0, 6);
  }, [clients, clientSearch]);

  const handleSelectClient = (c: Client) => {
    setSelectedClient(c);
    setClientSearch(c.name);
    setSelectedPet(null);
    setShowClientSugg(false);
    if (c.pets.length === 1) {
      const p = c.pets[0];
      setSelectedPet(p);
      const s = getSizeFromWeight(p.weightSize || '');
      if (s) setPetSize(s);
    }
  };

  const handleSelectPet = (p: Pet) => {
    setSelectedPet(prev => prev?.id === p.id ? null : p);
    const s = getSizeFromWeight(p.weightSize || '');
    if (s) setPetSize(s);
  };

  // ── New client ──
  const [ncName, setNcName] = useState('');
  const [ncContact, setNcContact] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [ncPetName, setNcPetName] = useState('');
  const [ncPetSpecies, setNcPetSpecies] = useState<'DOG' | 'CAT' | 'OTHER'>('DOG');
  const [ncPetBreed, setNcPetBreed] = useState('');
  const [ncPetColor, setNcPetColor] = useState('');
  const [ncPetWeight, setNcPetWeight] = useState('');

  useEffect(() => {
    if (ncPetWeight) { const s = getSizeFromWeight(ncPetWeight); if (s) setPetSize(s); }
  }, [ncPetWeight]);

  // ── Derived ──
  const rate = activeRates[bookingType][petSize];
  const nights = diffDays(checkIn, checkOut);
  const ownerName = clientMode === 'EXISTING' ? (selectedClient?.name || '') : ncName;
  const contactNumber = clientMode === 'EXISTING' ? (selectedClient?.contactNumber || '') : ncContact;
  const email = clientMode === 'EXISTING' ? (selectedClient?.email || '') : ncEmail;
  const petName = clientMode === 'EXISTING' ? (selectedPet?.name || '') : ncPetName;
  const clientId = clientMode === 'EXISTING' ? (selectedClient?.id || '') : '';
  const petId = clientMode === 'EXISTING' ? (selectedPet?.id || '') : '';
  const [roomId, setRoomId] = useState(booking?.room_id || preselectedRoomId || '');
  const [notes, setNotes] = useState(booking?.notes || '');
  const [downpayment, setDownpayment] = useState<number>(booking?.downpayment || 0);
  // Selected add-ons: { id: string; qty: number }[]
  const [selectedExtras, setSelectedExtras] = useState<{ id: string; qty: number }[]>(booking?.hotel_extras || []);

  const toggleExtra = (id: string) => {
    setSelectedExtras(prev => {
      const existing = prev.find(e => e.id === id);
      if (existing) return prev.filter(e => e.id !== id);
      return [...prev, { id, qty: 1 }];
    });
  };
  const setExtraQty = (id: string, qty: number) => {
    setSelectedExtras(prev => prev.map(e => e.id === id ? { ...e, qty: Math.max(1, qty) } : e));
  };
  const extrasTotal = selectedExtras.reduce((sum, e) => {
    const extra = activeExtras.find(x => x.id === e.id);
    return sum + (extra ? extra.price * e.qty : 0);
  }, 0);

  // Step 1 is valid when client+pet info is complete
  const step1Valid =
    clientMode === 'EXISTING'
      ? (selectedClient !== null && (selectedClient.pets.length === 0 || selectedPet !== null))
      : (ncName.trim().length > 0 && ncPetName.trim().length > 0);

  const conflict = hotelBookings.some(b => {
    if (b.id === booking?.id) return false;
    if (b.room_id !== roomId || !roomId) return false;
    if (b.status === 'CANCELLED' || b.status === 'CHECKED_OUT') return false;
    if (b.status === 'CHECKED_IN' && b.check_out < today) return false;
    return checkIn < b.check_out && checkOut > b.check_in;
  });

  const canSave = ownerName && petName && !conflict;

  const handleSave = () => {
    if (!canSave) return;
    let finalClientId = clientId;
    if (clientMode === 'NEW' && ncName) {
      const newClient: Client = {
        id: Date.now().toString(),
        name: ncName,
        contactNumber: ncContact,
        email: ncEmail,
        address: '',
        notes: '',
        firstSeen: new Date().toISOString(),
        pets: ncPetName ? [{
          id: Date.now().toString() + 'p',
          name: ncPetName,
          species: ncPetSpecies,
          breed: ncPetBreed || undefined,
          color: ncPetColor || undefined,
          weightSize: ncPetWeight || petSize,
        }] : [],
      };
      addClient(newClient);
      finalClientId = newClient.id;
    }
    onSave({
      id: booking?.id || crypto.randomUUID(),
      room_id: roomId,
      client_id: finalClientId,
      pet_id: petId,
      pet_name: petName,
      owner_name: ownerName,
      contact_number: contactNumber,
      email: email,
      check_in: checkIn,
      check_out: checkOut,
      actual_check_in: booking?.actual_check_in || '',
      actual_check_out: booking?.actual_check_out || '',
      status: booking?.status || 'RESERVED',
      daily_rate: rate,
      total_nights: nights,
      total_amount: rate + extrasTotal,
      addon_ids: booking?.addon_ids || [],
      hotel_extras: selectedExtras,
      notes: notes,
      staff_id: currentUser?.id || '',
      transaction_id: booking?.transaction_id || '',
      booking_type: bookingType,
      pet_size: petSize,
      downpayment: downpayment || 0,
    });
  };

  // Update dropdown fixed position whenever it opens or the input moves
  useLayoutEffect(() => {
    if (showClientSugg && searchInputRef.current) {
      const r = searchInputRef.current.getBoundingClientRect();
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
    } else {
      setDropdownRect(null);
    }
  }, [showClientSugg, clientSearch]);

  // ──────────────────────────────────────────────────────────
  // WIZARD RETURN — all JSX inlined, no inner components
  // ──────────────────────────────────────────────────────────

  // ── EDIT MODE ──
  if (booking) {
    return (
      <div className="fixed inset-0 bg-purple-700/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h2 className="text-xl font-bold text-zinc-900">Edit Booking</h2>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            {/* Summary */}
            <div className="bg-gradient-to-r from-purple-700 to-indigo-700 rounded-2xl p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-200 mb-2">Booking For</p>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center text-2xl flex-shrink-0">{selectedPet?.species === 'CAT' ? '🐱' : '🐶'}</div>
                <div>
                  <p className="font-black text-xl leading-tight">{petName || '—'}</p>
                  <p className="text-purple-200 text-sm">{ownerName} · Size <strong className="text-white bg-white/20 px-2 py-0.5 rounded-lg">{petSize}</strong></p>
                </div>
              </div>
            </div>
            {/* Booking Type */}
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Booking Type *</label>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(BOOKING_TYPE_LABELS) as BookingTypeKey[]).map(type => (
                  <button key={type} type="button" onClick={() => setBookingType(type)}
                    className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${bookingType === type ? 'bg-purple-700 text-white border-purple-700 shadow-lg' : 'border-zinc-200 hover:border-purple-300 hover:bg-purple-50'}`}>
                    <span className="font-bold">{type === 'DAYCARE' ? '☀️' : type === 'OVERNIGHT' ? '🌙' : type === 'STAYCATION_3D2N' ? '🏠' : type === 'STAYCATION_4D3N' ? '🏡' : '🌴'} </span>
                    {activeLabels[type]}
                  </button>
                ))}
              </div>
            </div>
            {/* Rate */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-purple-900">{activeLabels[bookingType]}</p>
                  <p className="text-xs text-purple-500 mt-0.5">🐾 {petName} · Size <strong>{petSize}</strong> · {checkIn} → {checkOut}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-purple-700">₱{rate.toLocaleString()}</p>
                  <p className="text-xs text-purple-400">package rate</p>
                </div>
              </div>
            </div>
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Check-In</label>
                <input type="date" value={checkIn} min={today} onChange={e => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, BOOKING_TYPE_NIGHTS[bookingType])); }} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Check-Out</label>
                <input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={e => setCheckOut(e.target.value)} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none" />
              </div>
            </div>
            {/* Room */}
            {activeRooms.length > 0 && (
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Assign Room / Slot</label>
                <select value={roomId} onChange={e => setRoomId(e.target.value)} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none">
                  <option value="">No specific room</option>
                  {activeRooms.map(r => <option key={r.id} value={r.id}>{r.room_number} – {r.room_name} ({r.room_type})</option>)}
                </select>
              </div>
            )}
            {conflict && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />This room is already booked for these dates.
              </div>
            )}
            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Special Instructions</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Food preferences, medication, special care..." className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none resize-none" />
            </div>
            {/* Downpayment */}
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Downpayment / Advance Payment (₱) <span className="normal-case font-normal text-zinc-400">(optional)</span></label>
              <input type="number" min="0" step="0.01" value={downpayment || ''} onChange={e => setDownpayment(e.target.value ? Number(e.target.value) : 0)} placeholder="e.g. 500" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none" />
            </div>
          </div>
          <div className="p-6 pt-0 flex gap-3 sticky bottom-0 bg-white border-t border-zinc-100">
            <button onClick={onClose} className="flex-1 border border-zinc-200 text-zinc-700 py-3 rounded-xl font-semibold hover:bg-zinc-50">Cancel</button>
            <button onClick={handleSave} disabled={!canSave} className="flex-1 bg-purple-700 text-white py-3 rounded-xl font-semibold hover:bg-purple-800 disabled:opacity-40">Save Changes</button>
          </div>
        </div>
      </div>
    );
  }

  // ── NEW BOOKING WIZARD ──
  return (
    <div className="fixed inset-0 bg-purple-700/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Portal dropdown — fixed, escapes overflow clipping */}
      {showClientSugg && filteredClients.length > 0 && dropdownRect && createPortal(
        <div ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 9999 }}
          className="bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
          {filteredClients.map(c => (
            <button key={c.id}
              onMouseDown={e => { e.preventDefault(); handleSelectClient(c); }}
              className="w-full text-left px-4 py-3 hover:bg-purple-50 text-sm border-b border-zinc-100 last:border-0">
              <div className="font-semibold text-zinc-900">{c.name}</div>
              <div className="text-xs text-zinc-400">{c.contactNumber}{c.pets.length > 0 ? ` · ${c.pets.map(p => p.name).join(', ')}` : ' · No pets on record'}</div>
            </button>
          ))}
        </div>,
        document.body
      )}

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="px-6 pt-6 pb-0 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-zinc-900">🐾 New Hotel Booking</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        {/* Step indicator — inlined, no inner component */}
        <div className="flex items-start px-6 py-4 flex-shrink-0">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shadow-sm transition-all ${step >= 1 ? 'bg-purple-700 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <span className={`text-[10px] font-bold mt-1.5 uppercase tracking-wide ${step >= 1 ? 'text-purple-700' : 'text-zinc-400'}`}>Client & Pet</span>
          </div>
          <div className="flex-1 mx-2 mt-4">
            <div className="h-0.5 bg-zinc-200 relative overflow-hidden rounded-full">
              <div className={`absolute inset-y-0 left-0 bg-purple-700 transition-all duration-500 ${step >= 2 ? 'w-full' : 'w-0'}`} />
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shadow-sm transition-all ${step >= 2 ? 'bg-purple-700 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
              2
            </div>
            <span className={`text-[10px] font-bold mt-1.5 uppercase tracking-wide ${step >= 2 ? 'text-purple-700' : 'text-zinc-400'}`}>Booking</span>
          </div>
        </div>

        {/* Scrollable body — inlined step JSX, NO inner component functions */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">

          {/* ══ STEP 1 ══ */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Client Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={() => { setClientMode('EXISTING'); setSelectedClient(null); setSelectedPet(null); setClientSearch(''); setShowClientSugg(false); }}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all ${clientMode === 'EXISTING' ? 'bg-purple-700 text-white border-purple-700 shadow' : 'border-zinc-200 hover:border-purple-300'}`}>
                    🔍 Existing Client
                  </button>
                  <button type="button"
                    onClick={() => { setClientMode('NEW'); setSelectedClient(null); setSelectedPet(null); setShowClientSugg(false); }}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all ${clientMode === 'NEW' ? 'bg-purple-700 text-white border-purple-700 shadow' : 'border-zinc-200 hover:border-purple-300'}`}>
                    ✨ New Client
                  </button>
                </div>
              </div>

              {/* ── Existing Client ── */}
              {clientMode === 'EXISTING' && (
                <div className="space-y-3">
                  <div ref={clientRef}>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Search Owner *</label>
                    <input
                      ref={searchInputRef}
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setSelectedClient(null); setSelectedPet(null); setShowClientSugg(true); }}
                      onFocus={() => setShowClientSugg(true)}
                      placeholder="Type owner name or contact..."
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  {selectedClient && (
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-medium">
                          <span>✅</span>
                          <span>{selectedClient.name}</span>
                          {selectedClient.contactNumber && <span className="text-green-600 text-xs">({selectedClient.contactNumber})</span>}
                        </div>
                        <button type="button" onMouseDown={() => { setSelectedClient(null); setSelectedPet(null); setClientSearch(''); }}
                          className="text-green-500 hover:text-green-700 text-xs underline">Change</button>
                      </div>

                      {selectedClient.pets.length > 0 ? (
                        <div>
                          <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Select Pet *</label>
                          <div className="grid grid-cols-1 gap-2">
                            {selectedClient.pets.map(p => {
                              const autoSize = getSizeFromWeight(p.weightSize || '');
                              const isSel = selectedPet?.id === p.id;
                              return (
                                <button key={p.id} type="button"
                                  onMouseDown={e => { e.preventDefault(); handleSelectPet(p); }}
                                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all select-none ${isSel ? 'bg-purple-700 text-white border-purple-700 shadow-md' : 'border-zinc-200 hover:border-purple-400 hover:bg-purple-50'}`}>
                                  <span className="text-xl flex-shrink-0">{p.species === 'CAT' ? '🐱' : p.species === 'OTHER' ? '🐾' : '🐶'}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold">{p.name}</div>
                                    {p.breed && <div className={`text-xs truncate ${isSel ? 'text-purple-200' : 'text-zinc-400'}`}>{p.breed}</div>}
                                  </div>
                                  {p.weightSize && (
                                    <div className="text-right flex-shrink-0">
                                      <div className={`text-xs font-bold px-2 py-0.5 rounded-lg ${isSel ? 'bg-white/25 text-white' : 'bg-zinc-100 text-zinc-600'}`}>{p.weightSize}</div>
                                      {autoSize && <div className={`text-[10px] mt-0.5 ${isSel ? 'text-purple-200' : 'text-zinc-400'}`}>Size {autoSize}</div>}
                                    </div>
                                  )}
                                  {isSel && <span className="text-white text-lg flex-shrink-0">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700">⚠️ No pets on record — enter pet name manually</div>
                          <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Pet Name *</label>
                            <input value={selectedPet?.name || ''} onChange={e => setSelectedPet({ id: '', name: e.target.value, species: 'DOG' })}
                              placeholder="Buddy" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── New Client ── */}
              {clientMode === 'NEW' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Owner Info</p>
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Full Name *</label>
                      <input value={ncName} onChange={e => setNcName(e.target.value)} placeholder="Juan dela Cruz"
                        className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Contact No.</label>
                        <input value={ncContact} onChange={e => setNcContact(e.target.value)} placeholder="09XX..."
                          className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Email</label>
                        <input type="email" value={ncEmail} onChange={e => setNcEmail(e.target.value)} placeholder="email@..."
                          className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">🐾 Pet Info</p>
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Pet Name *</label>
                      <input value={ncPetName} onChange={e => setNcPetName(e.target.value)} placeholder="Buddy"
                        className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Species</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['DOG','CAT','OTHER'] as const).map(sp => (
                          <button key={sp} type="button" onClick={() => setNcPetSpecies(sp)}
                            className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${ncPetSpecies === sp ? 'bg-purple-700 text-white border-purple-700' : 'border-zinc-200 bg-white hover:border-purple-300'}`}>
                            {sp === 'DOG' ? '🐶 Dog' : sp === 'CAT' ? '🐱 Cat' : '🐾 Other'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Breed</label>
                        <input value={ncPetBreed} onChange={e => setNcPetBreed(e.target.value)} placeholder="Shih Tzu"
                          className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Color</label>
                        <input value={ncPetColor} onChange={e => setNcPetColor(e.target.value)} placeholder="Brown & White"
                          className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Weight / Size</label>
                      <input value={ncPetWeight} onChange={e => setNcPetWeight(e.target.value)} placeholder="e.g. 3.5kg or S or M"
                        className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white" />
                      {ncPetWeight && getSizeFromWeight(ncPetWeight) && (
                        <p className="text-xs text-purple-600 mt-1 font-bold">→ Auto-size: <span className="bg-purple-100 px-2 py-0.5 rounded">{getSizeFromWeight(ncPetWeight)}</span></p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ STEP 2 ══ */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="bg-gradient-to-r from-purple-700 to-indigo-700 rounded-2xl p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-wider text-purple-200 mb-2">Booking For</p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                    {clientMode === 'NEW' ? '🐾' : selectedPet?.species === 'CAT' ? '🐱' : selectedPet?.species === 'OTHER' ? '🐾' : '🐶'}
                  </div>
                  <div>
                    <p className="font-black text-xl leading-tight">{petName || '—'}</p>
                    <p className="text-purple-200 text-sm">{ownerName} · Size <strong className="text-white bg-white/20 px-2 py-0.5 rounded-lg">{petSize}</strong></p>
                  </div>
                </div>
              </div>
              {/* Booking Type */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Booking Type *</label>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(BOOKING_TYPE_LABELS) as BookingTypeKey[]).map(type => (
                    <button key={type} type="button" onClick={() => setBookingType(type)}
                      className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${bookingType === type ? 'bg-purple-700 text-white border-purple-700 shadow-lg' : 'border-zinc-200 hover:border-purple-300 hover:bg-purple-50'}`}>
                      <span className="font-bold">{type === 'DAYCARE' ? '☀️' : type === 'OVERNIGHT' ? '🌙' : type === 'STAYCATION_3D2N' ? '🏠' : type === 'STAYCATION_4D3N' ? '🏡' : '🌴'} </span>
                      {activeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Rate */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-purple-900">{activeLabels[bookingType]}</p>
                    <p className="text-xs text-purple-500 mt-0.5">🐾 {petName} · Size <strong>{petSize}</strong> · {checkIn} → {checkOut}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-purple-700">₱{rate.toLocaleString()}</p>
                    <p className="text-xs text-purple-400">package rate</p>
                  </div>
                </div>
              </div>
              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Check-In</label>
                  <input type="date" value={checkIn} min={today} onChange={e => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, BOOKING_TYPE_NIGHTS[bookingType])); }} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Check-Out</label>
                  <input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={e => setCheckOut(e.target.value)} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none" />
                </div>
              </div>
              {/* Room */}
              {activeRooms.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Assign Room / Slot</label>
                  <select value={roomId} onChange={e => setRoomId(e.target.value)} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none">
                    <option value="">No specific room</option>
                    {activeRooms.map(r => <option key={r.id} value={r.id}>{r.room_number} – {r.room_name} ({r.room_type})</option>)}
                  </select>
                </div>
              )}
              {conflict && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />This room is already booked for these dates.
                </div>
              )}
              {/* Add-ons: Meal Prep & Additional Services */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Add-ons & Services (Optional)</label>
                <div className="space-y-2">
                  {activeExtras.map(extra => {
                    const sel = selectedExtras.find(e => e.id === extra.id);
                    const checked = !!sel;
                    return (
                      <div key={extra.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${checked ? 'border-purple-400 bg-purple-50' : 'border-zinc-200 hover:border-purple-200'}`}
                        onClick={() => toggleExtra(extra.id)}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-purple-700 border-purple-700' : 'border-zinc-300'}`}>
                          {checked && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-800">{extra.label}</p>
                          <p className="text-xs text-purple-600 font-bold">₱{extra.price.toLocaleString()}</p>
                        </div>
                        {checked && (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button type="button" onClick={() => setExtraQty(extra.id, (sel?.qty || 1) - 1)} className="w-7 h-7 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 font-bold">−</button>
                            <span className="w-6 text-center text-sm font-bold">{sel?.qty || 1}</span>
                            <button type="button" onClick={() => setExtraQty(extra.id, (sel?.qty || 1) + 1)} className="w-7 h-7 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 font-bold">+</button>
                          </div>
                        )}
                        {checked && <span className="text-xs font-bold text-purple-700 flex-shrink-0">₱{((sel?.qty || 1) * extra.price).toLocaleString()}</span>}
                      </div>
                    );
                  })}
                </div>
                {extrasTotal > 0 && (
                  <div className="mt-2 flex justify-between items-center px-1">
                    <span className="text-xs text-zinc-400">Add-ons total</span>
                    <span className="text-sm font-bold text-purple-700">+₱{extrasTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>
              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Special Instructions</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Food preferences, medication, special care..." className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none resize-none" />
              </div>
              {/* Downpayment */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Downpayment / Advance Payment (₱) <span className="normal-case font-normal text-zinc-400">(optional — auto-deducted at checkout)</span></label>
                <input type="number" min="0" step="0.01" value={downpayment || ''} onChange={e => setDownpayment(e.target.value ? Number(e.target.value) : 0)} placeholder="e.g. 500" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 flex gap-3 flex-shrink-0 border-t border-zinc-100 bg-white rounded-b-3xl">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="flex-1 border border-zinc-200 text-zinc-700 py-3 rounded-xl font-semibold hover:bg-zinc-50">Cancel</button>
              <button onClick={() => setStep(2)} disabled={!step1Valid}
                className="flex-1 bg-purple-700 text-white py-3 rounded-xl font-semibold hover:bg-purple-800 disabled:opacity-40 flex items-center justify-center gap-2">
                Next <span>→</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="flex-1 border border-zinc-200 text-zinc-700 py-3 rounded-xl font-semibold hover:bg-zinc-50 flex items-center justify-center gap-2">
                <span>←</span> Back
              </button>
              <button onClick={handleSave} disabled={!canSave}
                className="flex-1 bg-purple-700 text-white py-3 rounded-xl font-semibold hover:bg-purple-800 disabled:opacity-40">
                🐾 Book Room
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Booking Confirmation Modal ────────────────────────────────────────────────

const BookingConfirmationModal: React.FC<{
  booking: HotelBooking;
  isEdit: boolean;
  onClose: () => void;
}> = ({ booking, isEdit, onClose }) => {
  const { hotelRooms, storeSettings } = useStore();
  const room = hotelRooms.find(r => r.id === booking.room_id);
  const activeLabels: Record<BookingTypeKey, string> = {
    ...BOOKING_TYPE_LABELS,
    ...(storeSettings.hotelBookingTypeLabels as Record<BookingTypeKey, string> | undefined),
  } as Record<BookingTypeKey, string>;
  const btype = (booking.booking_type as BookingTypeKey) || 'OVERNIGHT';
  const psize = (booking.pet_size as PetSizeKey) || 'S';
  const emoji = ['XS','S','M'].includes(psize) ? '🐶' : psize === 'L' ? '🐕' : '🐺';
  const speciesEmoji = booking.pet_name ? emoji : '🐾';

  const nights = (() => {
    try {
      const d1 = new Date(booking.check_in);
      const d2 = new Date(booking.check_out);
      return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
    } catch { return 1; }
  })();

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header banner */}
        <div className="bg-gradient-to-br from-purple-700 via-indigo-700 to-violet-800 px-6 pt-8 pb-10 text-white relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-36 h-36 bg-white/10 rounded-full" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute top-4 right-16 w-10 h-10 bg-white/10 rounded-full" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{isEdit ? '✏️' : '✨'}</span>
              <span className="text-xs font-bold uppercase tracking-widest text-purple-200">
                {isEdit ? 'Booking Updated' : 'Booking Confirmed!'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 shadow-inner">
                {speciesEmoji}
              </div>
              <div>
                <p className="text-2xl font-black leading-tight">{booking.pet_name}</p>
                <p className="text-purple-200 text-sm mt-0.5">{booking.owner_name}</p>
                {booking.contact_number && <p className="text-purple-300 text-xs">{booking.contact_number}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Pull-up content card */}
        <div className="-mt-4 bg-white rounded-t-3xl px-6 pt-5 pb-2">

          {/* Booking type pill */}
          <div className="flex justify-center mb-4">
            <span className="bg-purple-100 text-purple-800 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wide">
              {btype === 'DAYCARE' ? '☀️' : btype === 'OVERNIGHT' ? '🌙' : btype === 'STAYCATION_3D2N' ? '🏠' : btype === 'STAYCATION_4D3N' ? '🏡' : '🌴'}
              {' '}{activeLabels[btype]}
            </span>
          </div>

          {/* Details grid */}
          <div className="space-y-0 divide-y divide-zinc-100">

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="text-base">📍</span>
                <span className="text-xs font-semibold uppercase tracking-wide">Pet Size</span>
              </div>
              <span className="font-black text-purple-700 bg-purple-50 px-3 py-1 rounded-xl text-sm">{psize}</span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="text-base">📅</span>
                <span className="text-xs font-semibold uppercase tracking-wide">Check-In</span>
              </div>
              <span className="font-bold text-zinc-800 text-sm">{formatDate(booking.check_in)}</span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="text-base">📅</span>
                <span className="text-xs font-semibold uppercase tracking-wide">Check-Out</span>
              </div>
              <span className="font-bold text-zinc-800 text-sm">{formatDate(booking.check_out)}</span>
            </div>

            {btype !== 'DAYCARE' && (
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 text-zinc-500">
                  <span className="text-base">🌙</span>
                  <span className="text-xs font-semibold uppercase tracking-wide">Duration</span>
                </div>
                <span className="font-bold text-zinc-800 text-sm">{nights} night{nights !== 1 ? 's' : ''}</span>
              </div>
            )}

            {room && (
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 text-zinc-500">
                  <span className="text-base">🏨</span>
                  <span className="text-xs font-semibold uppercase tracking-wide">Room / Slot</span>
                </div>
                <span className="font-bold text-zinc-800 text-sm">{room.room_number} – {room.room_name}</span>
              </div>
            )}

            {booking.notes && (
              <div className="py-3">
                <div className="flex items-center gap-2 text-zinc-500 mb-1">
                  <span className="text-base">📝</span>
                  <span className="text-xs font-semibold uppercase tracking-wide">Special Instructions</span>
                </div>
                <p className="text-sm text-zinc-700 bg-zinc-50 rounded-xl px-3 py-2 leading-relaxed">{booking.notes}</p>
              </div>
            )}

          </div>

          {/* Rate summary */}
          <div className="mt-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide">Package Rate</p>
              <p className="text-xs text-zinc-400 mt-0.5">{activeLabels[btype]}</p>
            </div>
            <p className="text-3xl font-black text-purple-700">₱{(booking.daily_rate || 0).toLocaleString()}</p>
          </div>

          {/* Status badge */}
          <div className="flex justify-center mt-3 mb-1">
            <span className="bg-amber-100 text-amber-700 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
              ⏳ RESERVED
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3">
          <button
            onClick={onClose}
            className="w-full bg-purple-700 hover:bg-purple-800 text-white py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-purple-200">
            ✔ Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

const CheckoutModal: React.FC<{
  booking: HotelBooking;
  onConfirm: (method: 'CASH' | 'GCASH' | 'SPLIT', cash?: number, ref?: string, recalcTotal?: number, lateAmount?: number, lateLabel?: string) => void;
  onClose: () => void;
}> = ({ booking, onConfirm, onClose }) => {
  const { hotelRooms, storeSettings } = useStore();
  const room = hotelRooms.find(r => r.id === booking.room_id);

  // Live rates with DB overrides
  const activeRates: Record<BookingTypeKey, Record<PetSizeKey, number>> = {
    ...HOTEL_RATES,
    ...(storeSettings.hotelRates as Record<BookingTypeKey, Record<PetSizeKey, number>> | undefined),
  } as Record<BookingTypeKey, Record<PetSizeKey, number>>;
  const activeLabels: Record<BookingTypeKey, string> = {
    ...BOOKING_TYPE_LABELS,
    ...(storeSettings.hotelBookingTypeLabels as Record<BookingTypeKey, string> | undefined),
  } as Record<BookingTypeKey, string>;
  const activeExtras: { id: string; label: string; price: number }[] =
    storeSettings.hotelExtras && storeSettings.hotelExtras.length > 0
      ? storeSettings.hotelExtras
      : HOTEL_EXTRAS;

  // Package rate (flat — not per-night multiply)
  const packageRate = booking.daily_rate;
  const bookingType = (booking.booking_type as BookingTypeKey) || 'OVERNIGHT';
  const petSize = (booking.pet_size as PetSizeKey) || 'S';
  const isSmallSize = ['XS','S','M'].includes(petSize);

  // Extras from booking
  const bookingExtras = (booking.hotel_extras || []).map(e => {
    const extra = activeExtras.find(x => x.id === e.id);
    return extra ? { ...extra, qty: e.qty } : null;
  }).filter(Boolean) as { id: string; label: string; price: number; qty: number }[];
  const extrasTotal = bookingExtras.reduce((sum, e) => sum + e.price * e.qty, 0);

  // Late checkout add-on
  const [lateCheckout, setLateCheckout] = useState<number | null>(null); // index of LATE_CHECKOUT_RATES
  const daycareRate = activeRates['DAYCARE'][petSize];
  const getLateRate = (idx: number) => {
    const slot = LATE_CHECKOUT_RATES[idx];
    const raw = isSmallSize ? slot.small : slot.large;
    return raw === 'daycare' ? daycareRate : raw;
  };
  const lateAmount = lateCheckout !== null ? getLateRate(lateCheckout) : 0;

  const grandTotal = packageRate + extrasTotal + lateAmount;
  const dpAmount = Math.min(booking.downpayment || 0, grandTotal);
  const balanceToPay = Math.max(0, grandTotal - dpAmount);

  const [method, setMethod] = useState<'CASH' | 'GCASH' | 'SPLIT'>('CASH');
  const [cash, setCash] = useState(balanceToPay);
  const [ref, setRef] = useState('');
  // Special Discount (admin-authorized)
  const [specialDiscountInput, setSpecialDiscountInput] = useState('');
  const [specialDiscountType, setSpecialDiscountType] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT');
  const [appliedSpecialDiscount, setAppliedSpecialDiscount] = useState(0);
  const [showAdminPinForDiscount, setShowAdminPinForDiscount] = useState(false);

  const specialDiscountAmt = specialDiscountType === 'PERCENT'
    ? grandTotal * (Number(specialDiscountInput || 0) / 100)
    : Number(specialDiscountInput || 0);

  const effectiveGrandTotal = Math.max(0, grandTotal - appliedSpecialDiscount);
  const effectiveDp = Math.min(booking.downpayment || 0, effectiveGrandTotal);
  const effectiveBalance = Math.max(0, effectiveGrandTotal - effectiveDp);

  // Update cash suggestion when balance changes
  useEffect(() => { setCash(effectiveBalance); }, [effectiveBalance]);

  return (
    <React.Fragment>
    <div className="fixed inset-0 bg-purple-700/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900">Check Out &amp; Pay</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 space-y-2 text-sm">
            <div className="flex justify-between font-bold text-base">
              <span>🐾 {booking.pet_name}</span>
              <span className="text-zinc-500">{room ? `Room ${room.room_number}` : 'Hotel'}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>{activeLabels[bookingType] || bookingType} · <strong>{petSize}</strong></span>
              <span className="font-bold">₱{packageRate.toLocaleString()}</span>
            </div>
            {bookingExtras.map(e => (
              <div key={e.id} className="flex justify-between text-green-700">
                <span>🍗 {e.label}{e.qty > 1 ? ` ×${e.qty}` : ''}</span>
                <span>+₱{(e.price * e.qty).toLocaleString()}</span>
              </div>
            ))}
            {lateAmount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>{LATE_CHECKOUT_RATES[lateCheckout!].label}</span>
                <span>+₱{lateAmount.toLocaleString()}</span>
              </div>
            )}
            {dpAmount > 0 && (
              <div className="flex justify-between text-orange-600 font-bold">
                <span>Downpayment Paid</span>
                <span>-₱{dpAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-zinc-200 pt-2">
              <span>{dpAmount > 0 ? 'BALANCE TO PAY' : 'TOTAL'}</span>
              <span className="text-green-700">₱{balanceToPay.toLocaleString()}</span>
            </div>
            {dpAmount > 0 && (
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Full Total</span>
                <span>₱{grandTotal.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Late Checkout */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Late Check-Out Fee (optional)</label>
            <div className="space-y-2">
              {LATE_CHECKOUT_RATES.map((slot, idx) => {
                const fee = getLateRate(idx);
                const active = lateCheckout === idx;
                return (
                  <button key={idx} type="button" onClick={() => setLateCheckout(active ? null : idx)}
                    className={`w-full flex justify-between items-center px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${active ? 'bg-amber-500 text-white border-amber-500' : 'border-zinc-200 hover:border-amber-300'}`}>
                    <span>{slot.label}</span>
                    <span className={active ? 'text-white font-bold' : 'text-zinc-500'}>+₱{fee.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            {/* SPECIAL DISCOUNT - Admin Only */}
            <div className="mb-4 p-3 rounded-xl border border-dashed border-amber-300 bg-amber-50">
              <p className="text-amber-700 text-xs font-bold uppercase tracking-widest mb-2">
                🏷 Special Discount <span className="font-normal normal-case text-amber-500">(Admin code required)</span>
              </p>
              {appliedSpecialDiscount > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-green-700 font-bold text-sm">✓ -₱{appliedSpecialDiscount.toFixed(2)} applied</span>
                  <button onClick={() => { setAppliedSpecialDiscount(0); setSpecialDiscountInput(''); }} className="text-xs text-red-500 hover:text-red-700 font-bold">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <div className="flex rounded-lg border border-amber-300 overflow-hidden">
                    <button onClick={() => setSpecialDiscountType('AMOUNT')} className={`px-2 py-1 text-xs font-bold transition-all ${specialDiscountType === 'AMOUNT' ? 'bg-amber-500 text-white' : 'bg-white text-amber-600'}`}>₱</button>
                    <button onClick={() => setSpecialDiscountType('PERCENT')} className={`px-2 py-1 text-xs font-bold transition-all ${specialDiscountType === 'PERCENT' ? 'bg-amber-500 text-white' : 'bg-white text-amber-600'}`}>%</button>
                  </div>
                  <input type="number" min="0" step="0.01"
                    placeholder={specialDiscountType === 'AMOUNT' ? 'e.g. 200' : 'e.g. 10'}
                    value={specialDiscountInput}
                    onChange={e => setSpecialDiscountInput(e.target.value)}
                    className="flex-1 border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <button
                    disabled={!specialDiscountInput || Number(specialDiscountInput) <= 0}
                    onClick={() => setShowAdminPinForDiscount(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-40 transition-all">Apply</button>
                </div>
              )}
            </div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {(['CASH', 'GCASH', 'SPLIT'] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)} className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${method === m ? 'bg-purple-700 text-white border-purple-700' : 'border-zinc-200 hover:border-zinc-400'}`}>{m}</button>
              ))}
            </div>
          </div>
          {(method === 'CASH' || method === 'SPLIT') && (
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Cash Received (₱)</label>
              <input type="number" value={cash} onChange={e => setCash(parseFloat(e.target.value) || 0)} className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
              {cash >= effectiveBalance && <p className="text-green-600 text-xs mt-1 font-bold">Change: ₱{(cash - effectiveBalance).toLocaleString()}</p>}
            </div>
          )}
          {(method === 'GCASH' || method === 'SPLIT') && (
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">GCash Reference</label>
              <input value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. GCSH1234567" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
            </div>
          )}
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-zinc-200 text-zinc-700 py-3 rounded-xl font-semibold hover:bg-zinc-50">Cancel</button>
          <button onClick={() => onConfirm(method, cash, ref, effectiveGrandTotal, lateAmount, lateAmount > 0 ? LATE_CHECKOUT_RATES[lateCheckout!].label : '')} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />Confirm Checkout
          </button>
        </div>
      </div>
    </div>

      <AdminPinModal
        isOpen={showAdminPinForDiscount}
        title="Apply Special Discount"
        description="Enter admin PIN to authorize this discount."
        onSuccess={() => {
          const computed = Math.min(specialDiscountAmt, grandTotal);
          setAppliedSpecialDiscount(Math.round(computed * 100) / 100);
        }}
        onClose={() => setShowAdminPinForDiscount(false)}
      />
    </React.Fragment>
  );
};

// ─── Availability Calendar ─────────────────────────────────────────────────────

const CalendarView: React.FC<{ onBook: (roomId: string, date: string) => void }> = ({ onBook }) => {
  const { hotelRooms, hotelBookings } = useStore();
  const [startDate, setStartDate] = useState(getPhToday);
  const DAYS = 14;
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(startDate, i));
  const todayStr = getPhToday();
  const activeRooms = hotelRooms.filter(r => r.is_active);

  const getBooking = (roomId: string, date: string): HotelBooking | null =>
    hotelBookings.find(b => b.room_id === roomId && b.status !== 'CANCELLED' && b.status !== 'CHECKED_OUT' && b.check_in <= date && b.check_out > date) || null;

  const bgByStatus: Record<string, string> = { RESERVED: 'bg-amber-400', CHECKED_IN: 'bg-green-500' };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setStartDate(addDays(startDate, -7))} className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={() => setStartDate(getPhToday())} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-medium hover:bg-zinc-50">Today</button>
        <button onClick={() => setStartDate(addDays(startDate, 7))} className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50"><ChevronRight className="w-4 h-4" /></button>
        <span className="text-sm text-zinc-500">{fmtDate(startDate)} – {fmtDate(addDays(startDate, DAYS - 1))}</span>
      </div>
      {activeRooms.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">No active rooms. Add rooms first.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
            <thead>
              <tr className="bg-purple-900 text-white">
                <th className="sticky left-0 bg-purple-900 w-32 px-3 py-3 text-left font-bold">Room</th>
                {dates.map(d => (
                  <th key={d} className={`px-2 py-3 font-medium text-center min-w-[52px] ${d === todayStr ? 'bg-zinc-700' : ''}`}>
                    <div className="text-zinc-400">{new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short' })}</div>
                    <div className="font-bold">{new Date(d + 'T00:00:00').getDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeRooms.map((room, ri) => (
                <tr key={room.id} className={ri % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                  <td className="sticky left-0 px-3 py-2 border-r border-zinc-100 font-bold text-zinc-900" style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <div>{room.room_number}</div>
                    <div className="text-zinc-400 font-normal text-xs truncate">{room.room_name}</div>
                  </td>
                  {dates.map(d => {
                    const b = getBooking(room.id, d);
                    const isFirst = b && b.check_in === d;
                    const isLast = b && addDays(b.check_out, -1) === d;
                    return (
                      <td key={d} className={`py-1 px-0 border-l border-zinc-100 cursor-pointer ${d === todayStr ? 'bg-blue-50/60' : ''}`}
                        onClick={() => !b && onBook(room.id, d)} title={b ? `${b.pet_name} (${b.owner_name})` : 'Click to book'}>
                        {b ? (
                          <div className={`h-8 ${bgByStatus[b.status] || 'bg-zinc-400'} ${isFirst ? 'ml-1 rounded-l-md' : ''} ${isLast ? 'mr-1 rounded-r-md' : ''} flex items-center px-1`}>
                            {isFirst && <span className="text-white font-bold text-xs truncate">{b.pet_name}</span>}
                          </div>
                        ) : (
                          <div className="h-8 hover:bg-green-100 transition-colors mx-0.5 rounded" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-4 mt-3 text-xs text-zinc-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" />Reserved</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" />Checked In</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 inline-block border border-blue-200" />Today</span>
        <span className="text-green-600 font-medium">Click empty = Book</span>
      </div>
    </div>
  );
};

// ─── Main Hotel Page ──────────────────────────────────────────────────────────

const Hotel: React.FC = () => {
  const {
    hotelRooms, hotelBookings,
    addHotelRoom, updateHotelRoom, deleteHotelRoom,
    addHotelBooking, updateHotelBooking, deleteHotelBooking,
    checkInGuest, checkOutGuest,
    currentUser, products, transactions, storeSettings, updateStoreSettings
  } = useStore();

  const isAdmin = currentUser?.role === Role.ADMIN;
  const [activeTab, setActiveTab] = useState<HotelTab>('ARRIVING');

  // Modals
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editRoom, setEditRoom] = useState<HotelRoom | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [editBooking, setEditBooking] = useState<HotelBooking | null>(null);
  const [preselectedRoomId, setPreselectedRoomId] = useState('');
  const [preselectedDate, setPreselectedDate] = useState('');
  const [checkoutBooking, setCheckoutBooking] = useState<HotelBooking | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<{ booking: HotelBooking; isEdit: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [deleteRoomConfirm, setDeleteRoomConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);
  const paperSize = (storeSettings.receiptPaperSize || '80mm') as '48mm' | '58mm' | '80mm';
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);

  // Live rates — DB overrides, fallback to hardcoded constants
  const activeRates: Record<BookingTypeKey, Record<PetSizeKey, number>> = {
    ...HOTEL_RATES,
    ...(storeSettings.hotelRates as Record<BookingTypeKey, Record<PetSizeKey, number>> | undefined),
  } as Record<BookingTypeKey, Record<PetSizeKey, number>>;
  const activeLabels: Record<BookingTypeKey, string> = {
    ...BOOKING_TYPE_LABELS,
    ...(storeSettings.hotelBookingTypeLabels as Record<BookingTypeKey, string> | undefined),
  } as Record<BookingTypeKey, string>;
  const activeExtras: { id: string; label: string; price: number }[] =
    storeSettings.hotelExtras && storeSettings.hotelExtras.length > 0
      ? storeSettings.hotelExtras
      : HOTEL_EXTRAS;

  // Rates editor local state
  const [draftRates, setDraftRates] = useState<Record<string, Record<string, number>>>(activeRates);
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>(activeLabels);
  const [draftExtras, setDraftExtras] = useState<{ id: string; label: string; price: number }[]>(activeExtras);

  const openRatesModal = () => {
    setDraftRates({ ...activeRates });
    setDraftLabels({ ...activeLabels });
    setDraftExtras([...activeExtras]);
    setShowRatesModal(true);
  };

  const saveRates = () => {
    updateStoreSettings({ ...storeSettings, hotelRates: draftRates, hotelBookingTypeLabels: draftLabels, hotelExtras: draftExtras });
    setShowRatesModal(false);
  };

  // History filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyRange, setHistoryRange] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('TODAY');

  const scrollRef = useRef<HTMLDivElement>(null);

  // Live clock
  const [phTime, setPhTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setPhTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const today = getPhToday();
  const displayTime = phTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
  const displayDate = phTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });

  // Tab counts
  const counts = useMemo(() => ({
    UPCOMING:  hotelBookings.filter(b => b.status === 'RESERVED' && b.check_in > today).length,
    ARRIVING:  hotelBookings.filter(b => b.status === 'RESERVED' && b.check_in <= today).length,
    OCCUPIED:  hotelBookings.filter(b => b.status === 'CHECKED_IN').length,
    COMPLETED: hotelBookings.filter(b => b.status === 'CHECKED_OUT' || b.status === 'CANCELLED').length,
  }), [hotelBookings, today]);

  // Is in history range — uses actual_check_out (real checkout datetime) when available
  const isInRange = (b: HotelBooking) => {
    if (historyRange === 'ALL') return true;
    // Use actual checkout date (real) vs scheduled — actual_check_out is an ISO timestamp
    const effectiveDateStr = b.actual_check_out
      ? new Date(b.actual_check_out).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
      : b.check_out;
    if (historyRange === 'TODAY') return effectiveDateStr === today;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [y, m, d] = effectiveDateStr.split('-').map(Number);
    const checkDate = new Date(y, m - 1, d);
    if (historyRange === 'WEEK') {
      const w = new Date(todayDate);
      w.setDate(todayDate.getDate() - 7);
      return checkDate >= w && checkDate <= todayDate;
    }
    if (historyRange === 'MONTH') return y === now.getFullYear() && m === now.getMonth() + 1;
    return true;
  };

  const filteredBookings = useMemo(() => {
    return hotelBookings.filter(b => {
      if (activeTab === 'UPCOMING')  return b.status === 'RESERVED' && b.check_in > today;
      if (activeTab === 'ARRIVING')  return b.status === 'RESERVED' && b.check_in <= today;
      if (activeTab === 'OCCUPIED')  return b.status === 'CHECKED_IN';
      if (activeTab === 'COMPLETED') {
        if (b.status !== 'CHECKED_OUT' && b.status !== 'CANCELLED') return false;
        if (!isInRange(b)) return false;
        if (historySearch) {
          const norm = normalizeText(historySearch);
          return normalizeText(b.pet_name).includes(norm) || normalizeText(b.owner_name).includes(norm);
        }
        return true;
      }
      return false;
    }).sort((a, b) => {
      if (activeTab === 'COMPLETED') {
        // Sort by actual checkout date (most recent first)
        const aDate = a.actual_check_out || a.check_out;
        const bDate = b.actual_check_out || b.check_out;
        return bDate.localeCompare(aDate);
      }
      return a.check_in.localeCompare(b.check_in);
    });
  }, [hotelBookings, activeTab, today, historySearch, historyRange]);

  const openNewBooking = (roomId = '', date = '') => {
    setEditBooking(null);
    setPreselectedRoomId(roomId);
    setPreselectedDate(date);
    setShowBookingForm(true);
  };

  // Stats
  const occupied = hotelBookings.filter(b => b.status === 'CHECKED_IN').length;
  const reserved = hotelBookings.filter(b => b.status === 'RESERVED').length;
  const arriving = hotelBookings.filter(b => b.status === 'RESERVED' && b.check_in <= today).length;
  const totalActive = hotelRooms.filter(r => r.is_active).length;

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col gap-4 overflow-hidden" style={{color: '#2d1b4e'}}>
      {/* Header */}
      <div className="bg-white rounded-3xl border border-purple-50 shadow-sm p-4 flex flex-col md:flex-row justify-between gap-4 relative overflow-hidden">
        {/* Asset decorations */}
        <img src="/Assets/roof.png" alt="" className="absolute right-60 top-0 w-20 opacity-10 pointer-events-none" />
        <img src="/Assets/Asset 10.png" alt="" className="absolute right-36 top-2 w-14 opacity-15 pointer-events-none" />
        <img src="/Assets/bathtub with pets.png" alt="" className="absolute right-2 -bottom-4 w-24 opacity-15 pointer-events-none" />
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2" style={{color: '#4A2D7A', fontFamily: 'Poppins, sans-serif'}}>
            <BedDouble className="w-7 h-7" style={{color: '#7B55A8'}} />Pet Hotel
          </h1>
          <p className="text-sm text-purple-300 font-medium mt-0.5">{displayDate}</p>
          <p className="text-xs text-purple-300 font-mono">{displayTime}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <button onClick={openRatesModal} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors" style={{background: '#FFF3E0', color: '#E67E00'}}>
                <Star className="w-4 h-4" />Edit Rates
              </button>
              <button onClick={() => { setEditRoom(null); setShowRoomForm(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors" style={{background: '#EDE0F7', color: '#6B4FA0'}}>
                <Building2 className="w-4 h-4" />Manage Rooms
              </button>
            </>
          )}
          <button onClick={() => openNewBooking()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg transition-colors text-white" style={{background: 'linear-gradient(135deg, #4A2D7A, #7B55A8)'}}>
            <Plus className="w-4 h-4" />Book Room
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Rooms', val: totalActive, style: {background: 'linear-gradient(135deg, #4A2D7A, #6B4FA0)'} },
          { label: 'Occupied Now', val: occupied, style: {background: 'linear-gradient(135deg, #dc2626, #ef4444)'} },
          { label: 'Arriving Today', val: arriving, style: {background: 'linear-gradient(135deg, #d97706, #f59e0b)'} },
          { label: 'Reserved', val: reserved, style: {background: 'linear-gradient(135deg, #2563eb, #3b82f6)'} },
        ].map(s => (
          <div key={s.label} className="text-white rounded-2xl p-4 shadow-md" style={s.style}>
            <p className="text-3xl font-black" style={{fontFamily: 'Poppins, sans-serif'}}>{s.val}</p>
            <p className="text-xs font-medium opacity-80 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Content area */}
      <div className="flex-1 bg-white rounded-3xl border border-zinc-100 shadow-sm flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="p-4 border-b border-zinc-100 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
          <div className="flex bg-zinc-100 p-1 rounded-xl w-full xl:w-auto overflow-x-auto">
            {([
              { id: 'UPCOMING' as HotelTab, label: 'Upcoming', Icon: Calendar, active: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
              { id: 'ARRIVING' as HotelTab, label: 'Arriving', Icon: Clock, active: 'text-amber-600', badge: 'bg-amber-100 text-amber-600' },
              { id: 'OCCUPIED' as HotelTab, label: 'Occupied', Icon: BedDouble, active: 'text-blue-600', badge: 'bg-blue-100 text-blue-600' },
              { id: 'COMPLETED' as HotelTab, label: 'History', Icon: CheckCircle, active: 'text-green-700', badge: 'bg-green-100 text-green-700' },
            ] as const).map(({ id, label, Icon, active, badge }) => (
              <button key={id} onClick={() => setActiveTab(id)} className={`flex-1 min-w-[110px] px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${activeTab === id ? `bg-white shadow-sm ${active}` : 'text-zinc-400 hover:text-zinc-700'}`}>
                <Icon className="w-4 h-4" />{label}
                <span className={`px-1.5 rounded text-xs font-bold ${activeTab === id ? badge : 'bg-zinc-200 text-zinc-500'}`}>{counts[id]}</span>
              </button>
            ))}
          </div>

          {/* History filters */}
          {activeTab === 'COMPLETED' && (
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search history..." className="pl-9 pr-3 py-2 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-black outline-none w-44 bg-zinc-50 focus:bg-white" />
              </div>
              <div className="flex bg-zinc-100 p-1 rounded-xl">
                {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as const).map(r => (
                  <button key={r} onClick={() => setHistoryRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${historyRange === r ? 'bg-white shadow-sm text-purple-900' : 'text-zinc-500 hover:text-purple-900'}`}>{r}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cards grid */}
        <div className="flex-1 overflow-auto p-4" ref={scrollRef}>
          {activeTab === 'OCCUPIED' && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-sm text-blue-700 font-medium flex items-center gap-2">
              <BedDouble className="w-4 h-4 flex-shrink-0" />
              Occupied rooms — click <strong>"Check Out"</strong> to process payment and complete the stay.
            </div>
          )}
          {filteredBookings.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 min-h-48">
              <BedDouble className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-medium">No bookings found.</p>
              {activeTab === 'ARRIVING' && <p className="text-xs mt-1">No arrivals today — {today}</p>}
              {activeTab === 'COMPLETED' && <p className="text-xs mt-1">Try adjusting the time filter.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
              {filteredBookings.map(booking => {
                const room = hotelRooms.find(r => r.id === booking.room_id);
                const addonsDisplay = (booking.addon_ids || []).map(id => products.find(p => p.id === id)?.name).filter(Boolean);

                return (
                  <div key={booking.id} className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-100 flex flex-col relative group hover:shadow-md transition-shadow">
                    {/* Top row */}
                    <div className="flex justify-between items-start mb-3">
                      <div className={`text-xs font-bold px-3 py-1 rounded-full border ${booking.check_in === today ? 'bg-purple-900 text-white border-zinc-900' : 'bg-white text-zinc-900 border-zinc-200'}`}>
                        {booking.check_in === today ? 'TODAY' : fmtDate(booking.check_in)} → {fmtDate(booking.check_out)}
                      </div>
                      <div className="flex items-center gap-2">
                        {(booking.status === 'RESERVED' || booking.status === 'CHECKED_IN') && (
                          <div className="flex items-center bg-zinc-50 rounded-lg p-0.5 border border-zinc-100">
                            <button onClick={() => { setEditBooking(booking); setShowBookingForm(true); }} className="p-1.5 text-zinc-400 hover:text-purple-900 hover:bg-white rounded-md transition-all" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                            <div className="w-px h-3 bg-zinc-200 mx-0.5" />
                            <button onClick={() => setDeleteConfirm({ open: true, id: booking.id, name: booking.pet_name })} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-white rounded-md transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                        <StatusBadge status={booking.status} />
                      </div>
                    </div>

                    {/* Pet info */}
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-zinc-900 leading-tight">🐾 {booking.pet_name}</h3>
                      <p className="text-sm text-zinc-500 flex items-center gap-1 mt-1"><User className="w-3 h-3" />{booking.owner_name} {booking.contact_number && <span className="text-zinc-400">({booking.contact_number})</span>}</p>
                      {booking.notes && <div className="mt-2 text-xs bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-100 italic"><span className="font-bold not-italic">📝 Note:</span> {booking.notes}</div>}
                    </div>

                    {/* Booking type + rate details */}
                    <div className="space-y-1.5 mb-5">
                      {booking.booking_type && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-lg">
                            {booking.booking_type === 'DAYCARE' ? '☀️ Daycare' : booking.booking_type === 'OVERNIGHT' ? '🌙 Overnight' : booking.booking_type === 'STAYCATION_3D2N' ? '🏠 Staycation 3D2N' : booking.booking_type === 'STAYCATION_4D3N' ? '🏡 Staycation 4D3N' : '🌴 Vacation'}
                          </span>
                          {booking.pet_size && <span className="text-xs font-bold bg-zinc-100 text-zinc-600 px-2 py-1 rounded-lg">{booking.pet_size}</span>}
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm border-t border-zinc-100 pt-3">
                        <span className="text-zinc-400">Rate</span>
                        <span className="font-bold text-green-700">₱{booking.daily_rate.toLocaleString()}</span>
                      </div>
                      {room && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-400">Room</span>
                          <span className="font-bold text-zinc-800">{room.room_number} — {room.room_name}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400">Dates</span>
                        <span className="font-bold text-zinc-800">{fmtDate(booking.check_in)} → {fmtDate(booking.check_out)}</span>
                      </div>
                    </div>

                    {/* Furparent Updates — only for checked-in pets */}
                    {booking.status === 'CHECKED_IN' && (() => {
                      const fu = booking.furparent_updates || { am: false, pm: false, evening: false };
                      const toggle = async (key: 'am' | 'pm' | 'evening') => {
                        const updated = { ...fu, [key]: !fu[key] };
                        await updateHotelBooking({ ...booking, furparent_updates: updated });
                      };
                      return (
                        <div className="mb-4 bg-purple-50 rounded-2xl px-4 py-3 border border-purple-100">
                          <p className="text-xs font-black text-purple-700 uppercase tracking-wide mb-2.5">🐾 Furparent Updates</p>
                          <div className="flex items-center gap-4">
                            {(['am', 'pm', 'evening'] as const).map(slot => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => toggle(slot)}
                                className="flex items-center gap-1.5 group"
                              >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${fu[slot] ? 'bg-green-500 border-green-500' : 'border-zinc-300 bg-white group-hover:border-purple-400'}`}>
                                  {fu[slot] && <span className="text-white text-xs font-black">✓</span>}
                                </div>
                                <span className={`text-xs font-bold uppercase ${fu[slot] ? 'text-green-700' : 'text-zinc-400'}`}>
                                  {slot === 'am' ? 'AM' : slot === 'pm' ? 'PM' : 'Eve'}
                                </span>
                                <span className="text-base">📸</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Action buttons — mirrors Grooming page */}
                    <div className="mt-auto">
                      {booking.status === 'RESERVED' && booking.check_in <= today && (
                        <button
                          className="w-full bg-purple-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-purple-800 transition-all active:scale-95 shadow-lg shadow-zinc-200"
                          onClick={() => checkInGuest(booking.id)}
                        >
                          Check In Guest <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                      {booking.status === 'RESERVED' && booking.check_in > today && (
                        <div className="w-full text-center py-2.5 text-sm text-zinc-400 font-medium bg-zinc-50 rounded-xl border border-zinc-100">
                          Arriving {fmtDate(booking.check_in)}
                        </div>
                      )}
                      {booking.status === 'CHECKED_IN' && (
                        <button
                          className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-100 flex justify-center items-center gap-2"
                          onClick={() => setCheckoutBooking(booking)}
                        >
                          <CheckCircle className="w-4 h-4" />Check Out & Pay
                        </button>
                      )}
                      {(booking.status === 'CHECKED_OUT' || booking.status === 'CANCELLED') && (
                        <div className="flex gap-2">
                          <div className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl border border-zinc-100 bg-zinc-50 text-zinc-400">
                            {booking.status === 'CHECKED_OUT' ? <><CheckCircle className="w-4 h-4 text-green-500" />Done</> : <><Ban className="w-4 h-4" />Cancelled</>}
                          </div>
                          <button
                            onClick={() => { setEditBooking(null); setPreselectedRoomId(booking.room_id); setPreselectedDate(getPhToday()); setShowBookingForm(true); }}
                            title="Rebook same room"
                            className="px-3 py-2 border border-zinc-200 text-zinc-500 rounded-xl hover:bg-zinc-50 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteConfirm({ open: true, id: booking.id, name: booking.pet_name })} className="px-3 py-2 border border-red-100 text-red-400 rounded-xl hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showRoomForm && (
        <div>
          {/* Room list modal */}
          <div className="fixed inset-0 bg-purple-700/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900">Manage Rooms</h2>
                <button onClick={() => { setShowRoomForm(false); setEditRoom(null); }} className="p-2 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {hotelRooms.length === 0 && <p className="text-center text-zinc-400 py-8">No rooms yet.</p>}
                {hotelRooms.map(r => (
                  <div key={r.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${r.is_active ? 'border-zinc-200 bg-white hover:border-purple-200' : 'border-zinc-100 bg-zinc-50 opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900">{r.room_number} — {r.room_name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-lg font-medium">{r.room_type}</span>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg font-medium">Max {r.capacity} pet{r.capacity !== 1 ? 's' : ''}</span>
                        {r.is_active
                          ? <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-lg font-medium">● Active</span>
                          : <span className="text-xs bg-zinc-100 text-zinc-400 px-2 py-0.5 rounded-lg font-medium">○ Inactive</span>}
                      </div>
                      {r.description && <p className="text-xs text-zinc-400 mt-1 truncate">{r.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditRoom(r)} className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50"><Pencil className="w-4 h-4 text-zinc-500" /></button>
                      <button onClick={() => setDeleteRoomConfirm({ open: true, id: r.id, name: r.room_number })} className="p-2 rounded-xl border border-red-100 hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-zinc-100">
                <button onClick={() => setEditRoom({} as HotelRoom)} className="w-full flex items-center justify-center gap-2 bg-purple-700 text-white py-3 rounded-xl font-semibold hover:bg-purple-800">
                  <Plus className="w-4 h-4" />Add New Room
                </button>
              </div>
            </div>
          </div>
          {/* Edit/Add room sub-modal */}
          {editRoom !== null && (
            <RoomForm
              room={editRoom.id ? editRoom : null}
              onSave={async r => { editRoom.id ? await updateHotelRoom(r) : await addHotelRoom(r); setEditRoom(null); }}
              onClose={() => setEditRoom(null)}
            />
          )}
        </div>
      )}

      {showBookingForm && (
        <BookingForm
          booking={editBooking}
          preselectedRoomId={preselectedRoomId}
          preselectedDate={preselectedDate}
          onSave={async b => {
            if (editBooking) {
              await updateHotelBooking(b);
              setConfirmedBooking({ booking: b, isEdit: true });
            } else {
              await addHotelBooking(b);
              setConfirmedBooking({ booking: b, isEdit: false });
            }
            setShowBookingForm(false);
            setEditBooking(null);
          }}
          onClose={() => { setShowBookingForm(false); setEditBooking(null); }}
        />
      )}

      {confirmedBooking && (
        <BookingConfirmationModal
          booking={confirmedBooking.booking}
          isEdit={confirmedBooking.isEdit}
          onClose={() => setConfirmedBooking(null)}
        />
      )}

      {checkoutBooking && (
        <CheckoutModal
          booking={checkoutBooking}
          onConfirm={async (method, cash, ref, recalcTotal, lateAmount, lateLabel) => {
            const bk = checkoutBooking; // capture before clearing
            // Pass the FULL grandTotal (before downpayment) — checkOutGuest handles the deduction internally
            await checkOutGuest(bk.id, method, cash, ref, recalcTotal, lateAmount, lateLabel);
            setCheckoutBooking(null);
            // Build the receipt from booking data
            const room = hotelRooms.find(r => r.id === bk.room_id);
            const bkType = bk.booking_type as BookingTypeKey | undefined;
            const bkSize = bk.pet_size || '';
            const stayLabel = bkType ? `${activeLabels[bkType] || bkType} · ${bkSize}${room ? ` (${room.room_name})` : ''}` : `Hotel Stay${room ? ` – ${room.room_name}` : ''}`;
            // packageTotal = base package rate only (extras are separate line items below)
            const packageTotal = bk.daily_rate;
            const nightlyItem = { id: `hotel-stay-${bk.id}`, name: stayLabel, price: packageTotal, cost: 0, stock: 1, category: 'HOTEL', isService: true, quantity: 1, appliedDiscounts: [] };
            const allItems: typeof nightlyItem[] = [nightlyItem];

            // Add hotel_extras as separate line items
            const extrasLookup: { id: string; label: string; price: number }[] =
              storeSettings.hotelExtras && storeSettings.hotelExtras.length > 0
                ? storeSettings.hotelExtras as { id: string; label: string; price: number }[]
                : HOTEL_EXTRAS;
            (bk.hotel_extras || []).forEach(e => {
              const extraDef = extrasLookup.find(x => x.id === e.id);
              if (extraDef && e.qty > 0) {
                allItems.push({
                  id: `hotel-extra-${e.id}-${bk.id}`,
                  name: `${extraDef.label}${e.qty > 1 ? ` ×${e.qty}` : ''}`,
                  price: extraDef.price * e.qty,
                  cost: 0, stock: 1, category: 'HOTEL', isService: true,
                  quantity: e.qty,
                  appliedDiscounts: [],
                });
              }
            });

            // Add late checkout fee as a separate line item
            if (lateAmount && lateAmount > 0 && lateLabel) {
              allItems.push({
                id: `hotel-late-${bk.id}`,
                name: `Late Check-Out: ${lateLabel}`,
                price: lateAmount,
                cost: 0, stock: 1, category: 'HOTEL', isService: true,
                quantity: 1,
                appliedDiscounts: [],
              });
            }

            const subtotal = allItems.reduce((s, i) => s + i.price, 0);
            const vatRate = storeSettings.hotelVatEnabled ? (storeSettings.vatRate || 0) / 100 : 0;
            const vat = parseFloat((subtotal * vatRate).toFixed(2));
            const grossTotal = parseFloat((subtotal + vat).toFixed(2));
            // Apply downpayment deduction
            const dpAmount = Math.min(bk.downpayment || 0, grossTotal);
            const total = parseFloat(Math.max(0, grossTotal - dpAmount).toFixed(2));
            setReceiptTransaction({ id: `HTL-${bk.id.slice(-6)}`, items: allItems, subtotal, vat, total, discount: 0, downpayment: dpAmount > 0 ? dpAmount : undefined, paymentMethod: method, gcashRef: ref || '', cashReceived: cash || total, date: new Date().toISOString(), cashierId: 'HOTEL' });
          }}

          onClose={() => setCheckoutBooking(null)}
        />
      )}

      {/* Receipt Preview Modal */}
      {receiptTransaction && (
        <div className="fixed inset-0 bg-purple-900/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-purple-800 rounded-2xl p-4 shadow-2xl relative flex flex-col max-h-[90vh] w-full max-w-md">
            <div className="flex justify-between items-center mb-4 text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><Printer className="w-5 h-5" /> Print Receipt?</h3>
              <button onClick={() => setReceiptTransaction(null)} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Paper size info (read-only, configured in Settings) */}
            <div className="bg-purple-900/50 p-3 rounded-xl mb-4 flex items-center justify-between">
              <span className="text-white text-sm font-bold">Paper Size</span>
              <span className="text-sm font-bold bg-purple-700 text-white px-3 py-1 rounded-lg">{paperSize}</span>
            </div>
            <div className="flex-1 overflow-auto bg-purple-900/30 rounded-xl p-4 flex justify-center items-start">
              <div className="shadow-2xl shadow-black/50">
                <ReceiptTemplate transaction={receiptTransaction} settings={storeSettings} paperSize={paperSize} isPreview={true} />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setReceiptTransaction(null)} className="flex-1 border border-white/20 text-white py-2.5 rounded-xl font-semibold hover:bg-white/10">Skip</button>
              <button
                onClick={() => {
                  const existingStyle = document.getElementById('thermal-print-style');
                  if (existingStyle) existingStyle.remove();
                  const style = document.createElement('style');
                  style.id = 'thermal-print-style';
                  style.textContent = `@media print { @page { size: ${paperSize} auto; margin: 0; } }`;
                  document.head.appendChild(style);
                  setTimeout(() => window.print(), 300);
                }}
                className="flex-[2] bg-white text-purple-900 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-50"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Layout */}
      {receiptTransaction && (
        <div id="printable-content" className="hidden print:block fixed inset-0 bg-white z-[9999] p-2">
          <ReceiptTemplate transaction={receiptTransaction} settings={storeSettings} paperSize={paperSize} />
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.open}
        title="Delete Booking?"
        message={`Are you sure you want to delete the booking for ${deleteConfirm.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { deleteHotelBooking(deleteConfirm.id); setDeleteConfirm({ open: false, id: '', name: '' }); }}
        onCancel={() => setDeleteConfirm({ open: false, id: '', name: '' })}
      />

      <ConfirmModal
        isOpen={deleteRoomConfirm.open}
        title="Delete Room?"
        message={`Delete Room ${deleteRoomConfirm.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { deleteHotelRoom(deleteRoomConfirm.id); setDeleteRoomConfirm({ open: false, id: '', name: '' }); }}
        onCancel={() => setDeleteRoomConfirm({ open: false, id: '', name: '' })}
      />

      {/* ── Edit Rates & Packages Modal ──────────────────────────────── */}
      {showRatesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setShowRatesModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between" style={{background: 'linear-gradient(135deg, #4A2D7A, #7B55A8)'}}>
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2"><Star className="w-5 h-5 text-yellow-300" /> Edit Rates & Packages</h2>
                <p className="text-purple-200 text-xs mt-0.5">Edit package names and prices per pet size. Changes save immediately.</p>
              </div>
              <button onClick={() => setShowRatesModal(false)} className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {(Object.keys(HOTEL_RATES) as BookingTypeKey[]).map((typeKey) => {
                const emoji = typeKey === 'DAYCARE' ? '🌞' : typeKey === 'OVERNIGHT' ? '🌙' : typeKey === 'STAYCATION_3D2N' ? '🏠' : typeKey === 'STAYCATION_4D3N' ? '🏡' : '🌴';
                return (
                  <div key={typeKey} className="bg-zinc-50 rounded-2xl border border-zinc-100 overflow-hidden">
                    {/* Package name edit */}
                    <div className="px-4 py-3 bg-white border-b border-zinc-100">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide block mb-1">Package Name</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{emoji}</span>
                        <input
                          type="text"
                          value={draftLabels[typeKey] ?? BOOKING_TYPE_LABELS[typeKey]}
                          onChange={e => setDraftLabels(prev => ({ ...prev, [typeKey]: e.target.value }))}
                          className="flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                    </div>
                    {/* Price grid */}
                    <div className="p-4">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide block mb-3">Price per Pet Size (₱)</label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {PET_SIZES.map(size => (
                          <div key={size} className="flex flex-col items-center gap-1">
                            <span className="text-xs font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-lg">{size}</span>
                            <input
                              type="number"
                              min={0}
                              value={draftRates[typeKey]?.[size] ?? HOTEL_RATES[typeKey][size]}
                              onChange={e => setDraftRates(prev => ({
                                ...prev,
                                [typeKey]: { ...(prev[typeKey] || HOTEL_RATES[typeKey]), [size]: Number(e.target.value) }
                              }))}
                              className="w-full border border-zinc-200 rounded-xl px-2 py-2 text-center text-sm font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add-ons & Services Editor — inside scrollable body */}
              <div className="bg-amber-50 rounded-2xl border border-amber-100 overflow-hidden">
                <div className="px-4 py-3 bg-white border-b border-amber-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-zinc-800">🍗 Add-ons &amp; Services</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">Meal Prep, Reheating, Special Instructions, etc.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftExtras(prev => [...prev, { id: `extra-${Date.now()}`, label: 'New Add-on', price: 0 }])}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all"
                  >+ Add</button>
                </div>
                <div className="p-4 space-y-3">
                  {draftExtras.map((extra, idx) => (
                    <div key={extra.id} className="flex items-center gap-3 bg-white rounded-xl border border-zinc-100 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={extra.label}
                          onChange={e => setDraftExtras(prev => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                          placeholder="Add-on name"
                          className="w-full text-sm font-semibold text-zinc-800 border-0 outline-none bg-transparent"
                        />
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-zinc-400">₱</span>
                        <input
                          type="number"
                          min={0}
                          value={extra.price}
                          onChange={e => setDraftExtras(prev => prev.map((x, i) => i === idx ? { ...x, price: Number(e.target.value) } : x))}
                          className="w-20 border border-zinc-200 rounded-lg px-2 py-1 text-center text-sm font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setDraftExtras(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 transition-colors text-lg leading-none ml-1"
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 flex gap-3 flex-shrink-0">
              <button onClick={() => setShowRatesModal(false)} className="flex-1 py-3 rounded-2xl font-semibold text-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all">
                Cancel
              </button>
              <button onClick={saveRates} className="flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-all shadow-lg" style={{background: 'linear-gradient(135deg, #4A2D7A, #7B55A8)'}}>
                ✓ Save Rates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hotel;