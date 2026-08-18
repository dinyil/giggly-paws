/**
 * EditDiscountModal.tsx
 * Redesigned — purple palette, special discount with % or ₱ toggle,
 * slick premium layout matching the app's color system.
 */

import React, { useState, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { Tag, X, Percent, DollarSign, Trash2, Check, Lock, ShieldCheck } from 'lucide-react';
import { Transaction, Discount, StoreSettings } from '../types';

interface EditDiscountModalProps {
  transaction: Transaction;
  settings: StoreSettings;
  discounts: Discount[];
  adminPin: string;
  onSave: (updatedTx: Transaction, discountId?: string, specialAmt?: number) => void;
  onClose: () => void;
}

type DiscountMode = 'none' | 'existing' | 'special';
type SpecialType = 'percent' | 'amount';

const EditDiscountModal: React.FC<EditDiscountModalProps> = ({
  transaction,
  settings,
  discounts,
  adminPin,
  onSave,
  onClose,
}) => {
  // ── Gross total from items ───────────────────────────────────────────────
  const grossTotal = useMemo(
    () => transaction.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [transaction.items]
  );
  const downpayment = transaction.downpayment || 0;
  const currentDiscount = Number(transaction.discount ?? 0);

  // ── State ────────────────────────────────────────────────────────────────
  const initialMode: DiscountMode = currentDiscount > 0 ? 'existing' : 'none';
  const activeDiscounts = discounts.filter(d => d.active);

  // Auto-detect which discount from the list is currently applied by matching amount
  const initialDiscountId = (() => {
    if (currentDiscount <= 0) return '';
    const matched = activeDiscounts.find(d => {
      const amt = d.type === 'PERCENTAGE' ? grossTotal * (d.value / 100) : d.value;
      return Math.abs(amt - currentDiscount) < 0.01; // floating point tolerance
    });
    return matched?.id || '';
  })();

  const [mode, setMode]                     = useState<DiscountMode>(initialMode);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>(initialDiscountId);
  const [specialType, setSpecialType]       = useState<SpecialType>('percent');
  const [specialValue, setSpecialValue]     = useState<string>('');
  const [pin, setPin]                       = useState('');
  const [pinError, setPinError]             = useState('');
  const [pinVerified, setPinVerified]       = useState(false);
  const [isSaving, setIsSaving]             = useState(false);

  // ── Compute new discount amount ──────────────────────────────────────────
  const newDiscountAmount = useMemo(() => {
    if (mode === 'none') return 0;
    if (mode === 'special') {
      const n = parseFloat(specialValue);
      if (isNaN(n) || n < 0) return 0;
      if (specialType === 'percent') return Math.min(grossTotal, grossTotal * (n / 100));
      return Math.min(grossTotal, n);
    }
    if (mode === 'existing') {
      if (selectedDiscountId) {
        const d = activeDiscounts.find(d => d.id === selectedDiscountId);
        if (d) return d.type === 'PERCENTAGE' ? grossTotal * (d.value / 100) : d.value;
      }
      // Fallback to current applied discount while nothing re-selected
      return currentDiscount;
    }
    return 0;
  }, [mode, selectedDiscountId, specialType, specialValue, grossTotal, activeDiscounts, currentDiscount]);

  // ── Recalculate totals ───────────────────────────────────────────────────
  const vatRate      = (settings.vatRate || 12) / 100;
  const newNetTotal  = Math.max(0, grossTotal - newDiscountAmount - downpayment);
  const newVat       = (newNetTotal / (1 + vatRate)) * vatRate;
  const newSubtotal  = newNetTotal - newVat;
  const savings      = currentDiscount > 0 ? newDiscountAmount - currentDiscount : newDiscountAmount;

  // ── PIN verification ─────────────────────────────────────────────────────
  const handleVerifyPin = () => {
    if (pin === adminPin) { setPinVerified(true); setPinError(''); }
    else { setPinError('Incorrect PIN. Please try again.'); setPin(''); }
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (mode === 'special' && !pinVerified) {
      setPinError('Admin PIN is required to apply a special discount.');
      return;
    }
    if (mode === 'existing' && !selectedDiscountId && currentDiscount === 0) return;
    setIsSaving(true);
    const updatedTx: Transaction = {
      ...transaction,
      discount: newDiscountAmount,
      total:    newNetTotal,
      subtotal: newSubtotal,
      vat:      newVat,
    };
    const discountId = mode === 'existing' && selectedDiscountId ? selectedDiscountId : undefined;
    const specialAmt = mode === 'special' ? newDiscountAmount : undefined;
    onSave(updatedTx, discountId, specialAmt);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmt = (n: number) => `₱${n.toFixed(2)}`;
  const canSave =
    mode === 'none' ||
    (mode === 'existing' && (!!selectedDiscountId || currentDiscount > 0)) ||
    (mode === 'special' && parseFloat(specialValue) > 0 && pinVerified);

  const modeLabel = mode === 'none'
    ? 'Remove Discount'
    : mode === 'existing' && !selectedDiscountId && currentDiscount > 0
      ? 'Keep Current Discount'
      : 'Apply Discount';

  return (
    <Dialog open onClose={onClose} className="relative z-[80]">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* ── Header ── */}
          <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-600">
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #a78bfa 0%, transparent 60%)' }} />
            <div className="relative flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-widest mb-1">
                  <Tag className="w-3.5 h-3.5" /> Edit Discount
                </div>
                <p className="text-white text-2xl font-bold">{fmt(transaction.total)}</p>
                <p className="text-purple-200 text-xs mt-0.5">
                  Gross {fmt(grossTotal)}
                  {currentDiscount > 0 && <span className="text-green-300 ml-2">· Discount -{fmt(currentDiscount)}</span>}
                </p>
              </div>
              <button onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">

            {/* ── Mode selector ── */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'none'     as DiscountMode, label: 'No Discount',  icon: <X className="w-4 h-4" /> },
                { v: 'existing' as DiscountMode, label: 'From List',    icon: <Percent className="w-4 h-4" /> },
                { v: 'special'  as DiscountMode, label: 'Special',      icon: <DollarSign className="w-4 h-4" /> },
              ]).map(opt => (
                <button key={opt.v}
                  onClick={() => { setMode(opt.v); setPinVerified(false); setPin(''); setPinError(''); setSelectedDiscountId(''); }}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 text-xs font-bold transition-all ${
                    mode === opt.v
                      ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm shadow-purple-100'
                      : 'border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600'
                  }`}
                >
                  <span className={`p-1.5 rounded-lg ${mode === opt.v ? 'bg-purple-100' : 'bg-zinc-100'}`}>
                    {opt.icon}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* ── From List ── */}
            {mode === 'existing' && (
              activeDiscounts.length === 0 ? (
                <div className="text-center py-6 text-zinc-400 text-sm">
                  <Percent className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No active discounts. Create one on the Discounts page.
                </div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {activeDiscounts.map(d => {
                    const amt = d.type === 'PERCENTAGE' ? grossTotal * (d.value / 100) : d.value;
                    const isSelected = selectedDiscountId === d.id;
                    return (
                      <button key={d.id} onClick={() => setSelectedDiscountId(prev => prev === d.id ? '' : d.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${
                          isSelected
                            ? 'border-purple-400 bg-purple-50'
                            : 'border-zinc-200 hover:border-purple-200 hover:bg-purple-50/40'
                        }`}
                      >
                        <div className="text-left">
                          <p className={`font-bold text-sm ${isSelected ? 'text-purple-800' : 'text-zinc-700'}`}>{d.name}</p>
                          <p className="text-xs text-zinc-400">
                            {d.type === 'PERCENTAGE' ? `${d.value}% off` : `₱${d.value} flat`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold text-sm ${isSelected ? 'text-purple-600' : 'text-zinc-500'}`}>
                            -{fmt(amt)}
                          </span>
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-purple-500 border-purple-500' : 'border-zinc-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {/* ── Special Discount ── */}
            {mode === 'special' && (
              <div className="space-y-3">
                {/* % or ₱ toggle */}
                <div className="flex items-center gap-2">
                  <div className="flex bg-zinc-100 rounded-xl p-1 flex-1">
                    <button
                      onClick={() => setSpecialType('percent')}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                        specialType === 'percent'
                          ? 'bg-white text-purple-700 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-600'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" /> Percentage
                    </button>
                    <button
                      onClick={() => setSpecialType('amount')}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                        specialType === 'amount'
                          ? 'bg-white text-purple-700 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-600'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Fixed ₱
                    </button>
                  </div>
                </div>

                {/* Value input */}
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">
                    {specialType === 'percent' ? '%' : '₱'}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={specialType === 'percent' ? 100 : grossTotal}
                    value={specialValue}
                    onChange={e => setSpecialValue(e.target.value)}
                    placeholder={specialType === 'percent' ? '0' : '0.00'}
                   className="w-full border-2 border-zinc-200 rounded-xl pl-9 pr-28 py-3 text-lg font-bold focus:border-purple-400 focus:outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {specialValue && parseFloat(specialValue) > 0 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-600 font-bold text-sm">
                      {specialType === 'percent'
                        ? `-${fmt(grossTotal * (parseFloat(specialValue) / 100))}`
                        : `-${fmt(parseFloat(specialValue))}`}
                    </div>
                  )}
                </div>

                {/* Admin PIN */}
                {!pinVerified ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 text-xs font-bold">
                      <Lock className="w-4 h-4" /> Admin PIN Required
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleVerifyPin()}
                        placeholder="Enter PIN"
                        className="flex-1 border border-amber-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white"
                      />
                      <button onClick={handleVerifyPin}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-bold transition">
                        Verify
                      </button>
                    </div>
                    {pinError && <p className="text-red-500 text-xs">{pinError}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-700 text-xs font-bold bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                    <ShieldCheck className="w-4 h-4" /> PIN verified — special discount unlocked
                  </div>
                )}
              </div>
            )}

            {/* ── New Total Preview ── */}
            <div className={`rounded-2xl p-4 space-y-2 ${newDiscountAmount > 0 ? 'bg-purple-50 border-2 border-purple-200' : 'bg-zinc-50 border-2 border-zinc-200'}`}>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">New Total Preview</p>
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Subtotal (excl. VAT)</span>
                <span className="font-mono">{fmt(newSubtotal)}</span>
              </div>
              {newDiscountAmount > 0 && (
                <div className="flex justify-between text-sm font-semibold text-purple-600">
                  <span>Discount</span>
                  <span className="font-mono">-{fmt(newDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-zinc-500">
                <span>VAT ({settings.vatRate}%)</span>
                <span className="font-mono">{fmt(newVat)}</span>
              </div>
              <div className="flex justify-between font-black text-zinc-900 border-t-2 border-zinc-200 pt-2 mt-1 text-lg">
                <span>NEW TOTAL</span>
                <span className={`font-mono ${newDiscountAmount > 0 ? 'text-purple-700' : 'text-zinc-800'}`}>
                  {fmt(newNetTotal)}
                </span>
              </div>
              {savings !== 0 && (
                <p className={`text-xs font-semibold text-center rounded-xl py-1 ${savings > 0 ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
                  {savings > 0 ? `Client saves ${fmt(savings)} more` : `Client saves ${fmt(-savings)} less than before`}
                </p>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={onClose}
              className="px-5 py-3 rounded-2xl border-2 border-zinc-200 text-zinc-600 font-bold text-sm hover:bg-zinc-50 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !canSave}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
            >
              {mode === 'none'
                ? <><Trash2 className="w-4 h-4" /> Remove Discount</>
                : <><Check className="w-4 h-4" /> {modeLabel}</>
              }
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default EditDiscountModal;
