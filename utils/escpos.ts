/**
 * escpos.ts — ESC/POS Command Builder for 58mm Thermal Printers
 *
 * Converts GigglyPaws Transaction + StoreSettings into raw ESC/POS bytes
 * for direct Bluetooth printing (no third-party app needed).
 *
 * ESC/POS reference: https://reference.epson-biz.com/modules/ref_escpos/
 */

import { Transaction, StoreSettings } from '../types';

// ── ESC/POS Command Constants ─────────────────────────────────────────────
const ESC  = 0x1B;
const GS   = 0x1D;
const LF   = 0x0A; // Line Feed (newline)

// Printer commands
const CMD = {
  INIT:           [ESC, 0x40],           // Initialize printer
  ALIGN_LEFT:     [ESC, 0x61, 0x00],     // Left align
  ALIGN_CENTER:   [ESC, 0x61, 0x01],     // Center align
  ALIGN_RIGHT:    [ESC, 0x61, 0x02],     // Right align
  BOLD_ON:        [ESC, 0x45, 0x01],     // Bold on
  BOLD_OFF:       [ESC, 0x45, 0x00],     // Bold off
  UNDERLINE_ON:   [ESC, 0x2D, 0x01],     // Underline on
  UNDERLINE_OFF:  [ESC, 0x2D, 0x00],     // Underline off
  DOUBLE_SIZE_ON: [GS,  0x21, 0x11],     // Double width + height
  NORMAL_SIZE:    [GS,  0x21, 0x00],     // Normal size
  FONT_SMALL:     [ESC, 0x4D, 0x01],     // Small font
  FONT_NORMAL:    [ESC, 0x4D, 0x00],     // Normal font
  FEED_LINE:      [LF],                  // Feed one line
  CUT:            [GS,  0x56, 0x00],     // Full cut
  PARTIAL_CUT:    [GS,  0x56, 0x01],     // Partial cut (preferred)
};

// ── Width: 58mm ≈ 32 chars at default font ────────────────────────────────
const COLS = 32;
const DASHED = '-'.repeat(COLS);

// ── Helpers ───────────────────────────────────────────────────────────────

/** Encode a string to Latin1 bytes (CP437 compatible) */
function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Replace common UTF-8 characters with ASCII equivalents
    if (code === 0x20B1) { bytes.push(0x50); continue; } // ₱ → P
    if (code > 0x7F)     { bytes.push(0x3F); continue; } // ? for non-ASCII
    bytes.push(code);
  }
  return bytes;
}

/** Line followed by LF */
function line(text: string): number[] {
  return [...encodeText(text), LF];
}

/** Empty line */
function emptyLine(): number[] { return [LF]; }

/** Pad string to exact width (truncates if too long) */
function padRight(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text.padEnd(width);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text.padStart(width);
}

/** Two-column row: left text + right text aligned to COLS */
function twoCol(left: string, right: string, total = COLS): number[] {
  const maxLeft = total - right.length - 1;
  const leftStr = left.length > maxLeft ? left.slice(0, maxLeft - 1) + '.' : padRight(left, maxLeft);
  return line(`${leftStr} ${right}`);
}

/** Combine multiple byte arrays */
function concat(...arrays: number[][]): number[] {
  return arrays.flat();
}

// ── Main Receipt Builder ──────────────────────────────────────────────────

export function buildReceiptBytes(
  transaction: Transaction,
  settings: StoreSettings,
  paperSize: '48mm' | '58mm' | '80mm' = '58mm'
): Uint8Array {

  const cols = paperSize === '80mm' ? 48 : paperSize === '58mm' ? 32 : 24;
  const dashes = '-'.repeat(cols);

  const bytes: number[] = [];

  const push = (...cmds: number[][]) => bytes.push(...concat(...cmds));

  // ── Initialize ────────────────────────────────────────────────────────
  push(CMD.INIT);

  // ── Header ────────────────────────────────────────────────────────────
  push(CMD.ALIGN_CENTER);
  push(CMD.BOLD_ON);
  // Only use double-size on 80mm; smaller paper can't fit it cleanly
  if (paperSize === '80mm') {
    push(CMD.DOUBLE_SIZE_ON);
    push(line(settings.name || 'GIGGLYPAWS PET SALON'));
    push(CMD.NORMAL_SIZE);
  } else {
    // Truncate store name to fit paper width
    const storeName = (settings.name || 'GIGGLYPAWS PET SALON').slice(0, cols);
    push(line(storeName));
  }
  push(CMD.BOLD_OFF);

  if (settings.address) push(line(settings.address.slice(0, cols)));
  if (settings.contactNumber) push(line(settings.contactNumber.slice(0, cols)));
  push(emptyLine());

  // ── Thank you message ─────────────────────────────────────────────────
  if (settings.receiptHeader) {
    push(line(settings.receiptHeader));
  }

  // ── Dashed separator ─────────────────────────────────────────────────
  push(CMD.ALIGN_LEFT);
  push(line(dashes));

  // ── Items ─────────────────────────────────────────────────────────────
  for (const item of transaction.items) {
    const itemTotal = item.price * item.quantity;

    // Parse pet name from "(petName)" format → show on sub-line
    const petMatch = item.name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const displayName = petMatch ? petMatch[1].trim() : item.name;
    const petLabel   = petMatch ? petMatch[2].trim() : null;

    const priceStr = itemTotal.toFixed(2);
    push(twoCol(`${item.quantity} x ${displayName}`, priceStr, cols));

    if (petLabel) {
      push(line(`   >> ${petLabel}`));
    }

    // Per-item discounts (only if no transaction-level discount)
    const hasTransactionDiscount = transaction.discount && transaction.discount > 0;
    if (!hasTransactionDiscount && item.appliedDiscounts?.length) {
      for (const d of item.appliedDiscounts) {
        const discAmt = d.type === 'PERCENTAGE'
          ? itemTotal * (d.value / 100)
          : d.value * item.quantity;
        const discLabel = `  - ${d.name} (${d.type === 'PERCENTAGE' ? d.value + '%' : 'P' + d.value})`;
        push(CMD.FONT_SMALL);
        push(twoCol(discLabel, `-${discAmt.toFixed(2)}`, cols));
        push(CMD.FONT_NORMAL);
      }
    }
  }

  push(line(dashes));

  // ── Totals ────────────────────────────────────────────────────────────
  push(CMD.ALIGN_LEFT);
  push(twoCol('Subtotal', transaction.subtotal.toFixed(2), cols));

  if (transaction.discount && transaction.discount > 0) {
    push(twoCol('Discount', `-${transaction.discount.toFixed(2)}`, cols));
  }

  push(twoCol(`VAT (${settings.vatRate}%)`, transaction.vat.toFixed(2), cols));

  if (transaction.downpayment && transaction.downpayment > 0) {
    const fullTotal = transaction.total + transaction.downpayment;
    push(line(dashes.slice(0, cols / 2)));
    push(twoCol('Full Total', `P${fullTotal.toFixed(2)}`, cols));
    push(twoCol('Downpayment Paid', `-P${transaction.downpayment.toFixed(2)}`, cols));
    push(line(dashes));
    push(CMD.BOLD_ON);
    push(twoCol('BALANCE TO PAY', `P${transaction.total.toFixed(2)}`, cols));
    push(CMD.BOLD_OFF);
  } else {
    push(line(dashes));
    push(CMD.BOLD_ON);
    push(twoCol('TOTAL', `P${transaction.total.toFixed(2)}`, cols));
    push(CMD.BOLD_OFF);
  }

  push(line(dashes));

  // ── Payment ───────────────────────────────────────────────────────────
  const isSplit = transaction.paymentMethod === 'SPLIT';
  const isGcash = transaction.paymentMethod === 'GCASH';
  const isCash  = transaction.paymentMethod === 'CASH';

  if (isSplit) {
    const cash  = transaction.cashReceived ?? 0;
    const gcash = Math.max(0, transaction.total - cash);
    push(twoCol('Cash', `P${cash.toFixed(2)}`, cols));
    push(twoCol('GCash', `P${gcash.toFixed(2)}`, cols));
    if (transaction.gcashRef) push(line(`  GCash Ref: ${transaction.gcashRef}`));
  } else if (isGcash) {
    push(twoCol('Paid via GCash', `P${transaction.total.toFixed(2)}`, cols));
    if (transaction.gcashRef) push(line(`  Ref: ${transaction.gcashRef}`));
  } else {
    push(twoCol('Paid via Cash', `P${transaction.total.toFixed(2)}`, cols));
    if (isCash && transaction.cashReceived && transaction.cashReceived > 0) {
      push(twoCol('Cash Received', `P${transaction.cashReceived.toFixed(2)}`, cols));
      const change = Math.max(0, transaction.cashReceived - transaction.total);
      if (change > 0) push(twoCol('Change', `P${change.toFixed(2)}`, cols));
    }
  }

  // ── Reference & Date ─────────────────────────────────────────────────
  push(emptyLine());
  push(CMD.ALIGN_CENTER);
  // Use last 8 chars of ID to keep it short (fits 48mm)
  push(line(`Ref: ${transaction.id.slice(-8)}`));

  // Use short month on small paper to keep the date line within 24 cols
  const formattedDate = new Date(transaction.date).toLocaleString('en-US', {
    month: paperSize === '48mm' ? 'short' : 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });
  push(line(formattedDate));

  // ── Footer ────────────────────────────────────────────────────────────
  push(line(dashes));
  push(CMD.ALIGN_CENTER);
  if (settings.receiptFooter) {
    push(line(settings.receiptFooter));
  } else {
    push(line('No return, no exchange after 7 days.'));
  }

  // ── Feed + Cut ────────────────────────────────────────────────────────
  push([ESC, 0x64, 0x04]); // Feed 4 lines
  push(CMD.PARTIAL_CUT);

  return new Uint8Array(bytes);
}
