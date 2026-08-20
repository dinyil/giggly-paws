import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, Category } from '../types';
import Button from '../components/ui/Button';
import { Plus, Search, Bone, Scissors, Trash2, Settings, Settings as SettingsIcon, History, AlertCircle, ChevronUp, ChevronDown } from '../components/ui/Icons';
import { Dialog } from '@headlessui/react';

type TabType = 'PRODUCTS' | 'SERVICES';

// Helper for loose search matching
const normalizeText = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

const Inventory: React.FC = () => {
  const { 
    products, addProduct, updateProduct, deleteProduct, logs,
    productCategories, serviceCategories,
    addProductCategory, editProductCategory, deleteProductCategory, 
    addServiceCategory, editServiceCategory, deleteServiceCategory
  } = useStore();

  const [activeTab, setActiveTab] = useState<TabType>('PRODUCTS');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterSize, setFilterSize] = useState<string>('ALL'); // Size filter for Services tab
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', price: 0, cost: 0, stock: 0, category: '', isService: false,
    petSpecies: 'BOTH', weightSizeCategory: 'ALL'
  });

  // Delete Product Modal State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, id: string | null, name: string}>({
    isOpen: false, id: null, name: ''
  });

  // Delete Category Modal State
  const [catDeleteConfirmation, setCatDeleteConfirmation] = useState<{isOpen: boolean, category: string | null}>({
    isOpen: false, category: null
  });

  // Log Modal States
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedProductLogs, setSelectedProductLogs] = useState<{product: Product, logs: any[]} | null>(null);

  // Category Management State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null); // If null, adding new
  const [catNameInput, setCatNameInput] = useState('');

  // Derived Data
  const currentCategories = activeTab === 'PRODUCTS' ? productCategories : serviceCategories;
  
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        // Filter by Tab Type (Product vs Service)
        const isService = p.isService;
        if (activeTab === 'PRODUCTS' && isService) return false;
        if (activeTab === 'SERVICES' && !isService) return false;

        // Filter by Low Stock
        if (showLowStockOnly) {
            if (p.isService) return false; // Services don't have stock
            if (p.stock >= 10) return false;
        }

        // Filter by Search (Normalized)
        if (search) {
            const normalizedSearch = normalizeText(search);
            const normalizedName = normalizeText(p.name);
            if (!normalizedName.includes(normalizedSearch)) return false;
        }

        // Filter by Category
        if (filterCategory !== 'ALL' && p.category !== filterCategory) return false;

        // Filter by Size (Services tab only, Dog services)
        if (activeTab === 'SERVICES' && filterSize !== 'ALL') {
            const sizeVal = (p as any).weightSizeCategory || 'ALL';
            if (sizeVal !== filterSize) return false;
        }

        return true;
    });
  }, [products, activeTab, search, filterCategory, filterSize, showLowStockOnly]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  useEffect(() => {
      setCurrentPage(1);
  }, [activeTab, search, filterCategory, filterSize, showLowStockOnly]);

  const handlePageChange = (newPage: number) => {
      setCurrentPage(newPage);
      if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ 
      name: '', 
      price: 0,
      cost: 0, 
      stock: 0, 
      category: currentCategories[0], 
      isService: activeTab === 'SERVICES',
      petSpecies: activeTab === 'SERVICES' ? 'DOG' : 'BOTH', // default DOG for services so size selector shows immediately
      weightSizeCategory: activeTab === 'SERVICES' ? undefined : 'ALL', // force staff to choose size
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      ...product,
      petSpecies: (product as any).petSpecies || 'BOTH',
      weightSizeCategory: (product as any).weightSizeCategory || 'ALL',
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
      setDeleteConfirmation({ isOpen: true, id: product.id, name: product.name });
  };

  const confirmDelete = () => {
      if (deleteConfirmation.id) {
          deleteProduct(deleteConfirmation.id);
          setDeleteConfirmation({ isOpen: false, id: null, name: '' });
      }
  };

  const openLogModal = (product: Product) => {
    // Filter logs for this product (using referenceId OR fallback to name search for legacy logs)
    const productLogs = logs.filter(l => 
        l.referenceId === product.id || 
        l.details.includes(product.name) // Fallback for old logs
    ).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setSelectedProductLogs({ product, logs: productLogs });
    setIsLogModalOpen(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product: Product = {
      id: editingProduct ? editingProduct.id : Date.now().toString(),
      name: formData.name!,
      price: Number(formData.price),
      cost: Number(formData.cost || 0),
      stock: activeTab === 'SERVICES' ? 0 : Number(formData.stock),
      category: formData.category as Category,
      isService: activeTab === 'SERVICES',
      petSpecies: formData.petSpecies || 'BOTH',
      weightSizeCategory: formData.petSpecies === 'DOG' ? (formData.weightSizeCategory || 'ALL') : 'ALL',
    };

    if (editingProduct) {
      updateProduct(product);
    } else {
      addProduct(product);
    }
    setIsModalOpen(false);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameInput.trim()) return;
    
    const catName = catNameInput.trim().toUpperCase();
    
    if (editingCategory) {
      // Edit Mode
      if (activeTab === 'PRODUCTS') {
        editProductCategory(editingCategory, catName);
      } else {
        editServiceCategory(editingCategory, catName);
      }
      // If we are currently filtering by the edited category, update the filter
      if (filterCategory === editingCategory) {
        setFilterCategory(catName);
      }
    } else {
      // Add Mode
      if (activeTab === 'PRODUCTS') {
        addProductCategory(catName);
      } else {
        addServiceCategory(catName);
      }
    }
    
    setCatNameInput('');
    setEditingCategory(null);
    setIsCatModalOpen(false);
  };

  // Replaces the window.confirm logic
  const handleDeleteCategoryClick = (e: React.MouseEvent, cat: string) => {
    e.stopPropagation();
    setCatDeleteConfirmation({ isOpen: true, category: cat });
  };

  const confirmCategoryDelete = () => {
    if (catDeleteConfirmation.category) {
        const cat = catDeleteConfirmation.category;
        if (activeTab === 'PRODUCTS') {
            deleteProductCategory(cat);
        } else {
            deleteServiceCategory(cat);
        }
        if (filterCategory === cat) setFilterCategory('ALL');
        setCatDeleteConfirmation({ isOpen: false, category: null });
    }
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    setCatNameInput('');
    setIsCatModalOpen(true);
  }

  const openEditCategory = (cat: string) => {
    setEditingCategory(cat);
    setCatNameInput(cat);
    setIsCatModalOpen(true);
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Shared Input Class
  const inputClass = "w-full border border-zinc-300 rounded-xl p-3 mt-1 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder-zinc-400 font-medium";

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col h-[calc(100vh-100px)]">
      
      {/* Top Header & Tabs */}
      <div className="p-6 border-b border-zinc-100 bg-zinc-50">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-zinc-900">Inventory Management</h2>
          <Button onClick={openAddModal}>
             <Plus className="w-4 h-4" /> Add {activeTab === 'PRODUCTS' ? 'Product' : 'Service'}
          </Button>
        </div>

        <div className="flex gap-4">
           <button 
             onClick={() => { setActiveTab('PRODUCTS'); setFilterCategory('ALL'); setFilterSize('ALL'); setShowLowStockOnly(false); }}
             className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
               activeTab === 'PRODUCTS' 
               ? 'bg-purple-700 text-white shadow-lg' 
               : 'bg-white text-gray-500 hover:bg-gray-100 border border-zinc-200'
             }`}
           >
             <Bone className="w-5 h-5" /> Products
           </button>
           <button 
             onClick={() => { setActiveTab('SERVICES'); setFilterCategory('ALL'); setFilterSize('ALL'); setShowLowStockOnly(false); }}
             className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
               activeTab === 'SERVICES' 
               ? 'bg-purple-700 text-white shadow-lg' 
               : 'bg-white text-gray-500 hover:bg-gray-100 border border-zinc-200'
             }`}
           >
             <Scissors className="w-5 h-5" /> Services
           </button>
        </div>
      </div>

      {/* Filters & Categories */}
      <div className="p-4 bg-white border-b border-zinc-100 space-y-4">
        <div className="flex gap-3">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder={`Search ${activeTab.toLowerCase()}...`}
                    className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black bg-white text-zinc-900"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            {activeTab === 'PRODUCTS' && (
                 <button 
                    onClick={() => {
                        const newValue = !showLowStockOnly;
                        setShowLowStockOnly(newValue);
                        if (newValue) setFilterCategory('ALL');
                    }}
                    className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                        showLowStockOnly 
                        ? 'bg-red-500 text-white shadow-md' 
                        : 'bg-white text-zinc-500 border border-zinc-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                    }`}
                >
                    <AlertCircle className="w-5 h-5" />
                    <span className="hidden sm:inline">Low Stock</span>
                </button>
            )}
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
           <span className="text-xs font-bold text-gray-400 uppercase mr-1">Filter:</span>
           <button 
             onClick={() => setFilterCategory('ALL')}
             className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
               filterCategory === 'ALL' ? 'bg-purple-800 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
             }`}
           >
             ALL
           </button>
           {currentCategories.map(cat => (
             <div key={cat} className="relative group flex items-center">
                <button 
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
                    filterCategory === cat ? 'bg-purple-800 text-white pr-16' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                >
                    {cat}
                </button>
                
                {/* Edit/Delete Actions (Only visible when active) */}
                {filterCategory === cat && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 z-10">
                        <button 
                             onClick={(e) => { e.stopPropagation(); openEditCategory(cat); }}
                             className="p-1 text-gray-400 hover:text-white hover:bg-zinc-600 rounded"
                             title="Edit Name"
                        >
                            <Settings className="w-3 h-3" />
                        </button>
                        <button 
                             onClick={(e) => handleDeleteCategoryClick(e, cat)}
                             className="p-1 text-gray-400 hover:text-red-300 hover:bg-zinc-600 rounded"
                             title="Delete"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                )}
             </div>
           ))}
           
           {/* Add Category Button */}
           <button 
             onClick={openAddCategory}
             className="px-3 py-1.5 rounded-lg text-sm font-bold border border-dashed border-zinc-400 text-zinc-500 hover:bg-zinc-50 whitespace-nowrap flex items-center gap-1"
           >
             <Plus className="w-3 h-3" /> New
           </button>
        </div>

        {/* Size Filter — Services tab only */}
        {activeTab === 'SERVICES' && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-3 border-t border-zinc-100">
            <span className="text-xs font-bold text-gray-400 uppercase mr-1 flex-shrink-0">Size:</span>
            {(['ALL', 'XS', 'S', 'M', 'L', 'XL', 'XXL'] as const).map(sz => (
              <button
                key={sz}
                onClick={() => setFilterSize(sz)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${
                  filterSize === sz
                    ? sz === 'ALL' ? 'bg-zinc-800 text-white' : 'bg-blue-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {sz === 'ALL' ? '✦ ALL sizes' : sz}
              </button>
            ))}
            <span className="text-[10px] text-gray-400 ml-1 whitespace-nowrap">XS ≤2kg · S ≤5kg · M ≤10kg · L ≤16kg · XL ≤25kg · XXL &gt;25kg</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <table className="w-full text-left">
          <thead className="bg-zinc-50 sticky top-0 z-10">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">For</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cost</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Price (SRP)</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {paginatedProducts.map(product => (
              <tr key={product.id} className="hover:bg-zinc-50 transition-colors">
                <td className="p-4 font-medium text-zinc-900">{product.name}</td>
                <td className="p-4"><span className="text-xs bg-zinc-100 text-zinc-800 px-2 py-1 rounded-lg font-bold">{product.category}</span></td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {/* Species badge */}
                    {(product as any).petSpecies && (product as any).petSpecies !== 'BOTH' ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        (product as any).petSpecies === 'DOG' ? 'bg-amber-100 text-amber-700' :
                        (product as any).petSpecies === 'CAT' ? 'bg-purple-100 text-purple-700' :
                        'bg-zinc-100 text-zinc-600'
                      }`}>
                        {(product as any).petSpecies === 'DOG' ? '🐶 Dog' : (product as any).petSpecies === 'CAT' ? '🐱 Cat' : '🐾 Other'}
                      </span>
                    ) : <span className="text-[10px] text-gray-300">All species</span>}
                    {/* Size badge — only for dog services */}
                    {(product as any).petSpecies === 'DOG' && (product as any).weightSizeCategory && (product as any).weightSizeCategory !== 'ALL' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {(product as any).weightSizeCategory}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-gray-500">₱{(product.cost || 0).toFixed(2)}</td>
                <td className="p-4 font-bold text-zinc-900">₱{product.price.toFixed(2)}</td>
                <td className="p-4">
                  <div className={`font-bold ${!product.isService && product.stock < 10 ? 'text-red-500' : 'text-zinc-700'}`}>
                    {product.isService ? '∞' : product.stock}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" className="text-gray-500 hover:bg-zinc-100" onClick={() => openLogModal(product)} title="View Logs">
                         <History className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEditModal(product)} title="Edit">
                         <SettingsIcon className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteClick(product)} title="Delete">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-gray-400">
                   {showLowStockOnly 
                     ? "No low stock items found!" 
                     : `No ${activeTab.toLowerCase()} found in this category.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
          <div className="p-4 bg-white border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-xs text-gray-500">
                  Showing <span className="font-bold text-zinc-800">{Math.min(filteredProducts.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="font-bold text-zinc-800">{Math.min(filteredProducts.length, currentPage * itemsPerPage)}</span> of {filteredProducts.length} records
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

      {/* Add/Edit Product Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl">
            <Dialog.Title className="text-xl font-bold mb-4 text-zinc-900">
              {editingProduct ? 'Edit' : 'Add'} {activeTab === 'PRODUCTS' ? 'Product' : 'Service'}
            </Dialog.Title>
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700">Name</label>
                <input required type="text" className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-bold text-gray-700">Cost</label>
                    <input type="number" className={inputClass} value={formData.cost || ''} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} placeholder="0.00" />
                </div>
                <div>
                    <label className="text-sm font-bold text-gray-700">Price (SRP)</label>
                    <input required type="number" className={inputClass} value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} placeholder="0.00" />
                </div>
              </div>
              
              {activeTab === 'PRODUCTS' && (
                  <div>
                      <label className="text-sm font-bold text-gray-700">Stock</label>
                      <input type="number" className={inputClass} value={formData.stock || ''} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
                  </div>
              )}
              
              <div>
                <label className="text-sm font-bold text-gray-700">Category</label>
                <select className={inputClass} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as Category})}>
                  {currentCategories.map(c => (
                     <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* ── Pet Species ── */}
              <div>
                <label className="text-sm font-bold text-gray-700">For which pet? <span className="text-xs font-normal text-gray-400">(used for filtering in POS)</span></label>
                <div className="flex gap-2 mt-2">
                  {(['BOTH','DOG','CAT','OTHER'] as const).map(s => (
                    <button key={s} type="button"
                      onClick={() => setFormData(prev => ({ ...prev, petSpecies: s, weightSizeCategory: s !== 'DOG' ? 'ALL' : prev.weightSizeCategory }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        formData.petSpecies === s
                          ? s === 'DOG'  ? 'bg-amber-500 text-white border-amber-500'
                          : s === 'CAT'  ? 'bg-purple-600 text-white border-purple-600'
                          : s === 'BOTH' ? 'bg-green-600 text-white border-green-600'
                          : 'bg-zinc-600 text-white border-zinc-600'
                          : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400'
                      }`}>
                      {s === 'DOG' ? '🐶 Dog' : s === 'CAT' ? '🐱 Cat' : s === 'BOTH' ? '✦ All' : '🐾 Other'}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Weight/Size Category — shown in Services tab ── */}
              {activeTab === 'SERVICES' && (
                <div>
                  <label className="text-sm font-bold text-gray-700">
                    Dog Size Category
                    {formData.petSpecies === 'DOG' 
                      ? <span className="text-xs font-normal text-red-500 ml-1">* required for proper filtering</span>
                      : <span className="text-xs font-normal text-gray-400 ml-1">(only applies to Dog services)</span>
                    }
                  </label>
                  <div className={`flex gap-1.5 mt-2 flex-wrap ${formData.petSpecies !== 'DOG' ? 'opacity-30 pointer-events-none' : ''}`}>
                    {(['ALL','XS','S','M','L','XL','XXL'] as const).map(sz => (
                      <button key={sz} type="button"
                        onClick={() => setFormData(prev => ({ ...prev, weightSizeCategory: sz }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          formData.weightSizeCategory === sz
                            ? sz === 'ALL' ? 'bg-zinc-700 text-white border-zinc-700' : 'bg-blue-600 text-white border-blue-600'
                            : formData.weightSizeCategory === undefined && sz === 'ALL' ? 'border-2 border-dashed border-red-300 text-red-400'
                            : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400'
                        }`}>
                        {sz === 'ALL' ? '✦ ALL sizes' : sz}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">XS ≤2kg · S ≤5kg · M ≤10kg · L ≤16kg · XL ≤25kg · XXL &gt;25kg</p>
                  {formData.petSpecies === 'DOG' && !formData.weightSizeCategory && (
                    <p className="text-[10px] text-red-400 mt-1 font-bold">⚠ Please select a size — choose ALL if this service applies to all dog sizes</p>
                  )}
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1">Save</Button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Log History Modal */}
      <Dialog open={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <Dialog.Title className="text-xl font-bold mb-1 text-zinc-900 flex items-center gap-2">
              <History className="w-5 h-5" /> Activity History
            </Dialog.Title>
            <p className="text-sm text-gray-500 mb-4">{selectedProductLogs?.product.name}</p>
            
            <div className="flex-1 overflow-auto border border-zinc-100 rounded-xl bg-zinc-50 p-2">
                {selectedProductLogs?.logs && selectedProductLogs.logs.length > 0 ? (
                    <div className="space-y-2">
                        {selectedProductLogs.logs.map((log: any) => (
                            <div key={log.id} className="bg-white p-3 rounded-lg border border-zinc-100 shadow-sm text-sm">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-zinc-800">{log.action}</span>
                                    <span className="text-xs text-gray-400">{formatDate(log.timestamp)}</span>
                                </div>
                                <p className="text-zinc-600 mb-1">{log.details}</p>
                                <p className="text-xs text-gray-400 font-mono">User: {log.userId}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-gray-400">
                        <History className="w-8 h-8 opacity-20 mb-2" />
                        <p>No activity recorded yet.</p>
                    </div>
                )}
            </div>
            
            <div className="pt-4">
                 <Button onClick={() => setIsLogModalOpen(false)} className="w-full">Close</Button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Add/Edit Category Modal */}
      <Dialog open={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <Dialog.Title className="text-lg font-bold mb-4 text-zinc-900">
              {editingCategory ? 'Edit Category Name' : `Add ${activeTab === 'PRODUCTS' ? 'Product' : 'Service'} Category`}
            </Dialog.Title>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <input 
                autoFocus
                required 
                type="text" 
                placeholder="Category Name (e.g. TREATS)"
                className={inputClass} 
                value={catNameInput} 
                onChange={e => setCatNameInput(e.target.value)} 
              />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsCatModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1">{editingCategory ? 'Update' : 'Add'}</Button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Delete Product Confirmation Modal */}
      <Dialog open={deleteConfirmation.isOpen} onClose={() => setDeleteConfirmation({...deleteConfirmation, isOpen: false})} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Delete Product?</Dialog.Title>
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

      {/* Delete Category Confirmation Modal */}
      <Dialog open={catDeleteConfirmation.isOpen} onClose={() => setCatDeleteConfirmation({...catDeleteConfirmation, isOpen: false})} className="relative z-50">
        <div className="fixed inset-0 bg-purple-700/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-fade-in">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <Dialog.Title className="text-xl font-bold text-zinc-900">Delete Category?</Dialog.Title>
                    <p className="text-sm text-gray-500 mt-2">
                        Are you sure you want to delete <span className="font-bold text-zinc-800">"{catDeleteConfirmation.category}"</span>?
                        <br/><span className="text-xs text-red-500 mt-1 block">Note: Products in this category will need updating.</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setCatDeleteConfirmation({...catDeleteConfirmation, isOpen: false})} className="flex-1">
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmCategoryDelete} className="flex-1">
                        Delete
                    </Button>
                </div>
            </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

export default Inventory;