/**
 * BluetoothPrintButton.tsx
 *
 * Reusable Bluetooth print button for use alongside "Print Now" in receipt modals.
 * - Shows connection status (disconnected / connected to "Device Name")
 * - On first tap: opens BLE device picker (Chrome Android only)
 * - On subsequent taps: prints directly (no picker shown again)
 * - Renders store logo to 1-bit bitmap and sends via ESC/POS GS v 0
 * - Not shown when Web Bluetooth is unsupported (iOS, desktop without BT)
 */

import React from 'react';
import { Bluetooth, BluetoothConnected, Loader2, X } from 'lucide-react';
import { useBluetooth } from '../hooks/useBluetooth';
import { buildReceiptBytes, LogoBitmap } from '../utils/escpos';
import { Transaction, StoreSettings } from '../types';

interface BluetoothPrintButtonProps {
  transaction: Transaction;
  settings: StoreSettings;
  paperSize: '48mm' | '58mm' | '80mm';
}

// ── Logo → 1-bit bitmap ──────────────────────────────────────────────────────

/**
 * Loads a logo URL, draws it on a canvas, and converts to a 1-bit packed
 * bitmap suitable for ESC/POS GS v 0 raster image command.
 *
 * Paper dot widths (8 dots/mm):
 *   48mm → 384 dots  |  58mm → 464 dots  |  80mm → 640 dots
 */
async function loadLogoBitmap(
  logoUrl: string,
  paperSize: '48mm' | '58mm' | '80mm'
): Promise<LogoBitmap | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // Max logo width (dots) — keep to ~50% of printable area so it's nicely centered
      const maxWidth = paperSize === '80mm' ? 300 : paperSize === '58mm' ? 220 : 180;

      // Maintain aspect ratio
      const scale     = Math.min(maxWidth / img.naturalWidth, 1);
      const widthDots = Math.round(img.naturalWidth  * scale);
      const heightDots= Math.round(img.naturalHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width  = widthDots;
      canvas.height = heightDots;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }

      // White background (so transparent PNGs don't go black)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, widthDots, heightDots);
      ctx.drawImage(img, 0, 0, widthDots, heightDots);

      const imageData = ctx.getImageData(0, 0, widthDots, heightDots);
      const bytesPerRow = Math.ceil(widthDots / 8);
      const bitmap = new Uint8Array(bytesPerRow * heightDots);

      for (let y = 0; y < heightDots; y++) {
        for (let x = 0; x < widthDots; x++) {
          const idx  = (y * widthDots + x) * 4;
          const r    = imageData.data[idx];
          const g    = imageData.data[idx + 1];
          const b    = imageData.data[idx + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Dark pixel → print (1); ESC/POS bit is MSB first
          if (gray < 160) {
            const byteIdx = y * bytesPerRow + Math.floor(x / 8);
            bitmap[byteIdx] |= (0x80 >> (x % 8));
          }
        }
      }

      resolve({ data: bitmap, widthDots, heightDots });
    };

    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });
}

// ── Component ────────────────────────────────────────────────────────────────

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

    // Render logo to 1-bit bitmap (if store has a logo set)
    let logoBitmap: LogoBitmap | null = null;
    if (settings.logo) {
      logoBitmap = await loadLogoBitmap(settings.logo, paperSize);
    }

    // Build ESC/POS bytes and print
    const bytes = buildReceiptBytes(transaction, settings, paperSize, logoBitmap);
    await print(bytes);
  };

  // ── Render ───────────────────────────────────────────────────────────────

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
