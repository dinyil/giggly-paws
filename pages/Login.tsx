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
    const success = await login(pin);
    setIsProcessing(false);
    if (!success) {
      setError('Invalid PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{background: 'linear-gradient(135deg, #FAF7FF 0%, #EDE0F7 50%, #FAF7FF 100%)'}}>
      
      {/* Floating decorative assets - corners */}
      <img src="/Assets/Asset 1.png" alt="" className="absolute top-6 left-6 w-20 opacity-40 rotate-[-15deg] pointer-events-none select-none" />
      <img src="/Assets/Asset 4.png" alt="" className="absolute top-6 right-8 w-20 opacity-40 rotate-[15deg] pointer-events-none select-none" />
      <img src="/Assets/Asset 7.png" alt="" className="absolute bottom-8 left-8 w-16 opacity-35 rotate-[-10deg] pointer-events-none select-none" />
      <img src="/Assets/Asset 9.png" alt="" className="absolute bottom-8 right-8 w-16 opacity-35 rotate-[10deg] pointer-events-none select-none" />
      <img src="/Assets/Asset 11.png" alt="" className="absolute top-1/3 left-4 w-14 opacity-30 pointer-events-none select-none" />
      <img src="/Assets/Asset 13.png" alt="" className="absolute top-1/3 right-4 w-14 opacity-30 pointer-events-none select-none" />

      {/* Main Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative overflow-hidden border border-purple-100">
        
        {/* Purple top banner with Primary Logo */}
        <div className="relative flex flex-col items-center pt-8 pb-4" style={{background: 'linear-gradient(135deg, #6B4FA0, #9B75C8)'}}>
          
          {/* Primary Logo 2 - main brand logo */}
          <div className="relative z-10">
            <img 
              src="/Assets/Primary Logo 2 - without PET SALON & PET HOTEL.png" 
              alt="GigglyPaws" 
              className="w-52 h-auto object-contain drop-shadow-2xl"
            />
          </div>
          
          <p className="text-purple-200 text-xs mb-4 relative z-10 mt-2" style={{fontFamily: 'Poppins, sans-serif'}}>
            Enter your PIN to access the system
          </p>
        </div>

        {/* Login Form */}
        <div className="p-6">
          {/* PIN Display */}
          <div className="flex justify-center gap-4 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  pin.length > i 
                    ? 'scale-125 shadow-md' 
                    : 'border-2 border-purple-200'
                }`}
                style={pin.length > i ? {background: '#F5D657', boxShadow: '0 0 8px rgba(245,214,87,0.5)'} : {}}
              />
            ))}
          </div>

          {error && (
            <div className="text-red-500 text-center mb-4 text-sm font-medium animate-pulse bg-red-50 rounded-xl py-2">
              {error}
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumClick(num.toString())}
                className="h-14 rounded-2xl text-xl font-bold transition-all active:scale-95 font-medium"
                style={{background: '#FAF7FF', color: '#4A2D7A', border: '1.5px solid #E0D0F5'}}
                onMouseEnter={e => (e.currentTarget.style.background = '#EDE0F7')}
                onMouseLeave={e => (e.currentTarget.style.background = '#FAF7FF')}
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="h-14 rounded-2xl font-bold transition-all active:scale-95 text-sm"
              style={{background: '#FFF0F0', color: '#E05555', border: '1.5px solid #FDD'}}
              onMouseEnter={e => (e.currentTarget.style.background = '#FFE0E0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFF0F0')}
            >
              CLR
            </button>
            <button
              onClick={() => handleNumClick('0')}
              className="h-14 rounded-2xl text-xl font-bold transition-all active:scale-95"
              style={{background: '#FAF7FF', color: '#4A2D7A', border: '1.5px solid #E0D0F5'}}
              onMouseEnter={e => (e.currentTarget.style.background = '#EDE0F7')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FAF7FF')}
            >
              0
            </button>
            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shadow-md"
              style={{background: 'linear-gradient(135deg, #6B4FA0, #9B75C8)', color: 'white'}}
            >
              {isProcessing 
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> 
                : <span className="text-xl">🐾</span>
              }
            </button>
          </div>

          {/* Small decorative tools row */}
          <div className="flex justify-center gap-4 opacity-30 mt-2">
            <img src="/Assets/Asset 2.png" alt="" className="w-6 h-6 object-contain" />
            <img src="/Assets/Asset 5.png" alt="" className="w-6 h-6 object-contain" />
            <img src="/Assets/Asset 8.png" alt="" className="w-6 h-6 object-contain" />
            <img src="/Assets/Asset 12.png" alt="" className="w-6 h-6 object-contain" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;