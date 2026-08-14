import React, { useState } from 'react';
import { Shield, X, Delete } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Role } from '../types';
import { hashPin } from '../services/crypto';

interface AdminPinModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen, title = 'Admin Authorization', description = 'Enter admin PIN to continue.',
  onSuccess, onClose,
}) => {
  const { users } = useStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleNum = (num: string) => {
    if (pin.length < 4) { setPin(prev => prev + num); setError(''); }
  };
  const handleClear = () => { setPin(''); setError(''); };

  const handleSubmit = async () => {
    if (!pin) { setError('Enter PIN.'); return; }
    setIsVerifying(true);
    const adminUsers = users.filter(u => u.role === Role.ADMIN || u.id === 'super-admin');
    let authorized = false;
    for (const user of adminUsers) {
      let storedPin = user.pin; let storedSalt = ''; let isLegacy = false;
      if (storedPin.includes(':')) { [storedSalt, storedPin] = storedPin.split(':'); }
      else if (user.salt) { storedSalt = user.salt; } else { isLegacy = true; }
      let isValid = false;
      if (!isLegacy && storedSalt) { const hash = await hashPin(pin, storedSalt); isValid = hash === storedPin; }
      else { isValid = storedPin === pin; }
      if (isValid) { authorized = true; break; }
    }
    setIsVerifying(false);
    if (authorized) { setPin(''); setError(''); onSuccess(); onClose(); }
    else { setError('Invalid admin PIN.'); setPin(''); }
  };

  const nums = ['1','2','3','4','5','6','7','8','9','CLR','0','OK'];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
        <div className="bg-gradient-to-r from-purple-700 to-purple-500 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Shield className="w-5 h-5" />
            <div>
              <p className="font-bold text-sm">{title}</p>
              <p className="text-purple-200 text-xs">{description}</p>
            </div>
          </div>
          <button onClick={() => { setPin(''); setError(''); onClose(); }} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <div className="flex justify-center gap-3 mb-4">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${pin.length > i ? 'bg-purple-600 border-purple-600' : 'bg-transparent border-zinc-300'}`} />
            ))}
          </div>
          {error && <p className="text-center text-red-500 text-xs font-semibold mb-3">{error}</p>}
          <div className="grid grid-cols-3 gap-2">
            {nums.map((n) => {
              if (n === 'CLR') return (
                <button key={n} onClick={handleClear} className="py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 font-bold text-xs text-zinc-600 transition-all">CLR</button>
              );
              if (n === 'OK') return (
                <button key={n} onClick={handleSubmit} disabled={isVerifying || pin.length < 4}
                  className="py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 font-bold text-white transition-all text-sm">
                  {isVerifying ? '...' : 'OK'}
                </button>
              );
              return (
                <button key={n} onClick={() => handleNum(n)}
                  className="py-3 rounded-xl bg-zinc-50 hover:bg-purple-50 border border-zinc-200 font-bold text-zinc-800 transition-all text-sm">{n}</button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPinModal;
