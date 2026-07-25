
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { Client, Pet } from '../types';
import Button from '../components/ui/Button';
import { Plus, Search, Trash2, Settings, Users, Phone, MapPin, Calendar, Dog, History, X, CheckCircle, AlertCircle, Pencil, Mail, ChevronUp, ChevronDown } from '../components/ui/Icons';
import { Dialog } from '@headlessui/react';

// Helper to ensure contact number starts with 09...
const sanitizeContactNumber = (num: string) => {
    // Remove non-digits
    let cleaned = num.replace(/[^0-9]/g, ''); 
    
    // Case: 9171234567 (Missing leading 0) -> 0917...
    if (cleaned.length === 10 && cleaned.startsWith('9')) {
        cleaned = '0' + cleaned;
    }
    // Case: 639171234567 (Country code included) -> 0917...
    else if (cleaned.length === 12 && cleaned.startsWith('639')) {
        cleaned = '0' + cleaned.substring(2);
    }
    
    return cleaned;
};

const Clients: React.FC = () => {
  const { clients, addClient, updateClient, deleteClient, appointments, products, hotelBookings } = useStore();
  const [search, setSearch] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  // Form Data for Owner
  const [formData, setFormData] = useState({
    ownerName: '', 
    contactNumber: '', 
    email: '',
    address: '', 
    notes: ''
  });

  // State for Pets Management
  const [tempPets, setTempPets] = useState<Pet[]>([]);
  const [editingPetIndex, setEditingPetIndex] = useState<number | null>(null); // Track which pet is being edited
  const [petInput, setPetInput] = useState({
    petName: '',
    petBreed: '',
    petColor: '',
    weightSize: ''
  });

  // Pet Update Confirmation State
  const [petUpdateModal, setPetUpdateModal] = useState<{isOpen: boolean, changes: string[]}>({
    isOpen: false, changes: []
  });

  // Pet Profile Modal State
  const [isPetModalOpen, setIsPetModalOpen] = useState(false);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [activePetId, setActivePetId] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, id: string | null, name: string}>({
    isOpen: false, id: null, name: ''
  });

  // Calculate stats and filter
  const enrichedClients = useMemo(() => {
      return clients.map(client => {
          // --- Grooming appointments for this client ---
          const clientApts = appointments.filter(a => a.ownerName.toLowerCase() === client.name.toLowerCase());
          clientApts.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          // --- Hotel bookings for this client (match by client_id or owner_name) ---
          const clientHotelBookings = hotelBookings.filter(b =>
            b.status !== 'CANCELLED' && (
              (client.id && b.client_id === client.id) ||
              b.owner_name.toLowerCase() === client.name.toLowerCase()
            )
          );

          // --- Merge all unique VISIT DAYS ---
          // Grooming: use appointment date
          // Hotel: use check_in date — multiple dogs same day = 1 visit
          const allVisitDays = new Set<string>([
            ...clientApts.map(a => new Date(a.date).toDateString()),
            ...clientHotelBookings.map(b => new Date(b.check_in).toDateString()),
          ]);

          // --- Last visit: latest across both grooming and hotel ---
          const aptDates = clientApts.map(a => a.date);
          const hotelDates = clientHotelBookings.map(b => b.check_in);
          const allDates = [...aptDates, ...hotelDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          const lastVisit = allDates.length > 0 ? allDates[0] : null;

          return {
              ...client,
              totalVisits: allVisitDays.size,
              lastVisit
          };
      }).filter(c => 
          c.name.toLowerCase().includes(search.toLowerCase()) || 
          (c.contactNumber && c.contactNumber.includes(search)) ||
          (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
      ).sort((a,b) => {
          const dateA = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
          const dateB = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
          if (dateA === 0 && dateB === 0) {
             const createdA = a.firstSeen ? new Date(a.firstSeen).getTime() : 0;
             const createdB = b.firstSeen ? new Date(b.firstSeen).getTime() : 0;
             return createdB - createdA;
          }
          if (dateB !== dateA) return dateB - dateA;
          return a.name.localeCompare(b.name);
      });
  }, [clients, appointments, hotelBookings, search]);

  // Pagination Data
  const totalPages = Math.ceil(enrichedClients.length / itemsPerPage);
  const paginatedClients = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return enrichedClients.slice(start, start + itemsPerPage);
  }, [enrichedClients, currentPage]);

  useEffect(() => {
      setCurrentPage(1);
  }, [search]);

  const handlePageChange = (newPage: number) => {
      setCurrentPage(newPage);
      if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const openAddModal = () => {
    setEditingClient(null);
    setFormData({ ownerName: '', contactNumber: '', email: '', address: '', notes: '' });
    setPetInput({ petName: '', petBreed: '', petColor: '', weightSize: '' });
    setTempPets([]);
    setEditingPetIndex(null);
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
        ownerName: client.name,
        contactNumber: client.contactNumber,
        email: client.email || '',
        address: client.address || '',
        notes: client.notes || ''
    });
    // Load existing pets
    setTempPets(client.pets ? [...client.pets] : []);
    // Clear input for adding new
    setPetInput({ petName: '', petBreed: '', petColor: '', weightSize: '' });
    setEditingPetIndex(null);
    setIsModalOpen(true);
  };

  const openPetModal = (client: Client) => {
      setViewingClient(client);
      // Default to first pet if available
      if (client.pets && client.pets.length > 0) {
          setActivePetId(client.pets[0].id);
      } else {
          setActivePetId(null);
      }
      setIsPetModalOpen(true);
  };

  const handleDeleteClick = (client: Client) => {
      setDeleteConfirmation({ isOpen: true, id: client.id, name: client.name });
  };

  const confirmDelete = () => {
      if (deleteConfirmation.id) {
          deleteClient(deleteConfirmation.id);
          setDeleteConfirmation({ isOpen: false, id: null, name: '' });
      }
  };

  // --- PET MANAGEMENT LOGIC ---

  const handlePetClick = (index: number) => {
      const pet = tempPets[index];
      setEditingPetIndex(index);
      // Auto-fill inputs
      setPetInput({
          petName: pet.name,
          petBreed: pet.breed || '',
          petColor: pet.color || '',
          weightSize: pet.weightSize || ''
      });
  };

  const cancelPetEdit = () => {
      setEditingPetIndex(null);
      setPetInput({ petName: '', petBreed: '', petColor: '', weightSize: '' });
  };

  const handleAddPet = () => {
      if (!petInput.petName) return;
      const newPet: Pet = {
          id: Date.now().toString() + Math.random().toString().slice(2,5),
          name: petInput.petName,
          breed: petInput.petBreed,
          color: petInput.petColor,
          weightSize: petInput.weightSize
      };
      setTempPets(prev => [...prev, newPet]);
      setPetInput({ petName: '', petBreed: '', petColor: '', weightSize: '' });
  };

  const handlePrepareUpdatePet = () => {
      if (editingPetIndex === null) return;
      
      const originalPet = tempPets[editingPetIndex];
      const newChanges: string[] = [];

      if (originalPet.name !== petInput.petName) newChanges.push(`Name: "${originalPet.name}" → "${petInput.petName}"`);
      if (originalPet.breed !== petInput.petBreed) newChanges.push(`Breed: "${originalPet.breed || 'N/A'}" → "${petInput.petBreed}"`);
      if (originalPet.color !== petInput.petColor) newChanges.push(`Color: "${originalPet.color || 'N/A'}" → "${petInput.petColor}"`);
      if (originalPet.weightSize !== petInput.weightSize) newChanges.push(`Size: "${originalPet.weightSize || 'N/A'}" → "${petInput.weightSize}"`);

      if (newChanges.length === 0) {
          // No changes, just close edit mode
          cancelPetEdit();
          return;
      }

      setPetUpdateModal({ isOpen: true, changes: newChanges });
  };

  const confirmPetUpdate = () => {
      if (editingPetIndex === null) return;

      const updatedPet = {
          ...tempPets[editingPetIndex],
          name: petInput.petName,
          breed: petInput.petBreed,
          color: petInput.petColor,
          weightSize: petInput.weightSize
      };

      const newList = [...tempPets];
      newList[editingPetIndex] = updatedPet;
      setTempPets(newList);
      
      // Reset everything
      setPetUpdateModal({ isOpen: false, changes: [] });
      cancelPetEdit();
  };

  const handleRemovePetFromList = (e: React.MouseEvent, index: number) => {
      e.stopPropagation(); // Prevent triggering edit mode
      // If deleting the one currently being edited, cancel edit first
      if (editingPetIndex === index) {
          cancelPetEdit();
      } else if (editingPetIndex !== null && index < editingPetIndex) {
          // Adjust index if we delete an item above the one being edited
          setEditingPetIndex(prev => prev! - 1);
      }
      setTempPets(prev => prev.filter((_, i) => i !== index));
  };

  // --- CLIENT SUBMISSION ---

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ownerName) return;

    // Logic: If user typed in pet inputs but didn't click "Add", we should add it automatically
    // ONLY if not in edit mode (to prevent accidental dupes or overwrites)
    let finalPets = [...tempPets];
    if (editingPetIndex === null && petInput.petName) {
        finalPets.push({
            id: Date.now().toString() + Math.random().toString().slice(2,5),
            name: petInput.petName,
            breed: petInput.petBreed,
            color: petInput.petColor,
            weightSize: petInput.weightSize
        });
    }
    
    // Auto-sanitize one last time for safety
    const finalContactNumber = sanitizeContactNumber(formData.contactNumber || '');

    const baseData = {
        name: formData.ownerName,
        contactNumber: finalContactNumber,
        email: formData.email || '',
        address: formData.address || '',
        notes: formData.notes || '',
        pets: finalPets
    };

    if (editingClient) {
      updateClient({ ...editingClient, ...baseData });
    } else {
      addClient({
          id: Date.now().toString(),
          ...baseData,
          firstSeen: new Date().toISOString()
      });
    }
    setIsModalOpen(false);
  };

  // --- Derived Data for Pet Modal ---
  const activePet = viewingClient?.pets.find(p => p.id === activePetId);

  const activePetHistory = useMemo(() => {
      if (!viewingClient || !activePet) return [];
      return appointments.filter(a => 
          a.ownerName.toLowerCase() === viewingClient.name.toLowerCase() &&
          a.petName.toLowerCase() === activePet.name.toLowerCase()
      ).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments, viewingClient, activePet]);

  // Hotel bookings for this specific pet
  const activePetHotelHistory = useMemo(() => {
      if (!viewingClient || !activePet) return [];
      return hotelBookings.filter(b =>
          b.status !== 'CANCELLED' &&
          (
            (viewingClient.id && b.client_id === viewingClient.id) ||
            b.owner_name.toLowerCase() === viewingClient.name.toLowerCase()
          ) &&
          b.pet_name.toLowerCase() === activePet.name.toLowerCase()
      ).sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime());
  }, [hotelBookings, viewingClient, activePet]);

  // Combined timeline: grooming + hotel, sorted newest first
  const combinedHistory = useMemo(() => {
      const groomingItems = activePetHistory.map(a => ({ type: 'GROOMING' as const, date: a.date, data: a }));
      const hotelItems = activePetHotelHistory.map(b => ({ type: 'HOTEL' as const, date: b.check_in, data: b }));
      return [...groomingItems, ...hotelItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activePetHistory, activePetHotelHistory]);

  const inputClass = "w-full border border-zinc-300 rounded-xl p-3 mt-1 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder-zinc-400 font-medium text-sm";
  const labelClass = "text-xs font-bold text-gray-500 uppercase";

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col h-[calc(100vh-100px)]">
      
      {/* Header */}
      <div className="p-6 border-b border-zinc-100 bg-zinc-50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
             <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
               <Users className="w-6 h-6" /> Client Database
             </h2>
             <p className="text-gray-500 text-sm mt-1">Manage customer profiles and pet history</p>
          </div>
          <Button onClick={openAddModal}>
             <Plus className="w-4 h-4" /> Add Client
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white border-b border-zinc-100">
        <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
                type="text" 
                placeholder="Search by Name, Email or Contact no..."
                className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black bg-white text-zinc-900 font-medium"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <table className="w-full text-left">
          <thead className="bg-zinc-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Customer Name</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Contact / Details</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Pet Info</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase">Stats</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {paginatedClients.map(client => {
                const isNew = client.firstSeen && new Date(client.firstSeen).toDateString() === new Date().toDateString();
                const petCount = client.pets ? client.pets.length : 0;
                
                return (
                  <tr key={client.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="p-4 align-top">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-sm shrink-0">
                                {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-bold text-zinc-900 flex items-center gap-2">
                                    {client.name}
                                    {isNew && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold animate-pulse">NEW</span>}
                                </p>
                                <p className="text-xs text-gray-400">ID: {client.id.slice(-4)}</p>
                            </div>
                        </div>
                    </td>
                    <td className="p-4 align-top">
                        <div className="space-y-1">
                            {client.contactNumber && (
                                <p className="text-sm text-gray-600 flex items-center gap-2">
                                    <Phone className="w-3 h-3 text-zinc-400" /> {client.contactNumber}
                                </p>
                            )}
                            {client.email && (
                                <p className="text-xs text-blue-600 flex items-center gap-2 truncate max-w-[200px]">
                                    <Mail className="w-3 h-3" /> {client.email}
                                </p>
                            )}
                            {client.address && (
                                <p className="text-xs text-gray-500 flex items-center gap-2 max-w-[200px] truncate">
                                    <MapPin className="w-3 h-3 text-zinc-400" /> {client.address}
                                </p>
                            )}
                        </div>
                    </td>
                    <td className="p-4 align-top">
                        <div className="flex items-center gap-2">
                            <Dog className="w-4 h-4 text-zinc-400" />
                            <span className="font-bold text-zinc-700">{petCount} Pet(s)</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 pl-6 truncate max-w-[200px]">
                            {petCount > 0 ? client.pets.map(p => p.name).join(', ') : 'No pets registered'}
                        </p>
                    </td>
                    <td className="p-4 align-top">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-bold border border-green-100">
                                <Calendar className="w-3 h-3" /> {client.totalVisits} Visits
                            </div>
                            {client.lastVisit && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Last: {new Date(client.lastVisit).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    </td>
                    <td className="p-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openPetModal(client)} title="View Pets & History" className="text-blue-500 hover:bg-blue-50 hover:text-blue-600 font-bold text-xs flex items-center gap-1">
                                <Dog className="w-4 h-4" /> View Details
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => openEditModal(client)} title="Edit">
                                <Settings className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => handleDeleteClick(client)} title="Delete">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
          <div className="p-4 bg-white border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-xs text-gray-500">
                  Showing <span className="font-bold text-zinc-800">{Math.min(enrichedClients.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="font-bold text-zinc-800">{Math.min(enrichedClients.length, currentPage * itemsPerPage)}</span> of {enrichedClients.length} records
              </div>
              <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <ChevronUp className="w-4 h-4 -rotate-90" />
                  </button>
                  <span className="text-xs font-bold text-zinc-700">Page {currentPage} of {totalPages}</span>
                  <button 
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <ChevronDown className="w-4 h-4 -rotate-90" />
                  </button>
              </div>
          </div>
      )}

      {/* Edit/Add Client Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <Dialog.Title className="text-xl font-bold mb-4 text-zinc-900 border-b border-zinc-100 pb-2">
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </Dialog.Title>
            
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              
              {/* 1. Owner Details */}
              <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Users className="w-3 h-3" /> Owner Details</h4>
                  <div>
                        <label className={labelClass}>Owner Name</label>
                        <input required className={inputClass} value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} placeholder="Name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Contact no.</label>
                        <input 
                            className={inputClass} 
                            value={formData.contactNumber} 
                            onChange={e => setFormData({...formData, contactNumber: e.target.value})} 
                            onBlur={(e) => setFormData({...formData, contactNumber: sanitizeContactNumber(e.target.value)})}
                            placeholder="09XX..." 
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Email Address</label>
                        <input type="email" className={inputClass} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@example.com" />
                    </div>
                  </div>
              </div>

              {/* 2. Pet Details */}
              <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Dog className="w-3 h-3" /> Pets ({tempPets.length})</h4>
                      <span className="text-[10px] text-gray-400 italic">Click a pet to edit</span>
                  </div>
                  
                  {/* List of Added Pets */}
                  {tempPets.length > 0 && (
                      <div className="space-y-2 mb-4 bg-zinc-50 p-2 rounded-xl border border-zinc-100">
                          {tempPets.map((p, idx) => (
                              <div 
                                key={p.id || idx} 
                                onClick={() => handlePetClick(idx)}
                                className={`flex justify-between items-center p-2 rounded-lg border shadow-sm cursor-pointer transition-all ${
                                    editingPetIndex === idx 
                                    ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' 
                                    : 'bg-white border-zinc-200 hover:border-blue-300'
                                }`}
                              >
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${editingPetIndex === idx ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                          <Dog className="w-4 h-4" />
                                      </div>
                                      <div>
                                          <p className="text-sm font-bold text-zinc-900">{p.name}</p>
                                          <p className="text-[10px] text-gray-500 uppercase">{p.breed || 'Unknown'} • {p.color || 'No Color'}</p>
                                      </div>
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={(e) => handleRemovePetFromList(e, idx)} 
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                      <X className="w-4 h-4" />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}

                  {/* Add New Pet Form */}
                  <div className={`p-4 rounded-xl border relative transition-all ${editingPetIndex !== null ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50/50 border-blue-100'}`}>
                      <p className={`text-xs font-bold mb-3 uppercase flex items-center gap-1 ${editingPetIndex !== null ? 'text-yellow-700' : 'text-blue-600'}`}>
                         {editingPetIndex !== null ? <Pencil className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                         {editingPetIndex !== null ? 'Editing Pet Details' : 'Add New Pet'}
                      </p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className={labelClass}>Pet Name</label>
                            <input 
                                className={inputClass} 
                                value={petInput.petName} 
                                onChange={e => setPetInput({...petInput, petName: e.target.value})} 
                                placeholder="Pet Name" 
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Breed</label>
                            <input 
                                className={inputClass} 
                                value={petInput.petBreed} 
                                onChange={e => setPetInput({...petInput, petBreed: e.target.value})} 
                                placeholder="Breed" 
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Color</label>
                            <input 
                                className={inputClass} 
                                value={petInput.petColor} 
                                onChange={e => setPetInput({...petInput, petColor: e.target.value})} 
                                placeholder="Color" 
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Weight / Size</label>
                            <input 
                                className={inputClass} 
                                value={petInput.weightSize} 
                                onChange={e => setPetInput({...petInput, weightSize: e.target.value})} 
                                placeholder="e.g. 5kg" 
                            />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                          {editingPetIndex !== null ? (
                              <>
                                <Button 
                                    type="button" 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={cancelPetEdit}
                                    className="flex-1 bg-white border border-zinc-200"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="button" 
                                    size="sm" 
                                    variant="primary" 
                                    onClick={handlePrepareUpdatePet} 
                                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 border-yellow-600 text-white"
                                >
                                    Update Pet
                                </Button>
                              </>
                          ) : (
                              <Button 
                                type="button" 
                                size="sm" 
                                variant="secondary" 
                                onClick={handleAddPet} 
                                disabled={!petInput.petName} 
                                className="w-full border-blue-200 text-blue-700 hover:bg-blue-100"
                              >
                                Add Pet to List
                              </Button>
                          )}
                      </div>
                  </div>
              </div>

              {/* 3. Additional Info */}
              <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><MapPin className="w-3 h-3" /> Additional Info</h4>
                  <div>
                      <label className={labelClass}>Address</label>
                      <input className={inputClass} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="City/Address..." />
                  </div>
                  <div>
                      <label className={labelClass}>Notes</label>
                      <textarea rows={2} className={`${inputClass} resize-none`} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Important notes..." />
                  </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-100">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1">
                    {editingClient ? 'Save Changes' : 'Save Client'}
                </Button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Pet Edit Confirmation Modal */}
      <Dialog open={petUpdateModal.isOpen} onClose={() => setPetUpdateModal({isOpen: false, changes: []})} className="relative z-[60]">
        <div className="fixed inset-0 bg-purple-700/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4 mx-auto text-yellow-600">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Confirm Pet Update</Dialog.Title>
                    <p className="text-sm text-gray-500 mt-1">Review the changes for this pet:</p>
                </div>
                
                <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 mb-6 space-y-2 text-sm text-zinc-700">
                    {petUpdateModal.changes.map((change, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{change}</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setPetUpdateModal({isOpen: false, changes: []})} className="flex-1">
                        Edit More
                    </Button>
                    <Button variant="primary" onClick={confirmPetUpdate} className="flex-1 bg-yellow-500 hover:bg-yellow-600 shadow-yellow-200">
                        Confirm Changes
                    </Button>
                </div>
            </Dialog.Panel>
        </div>
      </Dialog>

      {/* COMPREHENSIVE PET PROFILE MODAL */}
      <Dialog open={isPetModalOpen} onClose={() => setIsPetModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[85vh]">
             
             {/* Left Sidebar: Pet List */}
             <div className="w-full md:w-1/3 bg-zinc-50 border-r border-zinc-100 flex flex-col">
                 <div className="p-6 border-b border-zinc-100">
                     <h3 className="font-bold text-lg text-zinc-900">{viewingClient?.name}'s Pets</h3>
                     <p className="text-xs text-gray-500">Select a pet to view details</p>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 space-y-3">
                     {viewingClient?.pets.map(pet => (
                         <div 
                            key={pet.id}
                            onClick={() => setActivePetId(pet.id)}
                            className={`p-4 rounded-2xl cursor-pointer transition-all border flex items-center gap-3 ${
                                activePetId === pet.id 
                                ? 'bg-white border-purple-700 shadow-md' 
                                : 'bg-white border-transparent hover:border-zinc-300'
                            }`}
                         >
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activePetId === pet.id ? 'bg-purple-700 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                 <Dog className="w-5 h-5" />
                             </div>
                             <div>
                                 <p className="font-bold text-sm text-zinc-900">{pet.name}</p>
                                 <p className="text-xs text-gray-500">{pet.breed || 'Unknown Breed'}</p>
                             </div>
                         </div>
                     ))}
                     {(!viewingClient?.pets || viewingClient.pets.length === 0) && (
                         <div className="text-center p-8 text-gray-400">
                             <Dog className="w-12 h-12 mx-auto mb-2 opacity-20" />
                             <p>No pets registered.</p>
                         </div>
                     )}
                 </div>
                 <div className="p-4 border-t border-zinc-100">
                     <Button variant="ghost" className="w-full" onClick={() => setIsPetModalOpen(false)}>Close</Button>
                 </div>
             </div>

             {/* Right Content: Details & History */}
             <div className="flex-1 flex flex-col bg-white">
                 {activePet ? (
                     <>
                        <div className="p-6 border-b border-zinc-100 flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                                    {activePet.name}
                                    <span className="text-sm font-normal text-gray-500 px-2 py-1 bg-zinc-100 rounded-lg">{activePet.breed}</span>
                                </h2>
                                <div className="flex gap-4 mt-2 text-sm text-gray-600">
                                    <span>🎨 {activePet.color || 'N/A'}</span>
                                    <span>⚖️ {activePet.weightSize || 'N/A'}</span>
                                </div>
                            </div>
                             <div className="text-right">
                                <div className="text-3xl font-bold text-zinc-900">{combinedHistory.length}</div>
                                <div className="text-xs font-bold text-gray-400 uppercase">Total Visits</div>
                                <div className="flex gap-1 mt-1 justify-end">
                                    {activePetHistory.length > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">✂️ {activePetHistory.length}</span>}
                                    {activePetHotelHistory.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{background:'#EDE0F7',color:'#4A2D7A'}}>🏨 {activePetHotelHistory.length}</span>}
                                </div>
                             </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <h4 className="font-bold text-sm text-gray-400 uppercase mb-4 flex items-center gap-2">
                                <History className="w-4 h-4" /> Visit History
                            </h4>
                            
                            {combinedHistory.length === 0 ? (
                                <div className="border-2 border-dashed border-zinc-100 rounded-2xl p-8 text-center text-gray-400">
                                    <p>No visit history recorded for {activePet.name}.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {combinedHistory.map((item, idx) => {
                                        if (item.type === 'GROOMING') {
                                            const apt = item.data as typeof activePetHistory[0];
                                            const service = products.find(p => p.id === apt.serviceId);
                                            return (
                                                <div key={apt.id} className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="font-bold text-zinc-900 block text-sm">
                                                                {new Date(apt.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                            </span>
                                                            <span className="text-xs text-gray-500">{apt.time}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">✂️ Grooming</span>
                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                                                apt.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                                            }`}>{apt.status}</span>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-xs border-t border-zinc-200 pt-2">
                                                        <div>
                                                            <p className="text-gray-400 uppercase font-bold mb-0.5">Service</p>
                                                            <p className="font-medium">{service?.name || 'Unknown'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-400 uppercase font-bold mb-0.5">Groomer</p>
                                                            <p className="font-medium">{apt.groomerId}</p>
                                                        </div>
                                                    </div>
                                                    {apt.hairCut && (
                                                        <div className="mt-2 bg-white p-2 rounded-lg text-xs italic text-gray-600 border border-zinc-200">
                                                            <span className="font-bold not-italic">Note:</span> {apt.hairCut}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        } else {
                                            const booking = item.data as typeof activePetHotelHistory[0];
                                            return (
                                                <div key={booking.id} className="rounded-xl p-4 border" style={{background: '#FAF7FF', borderColor: '#C9A8E0'}}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="font-bold block text-sm" style={{color: '#4A2D7A'}}>
                                                                {new Date(booking.check_in).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                            </span>
                                                            <span className="text-xs" style={{color: '#7B55A8'}}>
                                                                Check-out: {new Date(booking.check_out).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{background: '#EDE0F7', color: '#4A2D7A'}}>🏨 Hotel</span>
                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                                                booking.status === 'CHECKED_OUT' ? 'bg-green-100 text-green-700' :
                                                                booking.status === 'CHECKED_IN' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-yellow-100 text-yellow-700'
                                                            }`}>{booking.status.replace('_', ' ')}</span>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-xs border-t pt-2" style={{borderColor: '#C9A8E0'}}>
                                                        <div>
                                                            <p className="uppercase font-bold mb-0.5" style={{color: '#9B72C8'}}>Duration</p>
                                                            <p className="font-medium" style={{color: '#4A2D7A'}}>{booking.total_nights} night{booking.total_nights !== 1 ? 's' : ''}</p>
                                                        </div>
                                                        <div>
                                                            <p className="uppercase font-bold mb-0.5" style={{color: '#9B72C8'}}>Rate</p>
                                                            <p className="font-medium" style={{color: '#4A2D7A'}}>₱{booking.daily_rate.toLocaleString()}/night</p>
                                                        </div>
                                                    </div>
                                                    {booking.notes && (
                                                        <div className="mt-2 bg-white p-2 rounded-lg text-xs italic border" style={{color: '#7B55A8', borderColor: '#C9A8E0'}}>
                                                            <span className="font-bold not-italic">Note:</span> {booking.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                            )}
                        </div>
                     </>
                 ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                         <Dog className="w-24 h-24 mb-4 opacity-20" />
                         <p className="text-lg font-bold">Select a Pet</p>
                         <p className="text-sm">Choose a pet from the left sidebar to view details.</p>
                     </div>
                 )}
             </div>

          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmation.isOpen} onClose={() => setDeleteConfirmation({...deleteConfirmation, isOpen: false})} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Delete Client?</Dialog.Title>
                    <p className="text-sm text-gray-500 mt-2">
                        Are you sure you want to delete <span className="font-bold text-zinc-800">"{deleteConfirmation.name}"</span>?
                        <br/>
                        <span className="text-xs text-red-500 mt-1 block">Their appointment history and pet data will be preserved in logs, but the profile will be removed.</span>
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

    </div>
  );
};

export default Clients;
