'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { api, Product, RecommendationResponse } from '@/lib/api';
import AdminPanel from '@/components/AdminPanel';

export default function HomePage() {
  const { user, isAdmin } = useUser();
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Get unique brands and categories from products
  const brands = [...new Set(products.map(p => p.brand))].sort();
  const categories = [...new Set(products.map(p => p.category))].sort();

  // Filter products based on selected filters
  const filteredProducts = products.filter(product => {
    if (selectedBrand && product.brand !== selectedBrand) return false;
    if (selectedCategory && product.category !== selectedCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !product.name.toLowerCase().includes(term) &&
        !product.brand.toLowerCase().includes(term) &&
        !product.id.toLowerCase().includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  useEffect(() => {
    async function fetchRecommendations() {
      if (!user) return;

      if (user.id === 'admin') {
        setIsLoadingRecs(false);
        setRecommendations(null);
        return;
      }

      setIsLoadingRecs(true);
      try {
        const data = await api.getRecommendations(user.id);
        setRecommendations(data);
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      } finally {
        setIsLoadingRecs(false);
      }
    }

    fetchRecommendations();
  }, [user]);

  useEffect(() => {
    async function fetchProducts() {
      setIsLoadingProducts(true);
      try {
        const data = await api.getProducts();
        setProducts(data);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setIsLoadingProducts(false);
      }
    }

    fetchProducts();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, #d4af37 1px, transparent 1px),
                             radial-gradient(circle at 75% 75%, #d4af37 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="text-center">
            {/* Logo/Brand */}
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-[#d4af37]/30 mb-4">
                <svg className="w-6 h-6 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                  <path strokeLinecap="round" strokeWidth="1.5" d="M12 6v6l4 2" />
                </svg>
              </div>
            </div>

            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-white mb-4">
              <span className="text-[#d4af37]">CHRONOS</span>
            </h1>

            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mx-auto mb-8" />

            <p className="font-sans text-lg md:text-xl text-[#a0a0a0] max-w-2xl mx-auto mb-4 tracking-wide">
              Purveyors of Exceptional Timepieces
            </p>

            <p className="font-sans text-sm text-[#666666] tracking-widest uppercase">
              Curated for {user?.name || 'the Discerning Collector'}
            </p>
          </div>
        </div>

        {/* Decorative bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent" />
      </section>

      {/* Admin Panel */}
      {isAdmin && (
        <section className="py-12 bg-[#111111] border-y border-[#d4af37]/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AdminPanel />
          </div>
        </section>
      )}

      {/* Recommendations Section */}
      {!isAdmin && (
        <section className="py-20 bg-[#0a0a0a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <p className="text-[#d4af37] text-sm tracking-[0.3em] uppercase mb-4">
                {recommendations?.coldStart ? 'Most Coveted' : 'Selected For You'}
              </p>
              <h2 className="font-display text-4xl md:text-5xl text-white mb-4">
                {recommendations?.coldStart ? 'Trending Timepieces' : 'Your Personal Collection'}
              </h2>
              <div className="w-16 h-px bg-[#d4af37] mx-auto mb-6" />
              <p className="text-[#808080] max-w-xl mx-auto">
                {recommendations?.coldStart
                  ? 'The most sought-after pieces from our distinguished collection'
                  : 'Meticulously selected based on your refined taste'}
              </p>
            </div>

            {isLoadingRecs ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[...Array(4)].map((_, i) => (
                  <LoadingCard key={i} />
                ))}
              </div>
            ) : recommendations && recommendations.recommendations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {recommendations.recommendations
                  .filter(rec => rec.product && rec.product.id)
                  .map((rec, index) => (
                    <ProductCard key={`rec-${rec.productId}-${index}`} product={rec.product} score={rec.score} />
                  ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-[#666666]">No recommendations available at this time</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Divider */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-[#333333] to-transparent" />
      </div>

      {/* Full Catalog Section */}
      <section className="py-20 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[#d4af37] text-sm tracking-[0.3em] uppercase mb-4">
              The Collection
            </p>
            <h2 className="font-display text-4xl md:text-5xl text-white mb-4">
              Complete Catalogue
            </h2>
            <div className="w-16 h-px bg-[#d4af37] mx-auto mb-6" />
            <p className="text-[#808080]">
              {filteredProducts.length} of {products.length} exceptional timepieces
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            {/* Search */}
            <div className="w-full md:w-auto">
              <div className="flex items-center gap-3 px-4 py-2.5 border border-[#2a2a2a] bg-[#0f0f0f] text-[#e5e5e5] focus-within:border-[#d4af37]/60 transition-all">
                <svg className="w-4 h-4 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, brand, or ID"
                  className="bg-transparent focus:outline-none text-sm w-full placeholder:text-[#555555]"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-[#666666] hover:text-[#d4af37] transition-colors"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Brand Filter */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsBrandDropdownOpen(!isBrandDropdownOpen);
                  setIsCategoryDropdownOpen(false);
                }}
                className={`flex items-center gap-2 px-5 py-2.5 border transition-all duration-300 ${
                  selectedBrand
                    ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]'
                    : 'border-[#2a2a2a] hover:border-[#d4af37]/30 text-[#808080] hover:text-white'
                }`}
              >
                <span className="text-sm tracking-wide">
                  {selectedBrand || 'All Brands'}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform duration-300 ${isBrandDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isBrandDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBrandDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-56 bg-[#111111] border border-[#2a2a2a] shadow-2xl z-50 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedBrand(null);
                        setIsBrandDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                        !selectedBrand ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-[#808080] hover:bg-[#1a1a1a] hover:text-white'
                      }`}
                    >
                      All Brands
                    </button>
                    {brands.map((brand) => (
                      <button
                        key={brand}
                        onClick={() => {
                          setSelectedBrand(brand);
                          setIsBrandDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                          selectedBrand === brand ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-[#808080] hover:bg-[#1a1a1a] hover:text-white'
                        }`}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Category Filter */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                  setIsBrandDropdownOpen(false);
                }}
                className={`flex items-center gap-2 px-5 py-2.5 border transition-all duration-300 ${
                  selectedCategory
                    ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]'
                    : 'border-[#2a2a2a] hover:border-[#d4af37]/30 text-[#808080] hover:text-white'
                }`}
              >
                <span className="text-sm tracking-wide capitalize">
                  {selectedCategory || 'All Categories'}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform duration-300 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isCategoryDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsCategoryDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-56 bg-[#111111] border border-[#2a2a2a] shadow-2xl z-50 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedCategory(null);
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                        !selectedCategory ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-[#808080] hover:bg-[#1a1a1a] hover:text-white'
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => {
                          setSelectedCategory(category);
                          setIsCategoryDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm capitalize transition-colors ${
                          selectedCategory === category ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-[#808080] hover:bg-[#1a1a1a] hover:text-white'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Clear Filters */}
            {(selectedBrand || selectedCategory) && (
              <button
                onClick={() => {
                  setSelectedBrand(null);
                  setSelectedCategory(null);
                }}
                className="flex items-center gap-2 px-5 py-2.5 text-[#808080] hover:text-[#d4af37] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-sm">Clear Filters</span>
              </button>
            )}
          </div>

          {isLoadingProducts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[...Array(8)].map((_, i) => (
                <LoadingCard key={i} />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredProducts
                .filter(product => product && product.id)
                .map((product, index) => (
                  <ProductCard key={`product-${product.id}-${index}`} product={product} />
                ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-[#2a2a2a] mb-6">
                <svg className="w-8 h-8 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-[#808080] mb-4">No timepieces match your selected filters</p>
              <button
                onClick={() => {
                  setSelectedBrand(null);
                  setSelectedCategory(null);
                }}
                className="text-[#d4af37] hover:text-[#f4d03f] text-sm transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* About Chronos */}
      <section className="py-16 bg-[#0f0f0f] border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <p className="text-[#d4af37] text-sm tracking-[0.3em] uppercase">About Chronos</p>
          <h3 className="font-display text-3xl md:text-4xl text-white">Heritage in Every Second</h3>
          <p className="text-[#a0a0a0] leading-relaxed">
            Chronos curates precision timepieces for collectors who value craftsmanship, rarity, and enduring design.
            From modern complications to heritage-inspired icons, our team sources, inspects, and delivers watches that
            marry innovation with legacy. Every piece is handpicked, authenticated, and supported by concierge-level service.
          </p>
          <p className="text-[#808080] text-sm">
            Founded in 2024, we remain independent, expert-led, and obsessed with elevating your collection.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg className="w-6 h-6 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
              <path strokeLinecap="round" strokeWidth="1.5" d="M12 6v6l4 2" />
            </svg>
            <span className="font-display text-xl text-white">CHRONOS</span>
          </div>
          <p className="text-[#666666] text-sm">
            Excellence in Horology Since 2024
          </p>
        </div>
      </footer>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="bg-[#111111] rounded-sm overflow-hidden border border-[#1a1a1a]">
      <div className="aspect-square bg-[#1a1a1a] relative overflow-hidden">
        <div className="absolute inset-0 animate-shimmer" />
      </div>
      <div className="p-6">
        <div className="h-4 bg-[#1a1a1a] rounded mb-3 w-3/4" />
        <div className="h-3 bg-[#1a1a1a] rounded mb-4 w-1/2" />
        <div className="h-5 bg-[#1a1a1a] rounded w-1/3" />
      </div>
    </div>
  );
}

function ProductCard({ product, score }: { product: Product; score?: number }) {
  if (!product || !product.id) {
    return null;
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sport':
        return '◈';
      case 'dress':
        return '◇';
      case 'luxury':
        return '❖';
      default:
        return '○';
    }
  };

  return (
    <Link href={`/products/${product.id}`}>
      <div className="group bg-[#111111] rounded-sm overflow-hidden border border-[#1a1a1a] hover:border-[#d4af37]/30 transition-all duration-500 cursor-pointer">
        {/* Watch Display Area */}
        <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-[#1a1a1a] via-[#151515] to-[#0f0f0f]">
          {/* Decorative ring pattern */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Outer ring */}
              <div className="w-32 h-32 rounded-full border border-[#2a2a2a] group-hover:border-[#d4af37]/20 transition-colors duration-500" />
              {/* Middle ring */}
              <div className="absolute inset-2 rounded-full border border-[#252525] group-hover:border-[#d4af37]/15 transition-colors duration-500" />
              {/* Inner ring */}
              <div className="absolute inset-4 rounded-full border border-[#202020] group-hover:border-[#d4af37]/10 transition-colors duration-500" />
              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl text-[#d4af37]/80 group-hover:text-[#d4af37] group-hover:scale-110 transition-all duration-500">
                  {getCategoryIcon(product.category)}
                </span>
              </div>
            </div>
          </div>

          {/* Subtle shine effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

          {/* Score Badge */}
          {score !== undefined && (
            <div className="absolute top-4 right-4 bg-[#d4af37] text-[#0a0a0a] px-3 py-1 text-xs font-medium tracking-wide">
              Exclusive
            </div>
          )}

          {/* Stock Status */}
          {product.stock < 3 && product.stock > 0 && (
            <div className="absolute top-4 left-4 bg-[#b8860b]/90 text-white px-3 py-1 text-xs tracking-wide">
              Limited
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute top-4 left-4 bg-[#8b0000]/90 text-white px-3 py-1 text-xs tracking-wide">
              Sold Out
            </div>
          )}

          {/* Category indicator */}
          <div className="absolute bottom-4 left-4">
            <span className="text-[10px] text-[#666666] tracking-[0.2em] uppercase">
              {product.category}
            </span>
          </div>
        </div>

        {/* Product Info */}
        <div className="p-6 border-t border-[#1a1a1a]">
          <p className="text-[#d4af37] text-xs tracking-[0.15em] uppercase mb-2">
            {product.brand}
          </p>
          <h3 className="font-display text-lg text-white mb-4 group-hover:text-[#d4af37] transition-colors duration-300 leading-tight">
            {product.name}
          </h3>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[#666666] text-xs mb-1">Starting at</p>
              <p className="text-white text-xl font-light tracking-wide">
                ${product.price.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[#666666] text-xs">
                {product.stock > 0 ? `${product.stock} available` : 'Waitlist'}
              </p>
            </div>
          </div>
        </div>

        {/* Hover indicator bar */}
        <div className="h-0.5 bg-[#d4af37] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
      </div>
    </Link>
  );
}
