/**
 * BluetoothPrintButton.tsx
 *
 * Reusable Bluetooth print button for use alongside "Print Now" in receipt modals.
 * - Shows connection status (disconnected / connected to "Device Name")
 * - On first tap: opens BLE device picker (Chrome Android only)
 * - On subsequent taps: prints directly (no picker shown again)
 * - Not shown when Web Bluetooth is unsupported (iOS, desktop without BT)
 */

import React from 'react';
import { Bluetooth, BluetoothConnected, BluetoothOff, Loader2, X } from 'lucide-react';
import { useBluetooth } from '../hooks/useBluetooth';
import { buildReceiptBytes } from '../utils/escpos';
import { Transaction, StoreSettings } from '../types';

interface BluetoothPrintButtonProps {
  transaction: Transaction;
  settings: StoreSettings;
  paperSize: '48mm' | '58mm' | '80mm';
}

const BluetoothPrintButton: React.FC<BluetoothPrintButtonProps> = ({
  transaction,
  settings,
  paperSize,
}) => {
  const { state, connect, disconnect, print } = useBluetooth();

  // Don't render anything on unsupported browsers (iOS, Firefox, desktop Chrome w/o BT)
  if (!state.isSupported) return null;

  const handlePress = async () => {
    if (state.isPrinting) return;

    // Connect first if not connected
    if (!state.isConnected) {
      const ok = await connect();
      if (!ok) return;
    }

    // Build ESC/POS bytes and print
    const bytes = buildReceiptBytes(transaction, settings, paperSize);
    await print(bytes);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (state.isConnecting) {
    return (
      <button
        disabled
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 text-sm font-medium cursor-not-allowed"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting...
      </button>
    );
  }

  if (state.isPrinting) {
    return (
      <button
        disabled
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 text-green-300 text-sm font-medium cursor-not-allowed"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Printing...
      </button>
    );
  }

  if (state.isConnected) {
    return (
      <div className="flex-1 flex flex-col gap-1">
        {/* Connected — print directly */}
        <button
          onClick={handlePress}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 active:scale-95 text-white text-sm font-bold transition-all shadow-lg shadow-green-900/40"
        >
          <BluetoothConnected className="w-4 h-4" />
          BT Print — {state.deviceName}
        </button>
        {state.error && (
          <p className="text-red-400 text-xs text-center">{state.error}</p>
        )}
        {/* Disconnect link */}
        <button
          onClick={disconnect}
          className="flex items-center justify-center gap-1 text-xs text-zinc-400 hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" /> Disconnect
        </button>
      </div>
    );
  }

  // Default: not connected
  return (
    <div className="flex-1 flex flex-col gap-1">
      <button
        onClick={handlePress}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 active:scale-95 text-white text-sm font-bold transition-all shadow-lg shadow-blue-900/40"
      >
        <Bluetooth className="w-4 h-4" />
        BT Print (Connect)
      </button>
      {state.error && (
        <p className="text-red-400 text-xs text-center px-2">{state.error}</p>
      )}
    </div>
  );
};

export default BluetoothPrintButton;
