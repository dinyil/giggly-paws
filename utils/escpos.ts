/**
 * escpos.ts — ESC/POS Command Builder for Thermal Printers
 *
 * Converts GigglyPaws Transaction + StoreSettings into raw ESC/POS bytes
 * for direct Bluetooth printing (no third-party app needed).
 *
 * ESC/POS reference: https://reference.epson-biz.com/modules/ref_escpos/
 *
 * Paper sizes → character columns (normal font):
 *   48mm → 24 cols  |  58mm → 32 cols  |  80mm → 48 cols
 */

import { Transaction, StoreSettings } from '../types';

// ── ESC/POS Command Constants ─────────────────────────────────────────────
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

const CMD = {
  INIT:           [ESC, 0x40],
  ALIGN_LEFT:     [ESC, 0x61, 0x00],
  ALIGN_CENTER:   [ESC, 0x61, 0x01],
  ALIGN_RIGHT:    [ESC, 0x61, 0x02],
  BOLD_ON:        [ESC, 0x45, 0x01],
  BOLD_OFF:       [ESC, 0x45, 0x00],
  DOUBLE_SIZE_ON: [GS,  0x21, 0x11],
  NORMAL_SIZE:    [GS,  0x21, 0x00],
  FONT_SMALL:     [ESC, 0x4D, 0x01],
  FONT_NORMAL:    [ESC, 0x4D, 0x00],
  FEED_LINE:      [LF],
  PARTIAL_CUT:    [GS,  0x56, 0x01],
};

// ── Helpers ───────────────────────────────────────────────────────────────

/** Encode string to printable Latin-1 bytes */
function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x20B1) { bytes.push(0x50); continue; } // ₱ → P
    if (code > 0x7F)     { bytes.push(0x3F); continue; } // ? for non-ASCII
    bytes.push(code);
  }
  return bytes;
}

/** Text line ending in LF */
function line(text: string): number[] {
  return [...encodeText(text), LF];
}

/** Empty line */
function emptyLine(): number[] { return [LF]; }

/** Pad string to exact width */
function padRight(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text.padEnd(width);
}

/**
 * Word-wrap text into lines that fit within `cols` characters.
 * Words that are longer than cols are hard-broken.
 */
function wordWrap(text: string, cols: number): string[] {
  if (!text) return [];
  if (text.length <= cols) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!word) continue;
    // Hard-break words longer than cols
    if (word.length > cols) {
      if (current) { lines.push(current); current = ''; }
      for (let i = 0; i < word.length; i += cols) {
        lines.push(word.slice(i, i + cols));
      }
      continue;
    }
    if (current === '') {
      current = word;
    } else if (current.length + 1 + word.length <= cols) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Two-column row: left text + right price.
 * If the left text is too long, it wraps onto preceding lines and the
 * price appears on the final line — exactly like the HTML preview.
 */
function twoColRow(left: string, right: string, cols: number): number[] {
  const rightWidth = right.length;
  const leftWidth  = cols - rightWidth - 1; // -1 for separator space

  const leftWrapped = wordWrap(left, leftWidth);
  const result: number[] = [];

  if (leftWrapped.length === 0) {
    result.push(...line(`${padRight('', leftWidth)} ${right}`));
  } else {
    for (let i = 0; i < leftWrapped.length; i++) {
      const isLast = i === leftWrapped.length - 1;
      if (isLast) {
        result.push(...line(`${padRight(leftWrapped[i], leftWidth)} ${right}`));
      } else {
        result.push(...line(leftWrapped[i]));
      }
    }
  }
  return result;
}

/** Print centered text, wrapped to cols */
function centeredLines(text: string, cols: number): number[][] {
  return wordWrap(text, cols).map(l => line(l.padStart(Math.floor((cols + l.length) / 2)).padEnd(cols)));
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

  // Character columns per paper size (normal font, standard thermal density)
  const cols = paperSize === '80mm' ? 48 : paperSize === '58mm' ? 32 : 24;
  const dashes = '-'.repeat(cols);

  const bytes: number[] = [];
  const push = (...cmds: number[][]) => bytes.push(...concat(...cmds));

  // ── Initialize ────────────────────────────────────────────────────────
  push(CMD.INIT);

  // ── Header ─────────────────────────────────────────────────────────────
  push(CMD.ALIGN_CENTER);
  push(CMD.BOLD_ON);
  if (paperSize === '80mm') {
    // Double-size only on wide paper — fits comfortably
    push(CMD.DOUBLE_SIZE_ON);
    push(line((settings.name || 'GIGGLYPAWS PET SALON').toUpperCase()));
    push(CMD.NORMAL_SIZE);
  } else {
    // Smaller paper: bold only, word-wrap store name so it never garbles
    const nameLines = wordWrap((settings.name || 'GIGGLYPAWS PET SALON').toUpperCase(), cols);
    for (const l of nameLines) push(line(l));
  }
  push(CMD.BOLD_OFF);

  // Address — word-wrap to fit paper
  if (settings.address) {
    for (const l of wordWrap(settings.address, cols)) push(line(l));
  }
  if (settings.contactNumber) {
    push(line(settings.contactNumber.slice(0, cols)));
  }
  push(emptyLine());

  // ── Receipt header message ───────────────────────────────────────────
  if (settings.receiptHeader) {
    for (const l of wordWrap(settings.receiptHeader, cols)) push(line(l));
    push(emptyLine());
  }

  // ── Separator ─────────────────────────────────────────────────────────
  push(CMD.ALIGN_LEFT);
  push(line(dashes));

  // ── Items ─────────────────────────────────────────────────────────────
  for (const item of transaction.items) {
    const itemTotal = item.price * item.quantity;

    // Parse "Service Name (Pet Name)" format → pet label on sub-line
    const petMatch   = item.name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const displayName = petMatch ? petMatch[1].trim() : item.name;
    const petLabel    = petMatch ? petMatch[2].trim() : null;

    const priceStr = itemTotal.toFixed(2);
    const prefix   = `${item.quantity} x `;

    // Print "N x Item Name" with price right-aligned; wrap if needed
    push(...twoColRow(prefix + displayName, priceStr, cols));

    // Pet sub-label on its own indented line
    if (petLabel) {
      push(...(wordWrap(`  >> ${petLabel}`, cols).map(l => line(l))));
    }

    // Per-item discounts (only if no transaction-level discount)
    const hasTransactionDiscount = transaction.discount && transaction.discount > 0;
    if (!hasTransactionDiscount && item.appliedDiscounts?.length) {
      for (const d of item.appliedDiscounts) {
        const discAmt   = d.type === 'PERCENTAGE'
          ? itemTotal * (d.value / 100)
          : d.value * item.quantity;
        const discLabel = `  - ${d.name} (${d.type === 'PERCENTAGE' ? d.value + '%' : 'P' + d.value})`;
        push(CMD.FONT_SMALL);
        push(...twoColRow(discLabel, `-${discAmt.toFixed(2)}`, cols));
        push(CMD.FONT_NORMAL);
      }
    }
  }

  push(line(dashes));

  // ── Totals ────────────────────────────────────────────────────────────
  push(CMD.ALIGN_LEFT);
  push(...twoColRow('Subtotal', transaction.subtotal.toFixed(2), cols));

  if (transaction.discount && transaction.discount > 0) {
    push(...twoColRow('Discount', `-${transaction.discount.toFixed(2)}`, cols));
  }

  push(...twoColRow(`VAT (${settings.vatRate}%)`, transaction.vat.toFixed(2), cols));

  if (transaction.downpayment && transaction.downpayment > 0) {
    const fullTotal = transaction.total + transaction.downpayment;
    push(line(dashes));
    push(...twoColRow('Full Total',        `P${fullTotal.toFixed(2)}`,              cols));
    push(...twoColRow('Downpayment Paid',  `-P${transaction.downpayment.toFixed(2)}`, cols));
    push(line(dashes));
    push(CMD.BOLD_ON);
    push(...twoColRow('BALANCE TO PAY', `P${transaction.total.toFixed(2)}`, cols));
    push(CMD.BOLD_OFF);
  } else {
    push(line(dashes));
    push(CMD.BOLD_ON);
    push(...twoColRow('TOTAL', `P${transaction.total.toFixed(2)}`, cols));
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
    push(...twoColRow('Cash',  `P${cash.toFixed(2)}`,  cols));
    push(...twoColRow('GCash', `P${gcash.toFixed(2)}`, cols));
    if (transaction.gcashRef) push(...(wordWrap(`  GCash Ref: ${transaction.gcashRef}`, cols).map(l => line(l))));
  } else if (isGcash) {
    push(...twoColRow('Paid via GCash', `P${transaction.total.toFixed(2)}`, cols));
    if (transaction.gcashRef) push(...(wordWrap(`  Ref: ${transaction.gcashRef}`, cols).map(l => line(l))));
  } else {
    push(...twoColRow('Paid via Cash', `P${transaction.total.toFixed(2)}`, cols));
    if (isCash && transaction.cashReceived && transaction.cashReceived > 0) {
      push(...twoColRow('Cash Received', `P${transaction.cashReceived.toFixed(2)}`, cols));
      const change = Math.max(0, transaction.cashReceived - transaction.total);
      if (change > 0) push(...twoColRow('Change', `P${change.toFixed(2)}`, cols));
    }
  }

  // ── Reference & Date ──────────────────────────────────────────────────
  push(emptyLine());
  push(CMD.ALIGN_CENTER);
  push(line(`Ref: ${transaction.id.slice(-8)}`));

  const formattedDate = new Date(transaction.date).toLocaleString('en-US', {
    month: paperSize === '48mm' ? 'short' : 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });
  push(line(formattedDate.slice(0, cols)));

  // ── Footer ────────────────────────────────────────────────────────────
  push(line(dashes));
  push(CMD.ALIGN_CENTER);
  const footerText = settings.receiptFooter || 'No return, no exchange after 7 days.';
  for (const l of centeredLines(footerText, cols)) push(l);

  // ── Feed + Cut ────────────────────────────────────────────────────────
  push([ESC, 0x64, 0x05]); // Feed 5 lines before cut
  push(CMD.PARTIAL_CUT);

  return new Uint8Array(bytes);
}
