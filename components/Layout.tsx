
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Role } from '../types';
import { 
  Dog, LayoutDashboard, ShoppingBag, Scissors, Receipt, 
  Settings, LogOut, Menu, X, History, Bone, User, Percent, FileText, Wallet, Users, ChevronDown, MessageSquare, BedDouble
} from './ui/Icons';
import BroadcastStatus from './BroadcastStatus';
import ChatWidget from './ChatWidget';

const Layout: React.FC = () => {
  const { currentUser, logout, storeSettings, isLoading, smsUsage } = useStore();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSmsDropdownOpen, setIsSmsDropdownOpen] = useState(false);
  const smsDropdownRef = useRef<HTMLDivElement>(null);

  // SMS Reset Time Calc
  const [minsUntilReset, setMinsUntilReset] = useState(0);

  useEffect(() => {
      const calcTime = () => {
          const now = new Date();
          const nextHour = new Date(now);
          nextHour.setHours(now.getHours() + 1, 0, 0, 0);
          const diff = nextHour.getTime() - now.getTime();
          setMinsUntilReset(Math.ceil(diff / 60000));
      };
      calcTime();
      const i = setInterval(calcTime, 60000);
      return () => clearInterval(i);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (smsDropdownRef.current && !smsDropdownRef.current.contains(event.target as Node)) {
              setIsSmsDropdownOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isLoading && !currentUser) {
      navigate('/');
    }
  }, [isLoading, currentUser, navigate]);

  if (isLoading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{background: '#FAF7FF'}}>
              <img src="/Assets/bathtub with pets.png" alt="Loading" className="w-32 h-32 object-contain animate-bounce" />
              <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              <p className="font-bold text-purple-400 animate-pulse" style={{fontFamily: 'Poppins, sans-serif'}}>Connecting to Cloud...</p>
          </div>
      );
  }

  if (!currentUser) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, access: Role.ADMIN }, 
    { to: '/pos', label: 'POS', icon: ShoppingBag, access: 'ALL' },
    { to: '/grooming', label: 'Grooming', icon: Scissors, access: 'ALL' },
    { to: '/hotel', label: 'Pet Hotel', icon: BedDouble, access: 'ALL' },
    { to: '/clients', label: 'Clients', icon: Users, access: 'ALL' }, 
    { to: '/transactions', label: 'Transactions', icon: Wallet, access: 'ALL' },
    { to: '/reports', label: 'Reports', icon: FileText, access: Role.ADMIN },
    { to: '/inventory', label: 'Inventory', icon: Bone, access: Role.ADMIN },
    { to: '/discounts', label: 'Discounts', icon: Percent, access: Role.ADMIN },
    { to: '/users', label: 'Users', icon: User, access: Role.ADMIN },
    { to: '/logs', label: 'Audit Logs', icon: History, access: Role.ADMIN },
    { to: '/settings', label: 'Settings', icon: Settings, access: Role.ADMIN },
  ];

  const allowedLinks = links.filter(link => 
    link.access === 'ALL' || link.access === currentUser.role || currentUser.role === Role.ADMIN
  );

  const NavContent = () => (
    <>
      {/* Sidebar Logo / Brand Area */}
      <div className="hidden lg:block px-4 pt-6 pb-4">
        <div className="flex justify-center">
          <img
            src="/Assets/Primary Logo 2 - without PET SALON & PET HOTEL.png"
            alt="GigglyPaws"
            className="w-36 h-auto object-contain drop-shadow-lg"
          />
        </div>
        <div className="flex justify-center mt-1">
          <span className="flex items-center gap-1 text-xs text-purple-200">
            <span className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></span> Online
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar py-4 lg:py-0">
        {allowedLinks.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group flex-shrink-0 ${
                isActive
                  ? 'bg-white/20 text-white shadow-md font-semibold border border-white/30'
                  : 'text-purple-200 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <link.icon className={`w-5 h-5 ${isActive ? 'text-yellow-300' : 'text-purple-300 group-hover:text-white'}`} />
                <span className="text-sm font-medium">{link.label}</span>
                {isActive && <span className="ml-auto text-yellow-300 text-lg">✦</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <div className="rounded-xl p-3 mb-3 border border-white/20" style={{background: 'rgba(255,255,255,0.1)'}}>
          <p className="text-xs text-purple-200 mb-0.5">Logged in as</p>
          <p className="font-bold text-white text-sm">{currentUser.name}</p>
          <p className="text-xs text-yellow-300 uppercase font-semibold">{currentUser.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2.5 text-red-300 hover:bg-red-500/20 hover:text-red-200 w-full rounded-xl transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  // SMS Usage Widget Variables
  const smsLimit = 30; // Hardcoded safe limit
  const smsCount = smsUsage.count;
  const smsPercent = Math.min(100, (smsCount / smsLimit) * 100);
  let smsColor = 'bg-green-500';
  if (smsPercent > 60) smsColor = 'bg-yellow-500';
  if (smsPercent > 90) smsColor = 'bg-red-500';

  return (
    <div className="flex h-screen overflow-hidden text-zinc-900" style={{background: '#FAF7FF'}}>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 w-full h-16 text-white flex items-center justify-between px-4 z-50 shadow-md" style={{background: 'linear-gradient(135deg, #4A2D7A, #7B55A8)'}}>
         <div className="flex items-center gap-2">
            <img
              src="/Assets/Primary Logo 2 - without PET SALON & PET HOTEL.png"
              alt="GigglyPaws"
              className="h-10 w-auto object-contain"
            />
         </div>
         <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
           {isMobileMenuOpen ? <X /> : <Menu />}
         </button>
      </div>

      {/* SMS Usage Widget (Top Right) - Visible Desktop & Mobile */}
      <div className="fixed top-4 right-4 z-50 hidden lg:block" ref={smsDropdownRef}>
          <button 
            onClick={() => setIsSmsDropdownOpen(!isSmsDropdownOpen)}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-full shadow-sm hover:shadow-md border border-zinc-200 transition-all active:scale-95"
          >
              <div className="bg-zinc-100 p-1.5 rounded-full">
                  <MessageSquare className="w-4 h-4 text-zinc-600" />
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isSmsDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isSmsDropdownOpen && (
              <div className="absolute top-12 right-0 w-64 bg-purple-900 text-white rounded-2xl shadow-2xl overflow-hidden animate-slide-down origin-top-right border border-zinc-700">
                  <div className="p-4">
                      <div className="flex justify-between items-center mb-2">
                          <h4 className="text-sm font-bold">SMS Limit (Hourly)</h4>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${smsCount >= smsLimit ? 'bg-red-500 text-white' : 'bg-purple-800 text-zinc-400'}`}>
                              {smsCount} / {smsLimit}
                          </span>
                      </div>
                      
                      <div className="w-full bg-zinc-700 h-2 rounded-full overflow-hidden mb-3">
                          <div className={`h-full ${smsColor} transition-all duration-500`} style={{ width: `${smsPercent}%` }}></div>
                      </div>

                      <p className="text-xs text-zinc-400 mb-1">
                          Resets automatically every hour to prevent SIM blocking.
                      </p>
                      
                      <div className="bg-purple-800 p-2 rounded-lg text-center mt-2 border border-zinc-700">
                          <p className="text-xs text-zinc-500 font-bold uppercase">Resets in</p>
                          <p className="font-mono text-lg font-bold text-white">{minsUntilReset} mins</p>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 pt-16 lg:hidden flex flex-col" style={{background: 'linear-gradient(160deg, #4A2D7A 0%, #7B55A8 60%, #9B75C8 100)'}}>
          <NavContent />
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 text-white flex-col h-full shadow-2xl z-20" style={{background: 'linear-gradient(160deg, #3D2468 0%, #6B4FA0 60%, #8B6AB8 100%)'}}>
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-16 lg:pt-0 relative text-zinc-900" style={{background: '#FAF7FF'}}>
        <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-full">
          <Outlet />
        </div>
        {/* Floating Broadcast Widget */}
        <BroadcastStatus />
        
        {/* Floating Chat Widget */}
        <ChatWidget />
      </main>
    </div>
  );
};

export default Layout;
