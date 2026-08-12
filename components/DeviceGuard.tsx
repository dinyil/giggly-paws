
import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Lock, Cloud, CheckCircle, ArrowRight, RotateCcw } from './ui/Icons';
import { getDeviceName } from '../services/device';
import Button from './ui/Button';
import { fetchTable } from '../services/supabase';

export const DeviceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading, isSystemSetup, currentDeviceStatus, registerDevice, storeSettings, devices, currentDeviceId, updateStoreSettings, updateDeviceStatus } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Track state transitions to show Welcome Modal
  const [showWelcome, setShowWelcome] = useState(false);
  const [wasPending, setWasPending] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  // Use any to avoid NodeJS namespace issues in browser environment
  const pollInterval = useRef<any>(null);

  // Force re-check logic
  const [lastCheck, setLastCheck] = useState(Date.now());

  useEffect(() => {
    if (!isLoading) {
      if (!isSystemSetup && location.pathname !== '/setup') {
        navigate('/setup');
      } else if (isSystemSetup) {
          // Prevent spamming / infinite loop
          const alreadyRegistered = devices.some(d => d.id === currentDeviceId);
          if (!alreadyRegistered) {
              registerDevice();
          }
      }
    }
  }, [isLoading, isSystemSetup, location.pathname, registerDevice, devices, currentDeviceId]);

  // Auto-approve device if it's PENDING but autoApproveUsers is enabled
  useEffect(() => {
    if (isLoading) return;
    if (currentDeviceStatus === 'PENDING' && storeSettings.autoApproveUsers !== false && currentDeviceId) {
      updateDeviceStatus(currentDeviceId, 'APPROVED');
    }
  }, [currentDeviceStatus, storeSettings.autoApproveUsers, currentDeviceId, isLoading]);

  // Monitor status changes for the Welcome Modal & Polling
  useEffect(() => {
      if (isLoading) return;

      if (currentDeviceStatus === 'PENDING') {
          setWasPending(true);
          // Start polling if not already
          if (!pollInterval.current) {
              setIsPolling(true);
              pollInterval.current = setInterval(async () => {
                  // Direct fetch to bypass potential socket issues
                  const data = await fetchTable('devices');
                  if (data) {
                      const myDevice = data.find((d: any) => d.id === currentDeviceId);
                      if (myDevice && myDevice.status === 'APPROVED') {
                          window.location.reload(); 
                      }
                  }
              }, 3000); // Check every 3 seconds
          }
      } else if (currentDeviceStatus === 'APPROVED') {
          // Stop polling
          if (pollInterval.current) {
              clearInterval(pollInterval.current);
              pollInterval.current = null;
              setIsPolling(false);
          }

          if (wasPending) {
              setShowWelcome(true);
              setWasPending(false);
          }
      } else if (currentDeviceStatus === 'BLOCKED') {
          if (pollInterval.current) {
              clearInterval(pollInterval.current);
              pollInterval.current = null;
          }
      }

      return () => {
          if (pollInterval.current) clearInterval(pollInterval.current);
      };
  }, [currentDeviceStatus, isLoading, wasPending, currentDeviceId]);

  const handleEnterSystem = () => {
      setShowWelcome(false);
  };

  if (isLoading) {
    return (
        <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 border-4 border-zinc-200 border-t-black rounded-full animate-spin"></div>
            <p className="font-bold text-zinc-500 animate-pulse">Checking Security...</p>
        </div>
    );
  }

  // Allow pass-through for Setup page
  if (location.pathname === '/setup') {
      return <>{children}</>;
  }

  // Handle Device Status for Normal Usage
  if (currentDeviceStatus === 'BLOCKED') {
      return (
          <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md text-center border-2 border-red-100">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-8 h-8 text-red-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-red-900 mb-2">Access Denied</h1>
                  <p className="text-gray-500 mb-6">This device has been blocked by the administrator.</p>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                      <p className="text-xs font-bold text-gray-400 uppercase">Device ID</p>
                      <p className="font-mono text-xs text-zinc-600 mt-1">{localStorage.getItem('pawfriends_device_id')}</p>
                  </div>
              </div>
          </div>
      );
  }

  // Welcome / Approval Notification Modal
  if (showWelcome) {
      return (
        <div className="min-h-screen bg-green-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md text-center border-2 border-green-100 relative overflow-hidden">
                {/* Confetti Background Effect (CSS only) */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" 
                     style={{backgroundImage: 'radial-gradient(circle, #22c55e 2px, transparent 2.5px)', backgroundSize: '20px 20px'}}>
                </div>

                <div className="relative z-10">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900 mb-2">Device Approved!</h1>
                    <p className="text-gray-500 mb-6">
                        Welcome to <strong>{storeSettings.name}</strong>. Your device has been successfully registered and authorized by the admin.
                    </p>
                    <Button onClick={handleEnterSystem} className="w-full bg-green-600 hover:bg-green-700 shadow-green-200 text-white py-4 text-lg">
                        Enter System <ArrowRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </div>
      );
  }

  // If auto-approve is ON, bypass the pending screen entirely
  if (currentDeviceStatus === 'PENDING' && storeSettings.autoApproveUsers !== false) {
    return <>{children}</>;
  }

  if (currentDeviceStatus === 'PENDING') {
      return (
          <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md text-center border border-zinc-100">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <ShieldCheck className="w-8 h-8 text-blue-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-zinc-900 mb-2">Device Pending Approval</h1>
                  <p className="text-gray-500 mb-6 text-sm">
                      For security, new devices must be approved by an Admin before accessing <strong>{storeSettings.name}</strong>.
                  </p>
                  
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 text-left space-y-3 mb-6">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">Device Name</p>
                        <p className="font-bold text-zinc-800 text-sm">{getDeviceName()}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">Device ID</p>
                        <p className="font-mono text-xs text-zinc-500 truncate">{localStorage.getItem('pawfriends_device_id')}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-blue-600 font-medium pt-2 border-t border-zinc-200">
                          {isPolling ? (
                              <>
                                <Cloud className="w-3 h-3 animate-bounce" /> Waiting for admin approval...
                              </>
                          ) : (
                              <>
                                <Cloud className="w-3 h-3" /> Request sent to Cloud Database
                              </>
                          )}
                      </div>
                  </div>

                  <div className="flex justify-center">
                      <button 
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 text-xs text-gray-400 hover:text-black transition-colors"
                      >
                          <RotateCcw className="w-3 h-3" /> Check Again
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return <>{children}</>;
};
