
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { HotelRoom, HotelBooking, HotelBookingStatus, Role, Client, Pet } from '../types';
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
    daily_rate: room?.daily_rate || 0,
    capacity: room?.capacity || 1,
    description: room?.description || '',
    is_active: room?.is_active ?? true,
  });
  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-purple-700/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900">{room ? 'Edit Room' : 'Add New Room'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Room No. *</label>
              <input value={form.room_number} onChange={e => set('room_number', e.target.value)} placeholder="A1" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Room Name *</label>
              <input value={form.room_name} onChange={e => set('room_name', e.target.value)} placeholder="Sunny Suite" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Type</label>
              <input value={form.room_type} onChange={e => set('room_type', e.target.value)} placeholder="Standard / Deluxe" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Max Pets</label>
              <input type="number" min={1} value={form.capacity} onChange={e => set('capacity', parseInt(e.target.value) || 1)} className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Daily Rate (₱) *</label>
            <input type="number" min={0} value={form.daily_rate} onChange={e => set('daily_rate', parseFloat(e.target.value) || 0)} className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none resize-none" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-10 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-purple-700' : 'bg-zinc-300'}`} onClick={() => set('is_active', !form.is_active)}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_active ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-sm font-medium text-zinc-700">{form.is_active ? 'Active (bookable)' : 'Inactive'}</span>
          </label>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-zinc-200 text-zinc-700 py-3 rounded-xl font-semibold hover:bg-zinc-50">Cancel</button>
          <button
            onClick={() => { if (!form.room_number || !form.room_name || form.daily_rate <= 0) return; onSave({ id: room?.id || crypto.randomUUID(), ...form }); }}
            disabled={!form.room_number || !form.room_name || form.daily_rate <= 0}
            className="flex-1 bg-purple-700 text-white py-3 rounded-xl font-semibold hover:bg-purple-800 disabled:opacity-40"
          >Save Room</button>
        </div>
      </div>
    </div>
  );
};

// ─── Booking Form Modal ───────────────────────────────────────────────────────

const BookingForm: React.FC<{
  booking?: HotelBooking | null;
  preselectedRoomId?: string;
  preselectedDate?: string;
  onSave: (b: HotelBooking) => void;
  onClose: () => void;
}> = ({ booking, preselectedRoomId, preselectedDate, onSave, onClose }) => {
  const { hotelRooms, hotelBookings, clients, products, currentUser } = useStore();
  const today = getPhToday();
  const activeRooms = hotelRooms.filter(r => r.is_active);
  const services = products.filter(p => p.isService);

  const [form, setForm] = useState({
    room_id: booking?.room_id || preselectedRoomId || '',
    pet_name: booking?.pet_name || '',
    pet_breed: '',
    owner_name: booking?.owner_name || '',
    contact_number: booking?.contact_number || '',
    email: booking?.email || '',
    check_in: booking?.check_in || preselectedDate || today,
    check_out: booking?.check_out || addDays(preselectedDate || today, 1),
    addon_ids: booking?.addon_ids || [] as string[],
    notes: booking?.notes || '',
    client_id: booking?.client_id || '',
    pet_id: booking?.pet_id || '',
  });
  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  // Client autocomplete
  const [clientSearch, setClientSearch] = useState(booking?.owner_name || '');
  const [showClientSugg, setShowClientSugg] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showPetSugg, setShowPetSugg] = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);
  const petRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (booking?.client_id) {
      const c = clients.find(x => x.id === booking.client_id);
      if (c) setSelectedClient(c);
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setShowClientSugg(false);
      if (petRef.current && !petRef.current.contains(e.target as Node)) setShowPetSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return [];
    const norm = normalizeText(clientSearch);
    return clients.filter(c => normalizeText(c.name).includes(norm) || normalizeText(c.contactNumber || '').includes(norm)).slice(0, 5);
  }, [clients, clientSearch]);

  const selectClient = (c: Client) => {
    setSelectedClient(c);
    setClientSearch(c.name);
    set('owner_name', c.name);
    set('contact_number', c.contactNumber || '');
    set('email', c.email || '');
    set('client_id', c.id);
    set('pet_id', '');
    set('pet_name', '');
    setShowClientSugg(false);
  };

  const selectPet = (p: Pet) => {
    set('pet_name', p.name);
    set('pet_id', p.id);
    set('pet_breed', p.breed || '');
    setShowPetSugg(false);
  };

  const selectedRoom = activeRooms.find(r => r.id === form.room_id);
  const nights = diffDays(form.check_in, form.check_out);
  const addonTotal = form.addon_ids.reduce((s, id) => { const p = products.find(x => x.id === id); return s + (p?.price || 0); }, 0);
  const total = (selectedRoom?.daily_rate || 0) * nights + addonTotal;

  const conflict = hotelBookings.some(b =>
    b.id !== booking?.id && b.room_id === form.room_id &&
    b.status !== 'CANCELLED' && b.status !== 'CHECKED_OUT' &&
    form.check_in < b.check_out && form.check_out > b.check_in
  );

  const handleSave = () => {
    if (!form.room_id || !form.pet_name || !form.owner_name || conflict) return;
    onSave({
      id: booking?.id || crypto.randomUUID(),
      room_id: form.room_id,
      client_id: form.client_id,
      pet_id: form.pet_id,
      pet_name: form.pet_name,
      owner_name: form.owner_name,
      contact_number: form.contact_number,
      email: form.email,
      check_in: form.check_in,
      check_out: form.check_out,
      actual_check_in: booking?.actual_check_in || '',
      actual_check_out: booking?.actual_check_out || '',
      status: booking?.status || 'RESERVED',
      daily_rate: selectedRoom?.daily_rate || 0,
      total_nights: nights,
      total_amount: total,
      addon_ids: form.addon_ids,
      notes: form.notes,
      staff_id: currentUser?.id || '',
      transaction_id: booking?.transaction_id || '',
    });
  };

  return (
    <div className="fixed inset-0 bg-purple-700/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-zinc-900">{booking ? 'Edit Booking' : '🐾 New Hotel Booking'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Room & Dates */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Room *</label>
            <select value={form.room_id} onChange={e => set('room_id', e.target.value)} className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none">
              <option value="">Select a room...</option>
              {activeRooms.map(r => <option key={r.id} value={r.id}>{r.room_number} – {r.room_name} ({r.room_type}) · ₱{r.daily_rate.toLocaleString()}/night</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Check-In *</label>
              <input type="date" value={form.check_in} min={today} onChange={e => { set('check_in', e.target.value); if (e.target.value >= form.check_out) set('check_out', addDays(e.target.value, 1)); }} className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Check-Out *</label>
              <input type="date" value={form.check_out} min={addDays(form.check_in, 1)} onChange={e => set('check_out', e.target.value)} className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
            </div>
          </div>

          {conflict && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />This room is already booked for these dates.
            </div>
          )}
          {selectedRoom && nights > 0 && (
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-zinc-500">₱{selectedRoom.daily_rate.toLocaleString()} × {nights} night{nights !== 1 ? 's' : ''}</span><span className="font-bold">₱{(selectedRoom.daily_rate * nights).toLocaleString()}</span></div>
              {addonTotal > 0 && <div className="flex justify-between"><span className="text-zinc-500">Add-ons</span><span className="font-bold">₱{addonTotal.toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold text-base border-t border-zinc-200 pt-1 mt-1"><span>Total</span><span className="text-green-700">₱{total.toLocaleString()}</span></div>
            </div>
          )}

          {/* Owner autocomplete */}
          <div ref={clientRef} className="relative">
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Owner Name *</label>
            <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); set('owner_name', e.target.value); if (selectedClient && selectedClient.name !== e.target.value) setSelectedClient(null); setShowClientSugg(true); }} placeholder="Search or type owner name..." className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
            {showClientSugg && filteredClients.length > 0 && (
              <div className="absolute z-20 w-full bg-white border border-zinc-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                {filteredClients.map(c => (
                  <button key={c.id} onMouseDown={() => selectClient(c)} className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 text-sm border-b border-zinc-100 last:border-0">
                    <span className="font-semibold">{c.name}</span>
                    {c.contactNumber && <span className="text-zinc-400 ml-2">{c.contactNumber}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Pet Name with autocomplete */}
            <div ref={petRef} className="relative">
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Pet Name *</label>
              <input value={form.pet_name} onChange={e => { set('pet_name', e.target.value); set('pet_id', ''); }} onFocus={() => selectedClient && selectedClient.pets.length > 0 && setShowPetSugg(true)} placeholder="Buddy" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
              {showPetSugg && selectedClient && selectedClient.pets.length > 0 && (
                <div className="absolute z-20 w-full bg-white border border-zinc-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {selectedClient.pets.map(p => (
                    <button key={p.id} onMouseDown={() => selectPet(p)} className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 text-sm border-b border-zinc-100 last:border-0">
                      <span className="font-semibold">{p.name}</span>
                      {p.breed && <span className="text-zinc-400 ml-2">{p.breed}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Contact</label>
              <input value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="09XX..." className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@email.com" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none" />
          </div>

          {/* Add-ons */}
          {services.length > 0 && (
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Add-ons / Services</label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                {services.map(s => {
                  const checked = form.addon_ids.includes(s.id);
                  return (
                    <label key={s.id} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-sm transition-colors ${checked ? 'bg-purple-700 text-white border-purple-700' : 'border-zinc-200 hover:border-zinc-400'}`}>
                      <input type="checkbox" checked={checked} className="hidden" onChange={() => set('addon_ids', checked ? form.addon_ids.filter(id => id !== s.id) : [...form.addon_ids, s.id])} />
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${checked ? 'border-white bg-white' : 'border-zinc-300'}`}>{checked && <Check className="w-3 h-3 text-purple-900" />}</span>
                      <span className="truncate text-xs">{s.name}</span>
                      <span className={`ml-auto text-xs flex-shrink-0 ${checked ? 'text-zinc-300' : 'text-zinc-400'}`}>+₱{s.price.toLocaleString()}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Special Instructions</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Food preferences, medication, special care..." className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-black outline-none resize-none" />
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3 sticky bottom-0 bg-white border-t border-zinc-100">
          <button onClick={onClose} className="flex-1 border border-zinc-200 text-zinc-700 py-3 rounded-xl font-semibold hover:bg-zinc-50">Cancel</button>
          <button onClick={handleSave} disabled={!form.room_id || !form.pet_name || !form.owner_name || conflict} className="flex-1 bg-purple-700 text-white py-3 rounded-xl font-semibold hover:bg-purple-800 disabled:opacity-40">
            {booking ? 'Save Changes' : '🐾 Book Room'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Checkout Modal ───────────────────────────────────────────────────────────

const CheckoutModal: React.FC<{
  booking: HotelBooking;
  onConfirm: (method: 'CASH' | 'GCASH' | 'SPLIT', cash?: number, ref?: string) => void;
  onClose: () => void;
}> = ({ booking, onConfirm, onClose }) => {
  const { hotelRooms, products } = useStore();
  const room = hotelRooms.find(r => r.id === booking.room_id);
  const addons = (booking.addon_ids || []).map(id => products.find(p => p.id === id)).filter(Boolean) as any[];
  const addonTotal = addons.reduce((s, p) => s + p.price, 0);
  const grandTotal = booking.total_amount + addonTotal;

  const [method, setMethod] = useState<'CASH' | 'GCASH' | 'SPLIT'>('CASH');
  const [cash, setCash] = useState(grandTotal);
  const [ref, setRef] = useState('');

  return (
    <div className="fixed inset-0 bg-purple-700/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900">Check Out & Pay</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 space-y-2 text-sm">
            <div className="flex justify-between font-bold text-base"><span>🐾 {booking.pet_name}</span><span className="text-zinc-500">Room {room?.room_number}</span></div>
            <div className="flex justify-between text-zinc-500"><span>Stay ({booking.total_nights} night{booking.total_nights !== 1 ? 's' : ''})</span><span>₱{booking.total_amount.toLocaleString()}</span></div>
            {addons.map(p => <div key={p.id} className="flex justify-between text-zinc-500"><span>{p.name}</span><span>₱{p.price.toLocaleString()}</span></div>)}
            <div className="flex justify-between font-bold text-base border-t border-zinc-200 pt-2"><span>TOTAL</span><span className="text-green-700">₱{grandTotal.toLocaleString()}</span></div>
          </div>
          <div>
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
              {cash >= grandTotal && <p className="text-green-600 text-xs mt-1 font-bold">Change: ₱{(cash - grandTotal).toLocaleString()}</p>}
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
          <button onClick={() => onConfirm(method, cash, ref)} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />Confirm Checkout
          </button>
        </div>
      </div>
    </div>
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
    currentUser, products
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });

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

  // Is in history range
  const isInRange = (dateStr: string) => {
    if (historyRange === 'ALL') return true;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [y, m, d] = dateStr.split('-').map(Number);
    const checkDate = new Date(y, m - 1, d);
    if (historyRange === 'TODAY') return dateStr === today;
    if (historyRange === 'WEEK') { const w = new Date(todayDate); w.setDate(todayDate.getDate() - 7); return checkDate >= w && checkDate <= todayDate; }
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
        if (!isInRange(b.check_out)) return false;
        if (historySearch) {
          const norm = normalizeText(historySearch);
          return normalizeText(b.pet_name).includes(norm) || normalizeText(b.owner_name).includes(norm);
        }
        return true;
      }
      return false;
    }).sort((a, b) => {
      if (activeTab === 'COMPLETED') return b.check_out.localeCompare(a.check_out);
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
            <button onClick={() => { setEditRoom(null); setShowRoomForm(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors" style={{background: '#EDE0F7', color: '#6B4FA0'}}>
              <Building2 className="w-4 h-4" />Manage Rooms
            </button>
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

                    {/* Room + rate details */}
                    <div className="space-y-1.5 mb-5">
                      <div className="flex justify-between items-center text-sm border-t border-zinc-100 pt-3">
                        <span className="text-zinc-400">Room</span>
                        <span className="font-bold text-zinc-800">{room?.room_number} — {room?.room_name || '?'} <span className="text-zinc-400 font-normal">({room?.room_type})</span></span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400">Stay</span>
                        <span className="font-bold text-zinc-800">{booking.total_nights} night{booking.total_nights !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400">Amount</span>
                        <span className="font-bold text-green-700">₱{booking.total_amount.toLocaleString()}</span>
                      </div>
                      {addonsDisplay.length > 0 && (
                        <div className="flex justify-between items-start text-sm">
                          <span className="text-zinc-400">Add-ons</span>
                          <span className="font-medium text-zinc-600 text-right max-w-[60%]">{addonsDisplay.join(', ')}</span>
                        </div>
                      )}
                    </div>

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
                  <div key={r.id} className={`flex items-center justify-between p-4 rounded-2xl border ${r.is_active ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50 opacity-60'}`}>
                    <div>
                      <p className="font-bold text-zinc-900">{r.room_number} — {r.room_name}</p>
                      <p className="text-xs text-zinc-400">{r.room_type} · ₱{r.daily_rate.toLocaleString()}/night · Max {r.capacity} pet{r.capacity !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditRoom(r)} className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50"><Pencil className="w-4 h-4 text-zinc-500" /></button>
                      <button onClick={() => { if (window.confirm(`Delete Room ${r.room_number}?`)) deleteHotelRoom(r.id); }} className="p-2 rounded-xl border border-red-100 hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
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
          onSave={async b => { editBooking ? await updateHotelBooking(b) : await addHotelBooking(b); setShowBookingForm(false); setEditBooking(null); }}
          onClose={() => { setShowBookingForm(false); setEditBooking(null); }}
        />
      )}

      {checkoutBooking && (
        <CheckoutModal
          booking={checkoutBooking}
          onConfirm={async (method, cash, ref) => { await checkOutGuest(checkoutBooking.id, method, cash, ref); setCheckoutBooking(null); }}
          onClose={() => setCheckoutBooking(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 bg-purple-700/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-2">Delete Booking?</h3>
            <p className="text-zinc-500 text-sm mb-6">Are you sure you want to delete the booking for <strong>{deleteConfirm.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm({ open: false, id: '', name: '' })} className="flex-1 border border-zinc-200 py-2.5 rounded-xl font-semibold hover:bg-zinc-50">Cancel</button>
              <button onClick={() => { deleteHotelBooking(deleteConfirm.id); setDeleteConfirm({ open: false, id: '', name: '' }); }} className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-semibold hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hotel;
