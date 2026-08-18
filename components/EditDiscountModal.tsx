/**
 * EditDiscountModal.tsx
 *
 * Modal for adding, changing, or removing a discount on any completed
 * transaction. Used by both Grooming (COMPLETED tab) and Transactions page.
 *
 * On save, returns the recalculated Transaction to the caller.
 * Caller is responsible for calling updateTransaction (and updateAppointment if needed).
 */

import React, { useState, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { Tag, X, Percent, DollarSign, Trash2, Check, Lock } from 'lucide-react';
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

const EditDiscountModal: React.FC<EditDiscountModalProps> = ({
  transaction,
  settings,
  discounts,
  adminPin,
  onSave,
  onClose,
}) => {
  // ── Compute gross total from items (before any discount/downpayment) ────
  const grossTotal = useMemo(
    () => transaction.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [transaction.items]
  );
  const downpayment = transaction.downpayment || 0;

  // ── Detect initial mode ──────────────────────────────────────────────────
  const initialMode: DiscountMode =
    transaction.discount > 0 ? 'existing' : 'none';

  const [mode, setMode] = useState<DiscountMode>(initialMode);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>('');
  const [specialAmount, setSpecialAmount] = useState<string>(
    transaction.discount > 0 ? transaction.discount.toString() : ''
  );
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeDiscounts = discounts.filter(d => d.active);

  // ── Compute new discount amount ──────────────────────────────────────────
  const newDiscountAmount = useMemo(() => {
    if (mode === 'none') return 0;
    if (mode === 'special') {
      const n = parseFloat(specialAmount);
      return isNaN(n) || n < 0 ? 0 : n;
    }
    if (mode === 'existing') {
      if (selectedDiscountId) {
        const d = activeDiscounts.find(d => d.id === selectedDiscountId);
        if (d) return d.type === 'PERCENTAGE' ? grossTotal * (d.value / 100) : d.value;
      }
      // Fallback: no selection yet — show current applied discount so preview is accurate
      return Number(transaction.discount ?? 0);
    }
    return 0;
  }, [mode, selectedDiscountId, specialAmount, grossTotal, activeDiscounts, transaction.discount]);

  // ── Recalculate totals ───────────────────────────────────────────────────
  const newNetTotal  = Math.max(0, grossTotal - newDiscountAmount - downpayment);
  const vatRate      = (settings.vatRate || 12) / 100;
  const newVat       = (newNetTotal / (1 + vatRate)) * vatRate;
  const newSubtotal  = newNetTotal - newVat;

  // Selected discount object (for display)
  const selectedDiscount = activeDiscounts.find(d => d.id === selectedDiscountId);

  // ── PIN verification for special discount ───────────────────────────────
  const handleVerifyPin = () => {
    if (pin === adminPin) {
      setPinVerified(true);
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (mode === 'special' && !pinVerified) {
      setPinError('Admin PIN is required to apply a special discount.');
      return;
    }
    if (mode === 'existing' && !selectedDiscountId) {
      return; // no discount selected yet
    }

    setIsSaving(true);

    const updatedTx: Transaction = {
      ...transaction,
      discount: newDiscountAmount,
      total: newNetTotal,
      subtotal: newSubtotal,
      vat: newVat,
    };

    const discountId = mode === 'existing' ? selectedDiscountId : undefined;
    const specialAmt = mode === 'special' ? newDiscountAmount : undefined;

    onSave(updatedTx, discountId, specialAmt);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmt = (n: number) => `₱${n.toFixed(2)}`;
  const discountLabel = (d: Discount) =>
    d.type === 'PERCENTAGE' ? `${d.name} (${d.value}%)` : `${d.name} (₱${d.value})`;

  return (
    <Dialog open onClose={onClose} className="relative z-[80]">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-amber-500 to-yellow-400">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Tag className="w-5 h-5" />
              Edit Discount
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">

            {/* Current transaction summary */}
            <div className="bg-zinc-50 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between text-zinc-500">
                <span>Gross Total</span>
                <span className="font-mono">{fmt(grossTotal)}</span>
              </div>
              {downpayment > 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>Downpayment</span>
                  <span className="font-mono text-green-600">-{fmt(downpayment)}</span>
                </div>
              )}
              {transaction.discount > 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>Current Discount</span>
                  <span className="font-mono text-red-500">-{fmt(transaction.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-zinc-800 border-t border-zinc-200 pt-1 mt-1">
                <span>Current Total</span>
                <span className="font-mono">{fmt(transaction.total)}</span>
              </div>
            </div>

            {/* Mode selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Discount Type</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'none' as DiscountMode, label: 'No Discount', icon: <X className="w-4 h-4" /> },
                  { v: 'existing' as DiscountMode, label: 'From List', icon: <Percent className="w-4 h-4" /> },
                  { v: 'special' as DiscountMode, label: 'Special ₱', icon: <DollarSign className="w-4 h-4" /> },
                ].map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => { setMode(opt.v); setPinVerified(false); setPin(''); setPinError(''); }}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 text-xs font-semibold transition-all ${
                      mode === opt.v
                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Existing discount selector */}
            {mode === 'existing' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-500">Select Discount</p>
                {activeDiscounts.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic">No active discounts. Create one on the Discounts page.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeDiscounts.map(d => {
                      const amt = d.type === 'PERCENTAGE' ? grossTotal * (d.value / 100) : d.value;
                      return (
                        <button
                          key={d.id}
                          onClick={() => setSelectedDiscountId(d.id)}
                          className={`w-full flex justify-between items-center px-3 py-2 rounded-xl border-2 text-sm transition-all ${
                            selectedDiscountId === d.id
                              ? 'border-amber-400 bg-amber-50'
                              : 'border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          <div className="text-left">
                            <p className="font-semibold text-zinc-800">{d.name}</p>
                            <p className="text-xs text-zinc-400">
                              {d.type === 'PERCENTAGE' ? `${d.value}%` : `₱${d.value} flat`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-red-500">-{fmt(amt)}</p>
                            {selectedDiscountId === d.id && (
                              <Check className="w-4 h-4 text-amber-500 ml-auto" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Special amount input */}
            {mode === 'special' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-500">Discount Amount (₱)</p>
                  <input
                    type="number"
                    min="0"
                    max={grossTotal}
                    value={specialAmount}
                    onChange={e => setSpecialAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full border-2 border-zinc-200 rounded-xl px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>

                {/* Admin PIN */}
                {!pinVerified ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
                      <Lock className="w-4 h-4" />
                      Admin PIN Required for Special Discount
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
                        className="flex-1 border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={handleVerifyPin}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-semibold"
                      >
                        Verify
                      </button>
                    </div>
                    {pinError && <p className="text-red-500 text-xs">{pinError}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-600 text-xs font-semibold bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <Check className="w-4 h-4" />
                    PIN verified ✅
                  </div>
                )}
              </div>
            )}

            {/* New total preview */}
            <div className={`rounded-xl p-3 text-sm space-y-1 border-2 ${newDiscountAmount > 0 ? 'bg-green-50 border-green-200' : 'bg-zinc-50 border-zinc-200'}`}>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">New Total Preview</p>
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal (excl. VAT)</span>
                <span className="font-mono">{fmt(newSubtotal)}</span>
              </div>
              {newDiscountAmount > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Discount</span>
                  <span className="font-mono">-{fmt(newDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-600">
                <span>VAT ({settings.vatRate}%)</span>
                <span className="font-mono">{fmt(newVat)}</span>
              </div>
              <div className="flex justify-between font-bold text-zinc-900 border-t border-zinc-300 pt-1 mt-1 text-base">
                <span>NEW TOTAL</span>
                <span className="font-mono text-purple-700">{fmt(newNetTotal)}</span>
              </div>
              {newDiscountAmount > 0 && transaction.total !== newNetTotal && (
                <p className="text-xs text-green-600 text-center mt-1">
                  Savings: {fmt(Math.abs(transaction.total - newNetTotal))}
                </p>
              )}
            </div>
          </div>

          {/* Footer buttons */}
          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border-2 border-zinc-200 text-zinc-600 font-semibold text-sm hover:bg-zinc-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={
                isSaving ||
                (mode === 'existing' && !selectedDiscountId) ||
                (mode === 'special' && !pinVerified)
              }
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition flex items-center justify-center gap-2"
            >
              {mode === 'none' ? (
                <><Trash2 className="w-4 h-4" /> Remove Discount</>
              ) : (
                <><Check className="w-4 h-4" /> Apply Discount</>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default EditDiscountModal;
