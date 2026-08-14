
import React from 'react';
import { Transaction, StoreSettings } from '../types';

interface ReceiptTemplateProps { 
  transaction: Transaction; 
  settings: StoreSettings; 
  paperSize: '48mm' | '58mm' | '80mm';
  isPreview?: boolean;
}

const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ transaction, settings, paperSize, isPreview }) => {
  // Width in pixels for the outer container (preview only)
  const widthPx = paperSize === '80mm' ? '302px' : paperSize === '58mm' ? '219px' : '181px';

  // For print, the @page rule sets exact mm width; we rely on 100% width.
  // For preview we constrain to the pixel equivalent above.
  const containerStyle: React.CSSProperties = isPreview
    ? { width: widthPx, fontFamily: 'monospace', fontSize: paperSize === '80mm' ? '11px' : '9px', lineHeight: '1.35', wordBreak: 'break-word', overflowWrap: 'break-word', color: '#000', backgroundColor: '#fff', padding: paperSize === '80mm' ? '8px' : '4px', margin: '0 auto' }
    : { width: '100%', fontFamily: 'monospace', fontSize: paperSize === '80mm' ? '11px' : '9px', lineHeight: '1.35', wordBreak: 'break-word', overflowWrap: 'break-word', color: '#000', backgroundColor: '#fff', padding: paperSize === '80mm' ? '6px' : '3px' };

  const headerFontSize = paperSize === '80mm' ? '13px' : '10px';
  const totalFontSize  = paperSize === '80mm' ? '13px' : '10px';

  const formattedDate = new Date(transaction.date).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });

  const isSplit   = transaction.paymentMethod === 'SPLIT';
  const isGcash   = transaction.paymentMethod === 'GCASH';
  const isCash    = transaction.paymentMethod === 'CASH';

  // For SPLIT: cashReceived holds the cash portion, rest is GCash
  const splitCash  = isSplit ? (transaction.cashReceived ?? 0) : 0;
  const splitGcash = isSplit ? Math.max(0, transaction.total - splitCash) : 0;

  // For CASH: cashReceived holds what the customer gave (may include change)
  const cashGiven  = isCash ? (transaction.cashReceived ?? 0) : 0;
  const cashChange = isCash ? Math.max(0, cashGiven - transaction.total) : 0;


  const row = (left: React.ReactNode, right: React.ReactNode, bold = false, extraStyle?: React.CSSProperties) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontWeight: bold ? 'bold' : 'normal', ...extraStyle }}>
      <span style={{ flex: 1, paddingRight: '4px', wordBreak: 'break-word' }}>{left}</span>
      <span style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{right}</span>
    </div>
  );

  const dashedBorder: React.CSSProperties = { borderTop: '1px dashed #000', marginTop: '6px', paddingTop: '6px' };
  const dashedBottom: React.CSSProperties = { borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        {settings.logo && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
            <img
              src={settings.logo}
              alt="Store Logo"
              style={{ maxHeight: paperSize === '80mm' ? '80px' : '55px', maxWidth: '85%', objectFit: 'contain' }}
            />
          </div>
        )}
        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: headerFontSize }}>{settings.name}</div>
        <div>{settings.address}</div>
        <div>{settings.contactNumber}</div>
      </div>

      {/* Receipt Header message */}
      {settings.receiptHeader && (
        <div style={{ textAlign: 'center', ...dashedBottom }}>{settings.receiptHeader}</div>
      )}

      {/* Items */}
      <div style={dashedBottom}>
        {transaction.items.map((item, idx) => {
          const itemTotal = item.price * item.quantity;
          return (
            <div key={idx} style={{ marginBottom: '2px' }}>
              {row(
                <>{item.quantity} x {item.name}</>,
                itemTotal.toFixed(2)
              )}
              {item.appliedDiscounts?.map(d => {
                const discountAmt = d.type === 'PERCENTAGE'
                  ? itemTotal * (d.value / 100)
                  : d.value * item.quantity;
                return (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontStyle: 'italic', color: '#555', paddingLeft: '8px' }}>
                    <span>- {d.name} ({d.type === 'PERCENTAGE' ? d.value + '%' : '₱' + d.value})</span>
                    <span style={{ whiteSpace: 'nowrap' }}>-{discountAmt.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div style={{ marginBottom: '6px' }}>
        {row('Subtotal', transaction.subtotal.toFixed(2))}
        {transaction.discount > 0 && row('Discount', `-${transaction.discount.toFixed(2)}`)}
        {row(`VAT (${settings.vatRate}%)`, transaction.vat.toFixed(2))}
        {transaction.downpayment && transaction.downpayment > 0 ? (
          <>
            {/* Full total before downpayment */}
            <div style={{ borderTop: '1px dashed #000', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Full Total</span>
              <span>₱{(transaction.total + transaction.downpayment).toFixed(2)}</span>
            </div>
            {/* Downpayment deduction */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontStyle: 'italic' }}>
              <span>Downpayment Paid</span>
              <span>-₱{transaction.downpayment.toFixed(2)}</span>
            </div>
            {/* Balance to pay */}
            <div style={{ borderTop: '1px solid #000', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: totalFontSize }}>
              <span>BALANCE TO PAY</span>
              <span>₱{transaction.total.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <div style={{ borderTop: '1px solid #000', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: totalFontSize }}>
            <span>TOTAL</span>
            <span>₱{transaction.total.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Payment */}
      <div style={dashedBorder}>
        {/* ── CASH ── */}
        {isCash && (
          <>
            {row('Paid via Cash', `₱${transaction.total.toFixed(2)}`)}
            {cashGiven > 0 && row('Cash Received', `₱${cashGiven.toFixed(2)}`)}
            {cashGiven > 0 && row('Change', `₱${cashChange.toFixed(2)}`, true)}
          </>
        )}

        {/* ── GCASH ── */}
        {isGcash && (
          <>
            {row('Paid via GCash', `₱${transaction.total.toFixed(2)}`)}
            {transaction.gcashRef && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
                <span>Ref:</span><span>{transaction.gcashRef}</span>
              </div>
            )}
          </>
        )}

        {/* ── SPLIT ── */}
        {isSplit && (
          <>
            <div style={{ fontWeight: 'bold' }}>SPLIT PAYMENT</div>
            {row('Cash:', `₱${splitCash.toFixed(2)}`)}
            {row('GCash:', `₱${splitGcash.toFixed(2)}`)}
            {transaction.gcashRef && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
                <span>Ref:</span><span>{transaction.gcashRef}</span>
              </div>
            )}
          </>
        )}
      </div>
      

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <div>Ref: {transaction.id.slice(-8)}</div>
        <div>{formattedDate}</div>
        {settings.receiptFooter && (
          <div style={{ ...dashedBorder, marginTop: '6px', wordBreak: 'break-word' }}>{settings.receiptFooter}</div>
        )}
        {!isPreview && <div style={{ marginTop: '6px', fontWeight: 'bold' }}>*** CUSTOMER COPY ***</div>}
      </div>
    </div>
  );
};

export default ReceiptTemplate;
