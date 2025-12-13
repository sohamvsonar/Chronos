'use client';

import { useState, useEffect } from 'react';
import { api, Product } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface Weights {
  collaborative: number;
  content: number;
}

export default function AdminPanel() {
  const [weights, setWeights] = useState<Weights>({ collaborative: 0.5, content: 0.5 });
  const [isLoadingWeights, setIsLoadingWeights] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { showToast } = useToast();

  // Product management states
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'products' | 'algorithm'>('products');

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    brand: '',
    category: '',
    price: '',
    stock: '',
    description: '',
  });

  // Load weights
  useEffect(() => {
    async function fetchWeights() {
      try {
        const data = await api.getWeights();
        if (data.weights) {
          setWeights(data.weights);
        }
      } catch (error) {
        console.error('Failed to fetch weights:', error);
      } finally {
        setIsLoadingWeights(false);
      }
    }
    fetchWeights();
  }, []);

  // Load products
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setIsLoadingProducts(true);
      const data = await api.getProducts();
      setProducts(data);
    } catch (error) {
      showToast('Failed to load products', 'error');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Weight handlers
  const handleCollaborativeChange = (value: number) => {
    const newCollab = Math.round(value * 100) / 100;
    const newContent = Math.round((1 - newCollab) * 100) / 100;
    setWeights({ collaborative: newCollab, content: newContent });
    setHasChanges(true);
  };

  const handleSaveWeights = async () => {
    setIsSaving(true);
    try {
      await api.updateWeights(weights);
      showToast('Weights updated successfully', 'success');
      setHasChanges(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to update weights', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Product handlers
  const resetForm = () => {
    setFormData({ id: '', name: '', brand: '', category: '', price: '', stock: '', description: '' });
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price.toString(),
      stock: product.stock.toString(),
      description: product.metadata?.description || '',
    });
    setShowEditModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newProduct = {
        id: formData.id || `prod_${Date.now()}`,
        name: formData.name,
        brand: formData.brand,
        category: formData.category,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        metadata: { description: formData.description },
      };
      await api.createProduct(newProduct);
      showToast('Product created successfully', 'success');
      setShowCreateModal(false);
      loadProducts();
    } catch (error: any) {
      showToast(error.message || 'Failed to create product', 'error');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const updates = {
        name: formData.name,
        brand: formData.brand,
        category: formData.category,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        metadata: { ...editingProduct.metadata, description: formData.description },
      };
      await api.updateProduct(editingProduct.id, updates);
      showToast('Product updated successfully', 'success');
      setShowEditModal(false);
      setEditingProduct(null);
      loadProducts();
    } catch (error: any) {
      showToast(error.message || 'Failed to update product', 'error');
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    try {
      await api.deleteProduct(product.id);
      showToast('Product deleted successfully', 'success');
      loadProducts();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete product', 'error');
    }
  };

  const handleStockUpdate = async (product: Product, change: number) => {
    const newStock = product.stock + change;
    if (newStock < 0) {
      showToast('Stock cannot be negative', 'error');
      return;
    }
    try {
      await api.updateProduct(product.id, { stock: newStock });
      showToast(`Stock updated to ${newStock}`, 'success');
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock } : p));
    } catch (error: any) {
      showToast(error.message || 'Failed to update stock', 'error');
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Admin Header */}
      <div className="text-center mb-8">
        <p className="text-[#d4af37] text-sm tracking-[0.3em] uppercase mb-4">Administration</p>
        <h2 className="font-display text-4xl md:text-5xl text-white mb-4">Control Panel</h2>
        <div className="w-16 h-px bg-[#d4af37] mx-auto mb-6" />
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-6 py-3 text-sm tracking-wide transition-all ${
            activeTab === 'products'
              ? 'bg-[#d4af37] text-black'
              : 'border border-[#2a2a2a] text-[#808080] hover:border-[#d4af37]/30 hover:text-white'
          }`}
        >
          Product Management
        </button>
        <button
          onClick={() => setActiveTab('algorithm')}
          className={`px-6 py-3 text-sm tracking-wide transition-all ${
            activeTab === 'algorithm'
              ? 'bg-[#d4af37] text-black'
              : 'border border-[#2a2a2a] text-[#808080] hover:border-[#d4af37]/30 hover:text-white'
          }`}
        >
          Recommendation Algorithm
        </button>
      </div>

      {/* Product Management Tab */}
      {activeTab === 'products' && (
        <div className="bg-[#0f0f0f] border border-[#2a2a2a]">
          {/* Toolbar */}
          <div className="p-6 border-b border-[#2a2a2a] flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-[#666666] focus:border-[#d4af37] focus:outline-none text-sm"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#d4af37] text-black font-medium hover:bg-[#f4d03f] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Product
            </button>
          </div>

          {/* Product Table */}
          {isLoadingProducts ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[#808080] mt-4">Loading products...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a2a2a] bg-[#1a1a1a]">
                    <th className="text-left py-4 px-6 text-[#808080] text-xs font-medium uppercase tracking-wider">Product</th>
                    <th className="text-left py-4 px-6 text-[#808080] text-xs font-medium uppercase tracking-wider">Brand</th>
                    <th className="text-left py-4 px-6 text-[#808080] text-xs font-medium uppercase tracking-wider">Category</th>
                    <th className="text-right py-4 px-6 text-[#808080] text-xs font-medium uppercase tracking-wider">Price</th>
                    <th className="text-center py-4 px-6 text-[#808080] text-xs font-medium uppercase tracking-wider">Stock</th>
                    <th className="text-center py-4 px-6 text-[#808080] text-xs font-medium uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50 transition-colors">
                      <td className="py-4 px-6">
                        <p className="text-white font-medium">{product.name}</p>
                        <p className="text-[#666666] text-xs">{product.id}</p>
                      </td>
                      <td className="py-4 px-6 text-[#c0c0c0]">{product.brand}</td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-1 bg-[#2a2a2a] text-[#c0c0c0] text-xs capitalize">{product.category}</span>
                      </td>
                      <td className="py-4 px-6 text-right text-[#d4af37] font-medium">${product.price.toLocaleString()}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleStockUpdate(product, -1)} className="w-7 h-7 flex items-center justify-center border border-[#2a2a2a] text-[#808080] hover:border-[#d4af37] hover:text-[#d4af37] transition-colors text-sm">-</button>
                          <span className={`w-10 text-center font-medium ${product.stock < 3 ? 'text-red-400' : 'text-white'}`}>{product.stock}</span>
                          <button onClick={() => handleStockUpdate(product, 1)} className="w-7 h-7 flex items-center justify-center border border-[#2a2a2a] text-[#808080] hover:border-[#d4af37] hover:text-[#d4af37] transition-colors text-sm">+</button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEditModal(product)} className="p-2 text-[#808080] hover:text-[#d4af37] transition-colors" title="Edit">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDelete(product)} className="p-2 text-[#808080] hover:text-red-400 transition-colors" title="Delete">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <div className="p-12 text-center text-[#808080]">No products found</div>
              )}
            </div>
          )}
          <div className="p-4 border-t border-[#2a2a2a] text-[#666666] text-sm">
            {filteredProducts.length} of {products.length} products
          </div>
        </div>
      )}

      {/* Algorithm Tab */}
      {activeTab === 'algorithm' && (
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] p-8">
          <p className="text-[#808080] text-sm mb-8 max-w-2xl">
            Fine-tune the recommendation algorithm by adjusting the balance between collaborative filtering
            (based on similar users) and content-based filtering (based on product attributes).
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Collaborative Weight */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-white font-medium mb-1">Collaborative Filtering</h3>
                  <p className="text-[#666666] text-xs">Similar users' purchase patterns</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-light text-[#d4af37]">{(weights.collaborative * 100).toFixed(0)}</span>
                  <span className="text-[#d4af37] text-sm">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.collaborative}
                onChange={(e) => handleCollaborativeChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer accent-[#d4af37]"
              />
            </div>

            {/* Content Weight */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-white font-medium mb-1">Content-Based</h3>
                  <p className="text-[#666666] text-xs">Product attributes & preferences</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-light text-[#c0c0c0]">{(weights.content * 100).toFixed(0)}</span>
                  <span className="text-[#c0c0c0] text-sm">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.content}
                onChange={(e) => {
                  const newContent = Math.round(parseFloat(e.target.value) * 100) / 100;
                  setWeights({ collaborative: Math.round((1 - newContent) * 100) / 100, content: newContent });
                  setHasChanges(true);
                }}
                className="w-full h-1 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer accent-[#c0c0c0]"
              />
            </div>
          </div>

          {/* Visual Balance */}
          <div className="mt-8 p-6 bg-[#1a1a1a] border border-[#2a2a2a]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#808080] tracking-wide uppercase">Weight Distribution</span>
              <span className="text-xs text-[#666666]">{weights.collaborative.toFixed(2)} + {weights.content.toFixed(2)} = 1.00</span>
            </div>
            <div className="h-2 bg-[#0a0a0a] overflow-hidden flex">
              <div className="bg-gradient-to-r from-[#d4af37] to-[#b8960c] transition-all duration-300" style={{ width: `${weights.collaborative * 100}%` }} />
              <div className="bg-gradient-to-r from-[#808080] to-[#c0c0c0] transition-all duration-300" style={{ width: `${weights.content * 100}%` }} />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={handleSaveWeights}
              disabled={isSaving || !hasChanges}
              className={`flex-1 py-3 px-6 text-sm tracking-wide uppercase transition-all duration-300 ${
                hasChanges && !isSaving ? 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e5c349]' : 'bg-[#2a2a2a] text-[#666666] cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              onClick={() => { setWeights({ collaborative: 0.5, content: 0.5 }); setHasChanges(true); }}
              className="py-3 px-6 text-sm tracking-wide uppercase border border-[#2a2a2a] text-[#808080] hover:border-[#d4af37]/30 hover:text-white transition-all"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-[#111111] border border-[#2a2a2a] w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#2a2a2a]">
              <h2 className="text-xl font-display text-white">Create New Product</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-[#808080] text-sm mb-2">Product ID (optional)</label>
                <input type="text" value={formData.id} onChange={(e) => setFormData({ ...formData, id: e.target.value })} placeholder="prod_xxx (auto-generated if empty)" className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-[#666666] focus:border-[#d4af37] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[#808080] text-sm mb-2">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:border-[#d4af37] focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#808080] text-sm mb-2">Brand *</label>
                  <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} required className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:border-[#d4af37] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[#808080] text-sm mb-2">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:border-[#d4af37] focus:outline-none">
                    <option value="">Select category</option>
                    <option value="luxury">Luxury</option>
                    <option value="sport">Sport</option>
                    <option value="dive">Dive</option>
                    <option value="dress">Dress</option>
                    <option value="pilot">Pilot</option>
                    <option value="chronograph">Chronograph</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#808080] text-sm mb-2">Price ($) *</label>
                  <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required min="0" step="0.01" className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:border-[#d4af37] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[#808080] text-sm mb-2">Stock *</label>
                  <input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} required min="0" className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:border-[#d4af37] focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 border border-[#2a2a2a] text-[#808080] hover:border-[#d4af37] hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-[#d4af37] text-black font-medium hover:bg-[#f4d03f] transition-all">Create Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-[#111111] border border-[#2a2a2a] w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#2a2a2a]">
              <h2 className="text-xl font-display text-white">Edit Product</h2>
              <p className="text-[#666666] text-sm mt-1">{editingProduct.id}</p>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-[#808080] text-sm mb-2">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:border-[#d4af37] focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#808080] text-sm mb-2">Brand *</label>
                  <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} required className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:border-[#d4af37] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[#808080] text-sm mb-2">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:border-[#d4af37] focus:outline-none">
                    <option value="">Select category</option>
                    <option value="luxury">Luxury</option>
                    <option value="sport">Sport</option>
                    <option value="dive">Dive</option>
                    <option value="dress">Dress</option>
                    <option value="pilot">Pilot</option>
                    <option value="chronograph">Chronograph</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#808080] text-sm mb-2">Price ($) *</label>
                  <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required min="0" step="0.01" className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:border-[#d4af37] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[#808080] text-sm mb-2">Stock *</label>
                  <input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} required min="0" className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:border-[#d4af37] focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 border border-[#2a2a2a] text-[#808080] hover:border-[#d4af37] hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-[#d4af37] text-black font-medium hover:bg-[#f4d03f] transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
