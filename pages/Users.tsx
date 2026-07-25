import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { User, Role, Device } from '../types';
import Button from '../components/ui/Button';
import { Plus, User as UserIcon, Trash2, Settings as EditIcon, CheckCircle, Eye, ShieldCheck, Lock, X as XIcon, Copy, AlertCircle, Smartphone, Tablet, Monitor, Check, Ban, Cloud, Tag } from '../components/ui/Icons';
import { Dialog } from '@headlessui/react';
import { generateSalt, hashPin } from '../services/crypto';

const Users: React.FC = () => {
  const { users, addUser, editUser, deleteUser, devices, updateDeviceStatus, deleteDevice, currentDeviceId } = useStore();
  
  // UI States
  const [activeTab, setActiveTab] = useState<'USERS' | 'DEVICES'>('USERS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Admin Auth States
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminAuthPin, setAdminAuthPin] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [pendingAction, setPendingAction] = useState<{
    type: 'SAVE_USER' | 'VIEW_PIN';
    payload?: any;
  } | null>(null);

  // Reveal Modal States
  const [isRevealModalOpen, setIsRevealModalOpen] = useState(false);
  const [userToReveal, setUserToReveal] = useState<User | null>(null);
  const [testPin, setTestPin] = useState('');
  const [testResult, setTestResult] = useState<'MATCH' | 'FAIL' | null>(null);

  // User Delete Modal State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, id: string | null, name: string}>({
    isOpen: false, id: null, name: ''
  });

  // Device Delete Modal State
  const [deviceDeleteConfirmation, setDeviceDeleteConfirmation] = useState<{isOpen: boolean, id: string | null, name: string}>({
    isOpen: false, id: null, name: ''
  });

  // Device Approval Modal
  const [deviceApprovalOpen, setDeviceApprovalOpen] = useState(false);
  const [deviceToApprove, setDeviceToApprove] = useState<Device | null>(null);
  const [deviceCustomName, setDeviceCustomName] = useState('');
  
  // Form States
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '', pin: '', role: Role.CASHIER
  });
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [customRoleName, setCustomRoleName] = useState('');

  // Sort Devices: Current Device First, then by Last Active (Desc)
  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      // 1. Current Device always top
      if (a.id === currentDeviceId) return -1;
      if (b.id === currentDeviceId) return 1;

      // 2. Sort by Last Active (Newest first)
      const dateA = new Date(a.lastActive).getTime();
      const dateB = new Date(b.lastActive).getTime();
      return dateB - dateA;
    });
  }, [devices, currentDeviceId]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ name: '', pin: '', role: Role.CASHIER });
    setIsCustomRole(false);
    setCustomRoleName('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    const isStandardRole = user.role === Role.ADMIN || user.role === Role.CASHIER || user.role === Role.GROOMER;
    
    setFormData({ ...user, pin: '' }); // Don't show existing hash in input, strictly for updates
    setIsCustomRole(!isStandardRole);
    setCustomRoleName(isStandardRole ? '' : user.role);
    if (!isStandardRole) {
       setFormData(prev => ({...prev, role: 'CUSTOM'}));
    }
    
    setIsModalOpen(true);
  };

  // --- DEVICE APPROVAL LOGIC ---
  const handleApproveClick = (device: Device) => {
     setDeviceToApprove(device);
     setDeviceCustomName(device.custom_name || '');
     setDeviceApprovalOpen(true);
  };

  const confirmApproval = () => {
     if(deviceToApprove) {
         updateDeviceStatus(deviceToApprove.id, 'APPROVED', deviceCustomName);
         setDeviceApprovalOpen(false);
         setDeviceToApprove(null);
     }
  };

  // --- ADMIN AUTHORIZATION LOGIC ---

  const handleAdminAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setAdminAuthError('');
      
      const superAdmin = users.find(u => u.id === 'super-admin');
      if (!superAdmin) {
          setAdminAuthError('System Error: Super Admin account missing.');
          return;
      }

      // Verify Admin PIN
      let isValid = false;
      const [salt, hash] = superAdmin.pin.split(':');
      
      // If legacy format (should have been auto-migrated, but safety check)
      if (!hash) {
           isValid = superAdmin.pin === adminAuthPin;
      } else {
           const inputHash = await hashPin(adminAuthPin, salt);
           isValid = inputHash === hash;
      }

      if (isValid) {
          // Auth Success - Execute Pending Action
          setIsAdminAuthOpen(false);
          setAdminAuthPin('');
          
          if (pendingAction?.type === 'SAVE_USER') {
              processUserSave();
          } else if (pendingAction?.type === 'VIEW_PIN') {
              // Open Reveal Modal
              setUserToReveal(pendingAction.payload);
              setTestPin('');
              setTestResult(null);
              setIsRevealModalOpen(true);
          }
          setPendingAction(null);
      } else {
          setAdminAuthError('Invalid Super Admin PIN');
          setAdminAuthPin('');
      }
  };

  // --- SHOW PIN LOGIC ---
  const handleShowPinRequest = (user: User) => {
      if (!user.pin) {
          alert("This user has no PIN set.");
          return;
      }
      setPendingAction({ type: 'VIEW_PIN', payload: user });
      setAdminAuthPin('');
      setAdminAuthError('');
      setIsAdminAuthOpen(true);
  }

  // --- REVEAL MODAL LOGIC ---
  const handleVerifyTestPin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userToReveal || !testPin) return;

      const storedPin = userToReveal.pin;
      let isMatch = false;

      if (storedPin.includes(':')) {
          const [salt, hash] = storedPin.split(':');
          const attemptHash = await hashPin(testPin, salt);
          isMatch = attemptHash === hash;
      } else {
          isMatch = storedPin === testPin;
      }

      setTestResult(isMatch ? 'MATCH' : 'FAIL');
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Hash copied to clipboard");
  };

  // --- SAVE USER LOGIC ---

  const handleFormSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if PIN is being changed/added
    // If we are adding a new user, OR if we are editing and typed a new PIN
    if (formData.pin) {
        // Require Admin Auth
        setPendingAction({ type: 'SAVE_USER' });
        setAdminAuthPin('');
        setAdminAuthError('');
        setIsAdminAuthOpen(true);
    } else {
        // If just changing Name/Role (no sensitive PIN change), proceed directly
        processUserSave();
    }
  };

  const processUserSave = async () => {
    setIsProcessing(true);
    
    // Determine Role
    let finalRole = formData.role;
    if (isCustomRole) {
        if (!customRoleName.trim()) {
            alert("Please enter a custom role name");
            setIsProcessing(false);
            return;
        }
        finalRole = customRoleName.trim().toUpperCase();
    }

    // Validation
    if (!formData.name) {
        setIsProcessing(false);
        return;
    }
    
    const isPinStrictlyRequired = finalRole === Role.ADMIN || finalRole === Role.CASHIER;

    // PIN Validation & Hashing Logic
    let securePinString = editingUser?.pin || '';

    // If a new PIN is provided
    if (formData.pin) {
        if (formData.pin.length !== 4) {
            alert("PIN must be exactly 4 digits.");
            setIsProcessing(false);
            return;
        }
        // EXPLICIT SECURE HASHING: salt:hash
        const newSalt = generateSalt();
        const newHash = await hashPin(formData.pin, newSalt);
        securePinString = `${newSalt}:${newHash}`;
    } 
    else if (!editingUser && isPinStrictlyRequired) {
        alert("PIN is required for Admin and Cashier roles.");
        setIsProcessing(false);
        return;
    }

    if (editingUser) {
      const updatedUser: User = {
        ...editingUser,
        name: formData.name!,
        role: finalRole!,
        pin: securePinString,
        salt: undefined 
      };
      editUser(updatedUser);
    } else {
      const newUser: User = {
        id: Date.now().toString(),
        name: formData.name!,
        role: finalRole!,
        pin: securePinString,
        salt: undefined 
      };
      addUser(newUser);
    }
    setIsProcessing(false);
    setIsModalOpen(false);
  };

  const handleDeleteClick = (user: User) => {
    setDeleteConfirmation({ isOpen: true, id: user.id, name: user.name });
  };

  const confirmDelete = () => {
    if (deleteConfirmation.id) {
        deleteUser(deleteConfirmation.id);
        setDeleteConfirmation({ isOpen: false, id: null, name: '' });
    }
  };

  const handleDeleteDeviceClick = (device: Device) => {
      setDeviceDeleteConfirmation({ isOpen: true, id: device.id, name: device.name });
  };

  const confirmDeviceDelete = () => {
      if (deviceDeleteConfirmation.id) {
          deleteDevice(deviceDeleteConfirmation.id);
          setDeviceDeleteConfirmation({ isOpen: false, id: null, name: '' });
      }
  };

  const inputClass = "w-full border border-zinc-300 rounded-xl p-3 mt-1 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder-zinc-400 font-medium";
  
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col h-[calc(100vh-100px)]">
      <div className="p-6 border-b border-zinc-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-50">
        <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
          <UserIcon className="w-5 h-5" /> Team & Security
        </h2>
        
        <div className="flex bg-zinc-200 p-1 rounded-xl">
            <button 
                onClick={() => setActiveTab('USERS')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'USERS' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
            >
                <UserIcon className="w-4 h-4" /> Users
            </button>
            <button 
                onClick={() => setActiveTab('DEVICES')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'DEVICES' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
            >
                <Smartphone className="w-4 h-4" /> Devices 
                {devices.filter(d => d.status === 'PENDING').length > 0 && (
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
            </button>
        </div>
      </div>

      {activeTab === 'USERS' && (
      <div className="flex-1 overflow-auto flex flex-col">
        <div className="p-4 flex justify-end">
            <Button onClick={openAddModal}><Plus className="w-4 h-4" /> Add User</Button>
        </div>
        <table className="w-full text-left">
          <thead className="bg-zinc-50 sticky top-0 z-10">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Name</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Role</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Security Status</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-zinc-50 transition-colors">
                <td className="p-4 font-bold text-zinc-900">{user.name}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                    user.role === Role.ADMIN ? 'bg-black text-white' : 
                    user.role === Role.GROOMER ? 'bg-pink-100 text-pink-800' :
                    user.role === Role.CASHIER ? 'bg-blue-100 text-blue-800' : 
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4 text-sm text-gray-500 font-mono">
                  {user.pin ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded w-fit">
                            <CheckCircle className="w-3 h-3" />
                            {user.pin.includes(':') ? 'HASHED' : 'LEGACY'}
                        </div>
                        {/* Show PIN Button (Triggers Auth) */}
                        <button 
                            onClick={() => handleShowPinRequest(user)}
                            className="p-1.5 hover:bg-zinc-200 rounded-md text-gray-400 hover:text-black transition-colors"
                            title="Verify PIN Status (Requires Admin)"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 italic">No Login Access</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEditModal(user)}>
                      <EditIcon className="w-4 h-4" />
                    </Button>
                    {user.id !== 'super-admin' && (
                      <Button size="sm" variant="danger" onClick={() => handleDeleteClick(user)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {activeTab === 'DEVICES' && (
      <div className="flex-1 overflow-auto">
         <div className="p-4 bg-blue-50 border-b border-blue-100 text-blue-800 text-sm flex gap-3">
             <ShieldCheck className="w-5 h-5 shrink-0" />
             <p>Only <strong>Approved</strong> devices can access the system. Review pending requests carefully.</p>
         </div>
         <table className="w-full text-left">
          <thead className="bg-zinc-50 sticky top-0 z-10">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Device Name / Label</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Network</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Last Active</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedDevices.map(device => (
                <tr key={device.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="p-4">
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                                {device.device_type === 'Mobile' ? <Smartphone className="w-5 h-5" /> : 
                                 device.device_type === 'Tablet' ? <Tablet className="w-5 h-5" /> : 
                                 <Monitor className="w-5 h-5" />}
                             </div>
                             <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-zinc-900 text-sm">
                                        {device.custom_name || device.name || "Unknown Device"}
                                    </p>
                                    {device.id === currentDeviceId && <span className="text-[10px] bg-zinc-200 px-1 rounded font-bold text-zinc-600">THIS DEVICE</span>}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {device.custom_name ? (
                                        <span className="italic">{device.name}</span>
                                    ) : (
                                        <span className="italic text-gray-300">No label assigned</span>
                                    )}
                                </div>
                             </div>
                        </div>
                    </td>
                    <td className="p-4">
                         <div className="flex flex-col text-xs text-gray-400 space-y-0.5">
                            <div className="flex items-center gap-1">
                                <Cloud className="w-3 h-3" />
                                <span className="font-mono">{device.ip || "Unknown IP"}</span>
                            </div>
                            <span className="text-zinc-500">{device.location || "Location Unavailable"}</span>
                        </div>
                    </td>
                    <td className="p-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                            device.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            device.status === 'BLOCKED' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700 animate-pulse'
                        }`}>
                            {device.status}
                        </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                        {new Date(device.lastActive).toLocaleString()}
                    </td>
                    <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                            {device.status !== 'APPROVED' && (
                                <button 
                                    onClick={() => handleApproveClick(device)}
                                    className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-xs font-bold flex items-center gap-1"
                                    title="Approve Device"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                            )}
                            
                            {/* Hide Block button for the current device */}
                            {device.status !== 'BLOCKED' && device.id !== currentDeviceId && (
                                <button 
                                    onClick={() => {
                                        if(confirm(`Block ${device.name}? They will lose access immediately.`)) {
                                            updateDeviceStatus(device.id, 'BLOCKED');
                                        }
                                    }}
                                    className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg text-xs font-bold flex items-center gap-1"
                                    title="Block Device"
                                >
                                    <Ban className="w-4 h-4" />
                                </button>
                            )}

                            {/* Edit Label Button (If Approved) */}
                            {device.status === 'APPROVED' && (
                                <button
                                    onClick={() => handleApproveClick(device)}
                                    className="p-2 text-gray-400 hover:text-black hover:bg-zinc-200 rounded-lg transition-colors"
                                    title="Edit Label"
                                >
                                    <Tag className="w-4 h-4" />
                                </button>
                            )}

                            {/* Hide Delete button for the current device */}
                            {device.id !== currentDeviceId && (
                                <button 
                                    onClick={() => handleDeleteDeviceClick(device)}
                                    className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                                    title="Remove Device"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </td>
                </tr>
            ))}
            {devices.length === 0 && (
                <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">No devices registered.</td>
                </tr>
            )}
          </tbody>
         </table>
      </div>
      )}

      {/* APPROVE DEVICE MODAL */}
      <Dialog open={deviceApprovalOpen} onClose={() => setDeviceApprovalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <div className="text-center mb-6">
                 <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                     <CheckCircle className="w-6 h-6 text-green-600" />
                 </div>
                 <Dialog.Title className="text-xl font-bold text-zinc-900">
                     {deviceToApprove?.status === 'APPROVED' ? 'Edit Device Label' : 'Approve Device'}
                 </Dialog.Title>
                 <p className="text-sm text-gray-500 mt-2">
                     Assign a friendly name to identify this device (e.g., "Kitchen Display", "Counter 1").
                 </p>
            </div>

            <div className="mb-6">
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 mb-3 text-sm">
                    <p className="flex justify-between">
                        <span className="text-gray-400 font-bold text-xs uppercase">System Name:</span>
                        <span className="text-zinc-800">{deviceToApprove?.name}</span>
                    </p>
                    <p className="flex justify-between mt-1">
                        <span className="text-gray-400 font-bold text-xs uppercase">IP Address:</span>
                        <span className="font-mono text-zinc-600">{deviceToApprove?.ip}</span>
                    </p>
                </div>

                <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Device Label / Custom Name</label>
                <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g. Counter 1 iPad"
                    className={inputClass}
                    value={deviceCustomName}
                    onChange={(e) => setDeviceCustomName(e.target.value)}
                />
            </div>

            <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setDeviceApprovalOpen(false)}>Cancel</Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700 shadow-green-200" onClick={confirmApproval}>
                    {deviceToApprove?.status === 'APPROVED' ? 'Update Label' : 'Approve & Save'}
                </Button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* User Form Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl">
            <Dialog.Title className="text-xl font-bold mb-4 text-zinc-900">
              {editingUser ? 'Edit User' : 'Add New User'}
            </Dialog.Title>
            <form onSubmit={handleFormSubmitRequest} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700">Name</label>
                <input 
                  required 
                  type="text" 
                  className={inputClass}
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>
              
              {/* Role Selection */}
              <div>
                <label className="text-sm font-bold text-gray-700">Role</label>
                <select 
                  className={inputClass}
                  value={isCustomRole ? 'CUSTOM' : formData.role} 
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'CUSTOM') {
                        setIsCustomRole(true);
                        setFormData({...formData, role: ''});
                    } else {
                        setIsCustomRole(false);
                        setFormData({...formData, role: val});
                    }
                  }}
                >
                  <option value={Role.CASHIER}>Cashier</option>
                  <option value={Role.ADMIN}>Admin</option>
                  <option value={Role.GROOMER}>Groomer</option>
                  <option value="CUSTOM">Other (Custom Role)...</option>
                </select>
              </div>

              {/* Custom Role Input */}
              {isCustomRole && (
                  <div>
                    <label className="text-sm font-bold text-gray-700">Custom Role Name</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="e.g. TRAINEE"
                      className={inputClass}
                      value={customRoleName} 
                      onChange={e => setCustomRoleName(e.target.value)} 
                    />
                  </div>
              )}

              {/* PIN Input */}
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                <div className="flex justify-between items-center mb-1">
                   <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                     <Lock className="w-3 h-3 text-yellow-600" />
                     <span>
                       {editingUser ? 'Change PIN' : 'Set PIN'}
                     </span>
                   </label>
                   {(formData.role === Role.ADMIN || formData.role === Role.CASHIER) 
                      ? <span className="text-red-500 text-xs">* Required</span>
                      : <span className="text-gray-400 text-xs">(Optional)</span>
                   }
                </div>
                
                <p className="text-xs text-yellow-700 mb-2 leading-tight">
                    <strong>Note:</strong> Changing a PIN requires Super Admin authorization to save.
                </p>

                <input 
                  type="password" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  className="w-full border border-zinc-300 rounded-xl p-3 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black font-mono text-center tracking-widest text-lg"
                  value={formData.pin} 
                  placeholder={editingUser ? '••••' : '0000'}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                    setFormData({...formData, pin: val});
                  }} 
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isProcessing} className="flex-1">
                    {formData.pin ? 'Verify & Save' : 'Save User'}
                </Button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
      
      {/* Super Admin Auth Modal */}
      <Dialog open={isAdminAuthOpen} onClose={() => setIsAdminAuthOpen(false)} className="relative z-[60]">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in border-2 border-zinc-900">
             <div className="flex flex-col items-center text-center mb-6">
                 <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                     <ShieldCheck className="w-6 h-6 text-white" />
                 </div>
                 <Dialog.Title className="text-xl font-bold text-zinc-900">Admin Authorization</Dialog.Title>
                 <p className="text-sm text-gray-500 mt-2">
                     {pendingAction?.type === 'SAVE_USER' 
                       ? "Enter Super Admin PIN to authorize password change." 
                       : "Enter Super Admin PIN to reveal secure data."}
                 </p>
             </div>
             
             <form onSubmit={handleAdminAuthSubmit}>
                 <div className="mb-4">
                     <input 
                        autoFocus
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        placeholder="Super Admin PIN"
                        className="w-full text-center text-2xl font-bold tracking-[0.5em] py-3 border-b-2 border-zinc-200 focus:border-black focus:outline-none bg-transparent"
                        value={adminAuthPin}
                        onChange={e => setAdminAuthPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                     />
                     {adminAuthError && (
                         <p className="text-red-500 text-xs font-bold text-center mt-2 animate-pulse">{adminAuthError}</p>
                     )}
                 </div>
                 
                 <div className="flex gap-3">
                    <Button type="button" variant="ghost" onClick={() => setIsAdminAuthOpen(false)} className="flex-1">Cancel</Button>
                    <Button type="submit" className="flex-1">Authorize</Button>
                 </div>
             </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* REVEAL / VERIFY PIN MODAL */}
      <Dialog open={isRevealModalOpen} onClose={() => setIsRevealModalOpen(false)} className="relative z-[60]">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-fade-in border border-zinc-200">
             
             <div className="flex justify-between items-start mb-6">
                 <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Security Credentials</p>
                    <h3 className="text-xl font-bold text-zinc-900">{userToReveal?.name}</h3>
                    <p className="text-xs text-zinc-500">{userToReveal?.role} Access</p>
                 </div>
                 <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                     <ShieldCheck className="w-4 h-4" /> Authorized
                 </div>
             </div>

             {/* HASH DISPLAY */}
             <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 mb-6">
                 <div className="flex justify-between items-center mb-2">
                     <p className="text-xs font-bold text-zinc-500 uppercase">Stored Secure Hash</p>
                     <button onClick={() => userToReveal?.pin && copyToClipboard(userToReveal.pin)} className="text-zinc-400 hover:text-black">
                         <Copy className="w-4 h-4" />
                     </button>
                 </div>
                 <div className="bg-white border border-zinc-200 p-3 rounded-xl">
                     <p className="font-mono text-[10px] text-zinc-600 break-all leading-tight">
                         {userToReveal?.pin || "NO_PIN_SET"}
                     </p>
                 </div>
                 <div className="flex gap-2 mt-2 items-start">
                    <AlertCircle className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-zinc-400 italic">
                        Security Note: This is a <strong>Secure Hash</strong>. It is "One-Way" encryption, meaning it is <strong>impossible</strong> to decrypt or reveal the original 4-digit PIN. If the user forgot their PIN, please reset it using the button below.
                    </p>
                 </div>
             </div>

             {/* VERIFY SECTION */}
             <form onSubmit={handleVerifyTestPin} className="border-t border-zinc-100 pt-6">
                 <p className="text-sm font-bold text-zinc-900 mb-2">Verify a PIN</p>
                 <p className="text-xs text-gray-500 mb-3">Type a PIN below to check if it matches the stored hash.</p>
                 
                 <div className="flex gap-2 mb-4">
                     <input 
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        className="flex-1 border border-zinc-300 rounded-xl px-4 py-2 text-center font-mono tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="0000"
                        value={testPin}
                        onChange={e => setTestPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                     />
                     <Button type="submit">Check</Button>
                 </div>

                 {testResult === 'MATCH' && (
                     <div className="bg-green-50 text-green-700 p-3 rounded-xl flex items-center gap-2 font-bold text-sm animate-pulse">
                         <CheckCircle className="w-5 h-5" /> Match! This is the correct PIN.
                     </div>
                 )}
                 {testResult === 'FAIL' && (
                     <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-center gap-2 font-bold text-sm">
                         <XIcon className="w-5 h-5" /> Incorrect. Does not match stored hash.
                     </div>
                 )}
             </form>

             <div className="mt-6 pt-4 border-t border-zinc-100 flex gap-3">
                 <Button 
                    variant="primary" 
                    className="flex-1 bg-zinc-900 text-white" 
                    onClick={() => {
                        if (userToReveal) {
                            setIsRevealModalOpen(false);
                            openEditModal(userToReveal);
                        }
                    }}
                 >
                    <EditIcon className="w-4 h-4" /> Reset PIN
                 </Button>
                 <Button variant="secondary" onClick={() => setIsRevealModalOpen(false)}>Close</Button>
             </div>

          </Dialog.Panel>
        </div>
      </Dialog>

      {/* User Delete Confirmation Modal */}
      <Dialog open={deleteConfirmation.isOpen} onClose={() => setDeleteConfirmation({...deleteConfirmation, isOpen: false})} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Delete User?</Dialog.Title>
                    <p className="text-sm text-gray-500 mt-2">
                        Are you sure you want to delete <span className="font-bold text-zinc-800">"{deleteConfirmation.name}"</span>? This action cannot be undone.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setDeleteConfirmation({...deleteConfirmation, isOpen: false})} className="flex-1">
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDelete} className="flex-1">
                        Delete
                    </Button>
                </div>
            </Dialog.Panel>
        </div>
      </Dialog>

      {/* Device Delete Confirmation Modal */}
      <Dialog open={deviceDeleteConfirmation.isOpen} onClose={() => setDeviceDeleteConfirmation({...deviceDeleteConfirmation, isOpen: false})} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Remove Device?</Dialog.Title>
                    <p className="text-sm text-gray-500 mt-2">
                        Are you sure you want to remove <span className="font-bold text-zinc-800">"{deviceDeleteConfirmation.name}"</span>? 
                        They will need to request approval again to access the system.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setDeviceDeleteConfirmation({...deviceDeleteConfirmation, isOpen: false})} className="flex-1">
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDeviceDelete} className="flex-1">
                        Remove
                    </Button>
                </div>
            </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

export default Users;