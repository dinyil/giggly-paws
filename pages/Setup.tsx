import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useNavigate } from 'react-router-dom';
import { Dog, ShieldCheck, CheckCircle } from '../components/ui/Icons';
import Button from '../components/ui/Button';
import { upsertData } from '../services/supabase';
import { generateSalt, hashPin } from '../services/crypto';
import { getDeviceId, getDeviceName } from '../services/device';

const Setup: React.FC = () => {
  const { isSystemSetup, addUser, currentDeviceId } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // If system is already setup, redirect to login
  if (isSystemSetup) {
      navigate('/');
      return null;
  }

  const handleSetup = async (e: React.FormEvent) => {
      e.preventDefault();
      if (pin.length !== 4) {
          alert("PIN must be 4 digits");
          return;
      }
      if (pin !== confirmPin) {
          alert("PINs do not match");
          return;
      }

      setIsProcessing(true);

      try {
          // 1. Create Super Admin User
          const salt = generateSalt();
          const hash = await hashPin(pin, salt);
          const securePin = `${salt}:${hash}`;

          const adminUser = {
              id: 'super-admin',
              name: name,
              role: 'ADMIN',
              pin: securePin
          };

          // 2. Add to Local State & DB
          // We use direct context methods or upsert logic
          addUser(adminUser);

          // 3. Auto-Approve THIS Device
          const devicePayload = {
              id: currentDeviceId,
              name: getDeviceName(),
              status: 'APPROVED',
              lastActive: new Date().toISOString()
          };
          await upsertData('devices', devicePayload);

          alert("System Setup Complete! You can now login.");
          navigate('/');
      } catch (error) {
          console.error("Setup failed", error);
          alert("Setup failed. Please check connection.");
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center mb-4">
                    <Dog className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-bold text-zinc-900">Welcome to GigglyPaws</h1>
                <p className="text-gray-500 mt-2">Initialize your POS System</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3 items-start">
                <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800">
                    <p className="font-bold mb-1">Create Super Admin</p>
                    <p>Since this is the first run, please create the main administrator account. This device will be automatically approved.</p>
                </div>
            </div>

            <form onSubmit={handleSetup} className="space-y-4">
                <div>
                    <label className="text-sm font-bold text-gray-700">Admin Name</label>
                    <input 
                        required
                        type="text" 
                        className="w-full border border-zinc-300 rounded-xl p-3 mt-1"
                        placeholder="e.g. Owner"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-bold text-gray-700">Create PIN</label>
                        <input 
                            required
                            type="password" 
                            inputMode="numeric"
                            maxLength={4}
                            className="w-full border border-zinc-300 rounded-xl p-3 mt-1 text-center font-mono tracking-widest text-lg"
                            placeholder="0000"
                            value={pin}
                            onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-700">Confirm PIN</label>
                        <input 
                            required
                            type="password" 
                            inputMode="numeric"
                            maxLength={4}
                            className="w-full border border-zinc-300 rounded-xl p-3 mt-1 text-center font-mono tracking-widest text-lg"
                            placeholder="0000"
                            value={confirmPin}
                            onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                        />
                    </div>
                </div>

                <Button type="submit" className="w-full mt-4" disabled={isProcessing}>
                    {isProcessing ? 'Setting up...' : 'Complete Setup'}
                </Button>
            </form>
        </div>
    </div>
  );
};

export default Setup;