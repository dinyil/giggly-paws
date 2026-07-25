import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Dog, Bone } from '../components/ui/Icons';
import { Role } from '../types';

const Login: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { login, currentUser, storeSettings } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
        if (currentUser.role === Role.ADMIN) {
            navigate('/dashboard');
        } else {
            navigate('/pos');
        }
    }
  }, [currentUser, navigate]);

  const handleNumClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!pin) {
      setError('Please enter a PIN code.');
      return;
    }

    setIsProcessing(true);
    // Async Login (Hashing happens here)
    const success = await login(pin);
    setIsProcessing(false);

    if (success) {
      // Redirect handled by useEffect
    } else {
      setError('Invalid PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-zinc-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 flex items-center justify-center mb-4 overflow-hidden">
             {storeSettings.logo ? (
                <img src={storeSettings.logo} alt="Logo" className="w-full h-full object-contain" />
             ) : (
                <Dog className="w-16 h-16 text-zinc-900" />
             )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center">{storeSettings.name}</h1>
          <p className="text-gray-400 mt-1">Enter your PIN to access system</p>
        </div>

        {/* PIN Display */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                pin.length > i ? 'bg-black scale-110' : 'bg-zinc-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-red-500 text-center mb-4 text-sm font-medium animate-pulse">
            {error}
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumClick(num.toString())}
              className="h-16 rounded-2xl bg-zinc-50 hover:bg-zinc-100 text-xl font-bold transition-all active:scale-95 text-zinc-800"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-16 rounded-2xl bg-red-50 hover:bg-red-100 text-red-500 font-semibold transition-all active:scale-95"
          >
            CLR
          </button>
          <button
            onClick={() => handleNumClick('0')}
            className="h-16 rounded-2xl bg-zinc-50 hover:bg-zinc-100 text-xl font-bold transition-all active:scale-95 text-zinc-800"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="h-16 rounded-2xl bg-black text-white hover:bg-zinc-800 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Bone className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;