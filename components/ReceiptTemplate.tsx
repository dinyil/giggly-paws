
import React from 'react';
import { Transaction, StoreSettings } from '../types';

interface ReceiptTemplateProps { 
  transaction: Transaction; 
  settings: StoreSettings; 
  paperSize: '58mm' | '80mm';
  isPreview?: boolean;
}

const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ transaction, settings, paperSize, isPreview }) => {
  const widthClass = paperSize === '58mm' ? 'w-[58mm]' : 'w-[80mm]';
  const textSize = paperSize === '58mm' ? 'text-[9px]' : 'text-[11px]';
  const headerSize = paperSize === '58mm' ? 'text-[11px]' : 'text-sm';
  const padding = paperSize === '58mm' ? 'p-1' : 'p-2';
  
  const formattedDate = new Date(transaction.date).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Split Logic Helpers
  const isSplit = transaction.paymentMethod === 'SPLIT';
  const cashPaid = transaction.cashReceived || 0;
  const gcashPaid = transaction.total - cashPaid;

  return (
    <div className={`font-mono leading-tight text-black bg-white mx-auto ${widthClass} ${textSize} ${padding}`}>
      <div className="text-center mb-2">
        {settings.logo && (
          <div className="flex justify-center mb-2">
             <img 
               src={settings.logo} 
               alt="Store Logo"
               className="object-contain" 
               style={{ 
                   maxHeight: paperSize === '58mm' ? '60px' : '90px',
                   maxWidth: '90%',
                   margin: '0 auto',
                   display: 'block'
               }} 
             />
          </div>
        )}
        
        <h1 className={`font-bold uppercase ${headerSize} mt-1`}>{settings.name}</h1>
        <p>{settings.address}</p>
        <p>{settings.contactNumber}</p>
      </div>
      
      <div className="text-center mb-2 border-b border-black pb-1 border-dashed">
        {settings.receiptHeader}
      </div>

      <div className="border-b border-black border-dashed pb-2 mb-2 space-y-1">
        {transaction.items.map((item, idx) => {
            const itemTotal = item.price * item.quantity;
            return (
              <div key={idx}>
                <div className="flex justify-between items-start">
                    <span className="w-2/3 pr-1 leading-tight">{item.quantity} x {item.name}</span>
                    <span className="w-1/3 text-right">{itemTotal.toFixed(2)}</span>
                </div>
                {item.appliedDiscounts && item.appliedDiscounts.length > 0 && item.appliedDiscounts.map(d => {
                    const discountAmt = d.type === 'PERCENTAGE' 
                        ? itemTotal * (d.value / 100) 
                        : d.value * item.quantity;
                    return (
                        <div key={d.id} className="flex justify-between items-start text-[8px] italic pl-2 text-gray-600">
                            <span>- {d.name} ({d.type === 'PERCENTAGE' ? d.value + '%' : '₱'+d.value})</span>
                            <span>-{discountAmt.toFixed(2)}</span>
                        </div>
                    );
                })}
              </div>
            );
        })}
      </div>

      <div className="space-y-1 mb-2">
        <div className="flex justify-between"><span>Subtotal</span><span>{transaction.subtotal.toFixed(2)}</span></div>
        {transaction.discount > 0 && (
          <div className="flex justify-between"><span>Discount</span><span>-{transaction.discount.toFixed(2)}</span></div>
        )}
        <div className="flex justify-between"><span>VAT ({settings.vatRate}%)</span><span>{transaction.vat.toFixed(2)}</span></div>
        <div className={`flex justify-between font-bold border-t border-black pt-1 mt-1 ${headerSize}`}>
          <span>TOTAL</span>
          <span>₱{transaction.total.toFixed(2)}</span>
        </div>
      </div>

      <div className="border-t border-black border-dashed pt-1 mt-2 space-y-1">
          {transaction.paymentMethod === 'CASH' && <div className="flex justify-between"><span>Paid via Cash</span><span>₱{transaction.total.toFixed(2)}</span></div>}
          {transaction.paymentMethod === 'GCASH' && (
              <>
                <div className="flex justify-between"><span>Paid via GCash</span><span>₱{transaction.total.toFixed(2)}</span></div>
                <div className="flex justify-between text-[9px]"><span>Ref:</span><span>{transaction.gcashRef}</span></div>
              </>
          )}
          {isSplit && (
              <>
                <div className="flex justify-between font-bold"><span>SPLIT PAYMENT</span></div>
                <div className="flex justify-between"><span>Cash:</span><span>₱{cashPaid.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>GCash:</span><span>₱{gcashPaid.toFixed(2)}</span></div>
                <div className="flex justify-between text-[9px]"><span>Ref:</span><span>{transaction.gcashRef}</span></div>
              </>
          )}
      </div>

      <div className="text-center mt-4 space-y-1">
        <p>Ref: {transaction.id.slice(-8)}</p>
        <p>{formattedDate}</p>
        <div className="mt-2 pt-2 border-t border-black border-dashed">
          {settings.receiptFooter}
        </div>
        {!isPreview && <p className="mt-2 font-bold">*** CUSTOMER COPY ***</p>}
      </div>
    </div>
  );
};

export default ReceiptTemplate;
