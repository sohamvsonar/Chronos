'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { api, WishlistItem } from '@/lib/api';

export default function WishlistPage() {
  const { user } = useUser();
  const { showToast } = useToast();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWishlist() {
      if (!user || user.id === 'guest' || user.id === 'admin') {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getWishlist(user.id);
        setItems(data.items || []);
      } catch (err) {
        console.error('Failed to fetch wishlist:', err);
        setError('Failed to load wishlist');
      } finally {
        setIsLoading(false);
      }
    }

    fetchWishlist();
  }, [user]);

  const handleRemove = async (productId: string) => {
    if (!user) return;
    try {
      await api.removeFromWishlist(user.id, productId);
      setItems(prev => prev.filter(item => item.productId !== productId));
      showToast('Removed from wishlist', 'success');
    } catch (err: any) {
      console.error('Failed to remove from wishlist:', err);
      showToast(err.message || 'Failed to remove item', 'error');
    }
  };

  if (!user || user.id === 'guest') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-16">
          <div className="text-6xl mb-6">dY"'</div>
          <h1 className="text-2xl font-bold text-[#e5e5e5] mb-4">Sign In Required</h1>
          <p className="text-[#808080] mb-8">Please select a user from the navbar to view your wishlist.</p>
          <Link
            href="/"
            className="inline-flex items-center text-[#d4af37] hover:text-[#f4d03f] transition-colors"
          >
            ƒ+? Back to Collection
          </Link>
        </div>
      </div>
    );
  }

  if (user.id === 'admin') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-16">
          <div className="text-6xl mb-6">ƒsT‹,?</div>
          <h1 className="text-2xl font-bold text-[#e5e5e5] mb-4">Admin Account</h1>
          <p className="text-[#808080] mb-8">Admin accounts don't have a wishlist. Switch to a customer account to view saved items.</p>
          <Link
            href="/"
            className="inline-flex items-center text-[#d4af37] hover:text-[#f4d03f] transition-colors"
          >
            ƒ+? Back to Collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-[#c0c0c0] hover:text-[#d4af37] transition-colors mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Collection
          </Link>
          <h1 className="text-3xl font-bold text-[#e5e5e5]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Wishlist
          </h1>
          <p className="text-[#808080] mt-1">Saved pieces for {user.name}</p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2d2d2d] animate-pulse">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-[#2d2d2d] rounded-lg" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-[#2d2d2d] rounded w-1/2"></div>
                  <div className="h-4 bg-[#2d2d2d] rounded w-1/3"></div>
                  <div className="h-4 bg-[#2d2d2d] rounded w-1/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && items.length === 0 && (
        <div className="text-center py-16 bg-[#1a1a1a] rounded-lg border border-[#2d2d2d]">
          <div className="text-6xl mb-6">dY"İ</div>
          <h2 className="text-xl font-semibold text-[#e5e5e5] mb-2">No items saved</h2>
          <p className="text-[#808080] mb-6">Tap the heart on any product to save it here.</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-[#0a0a0a] font-semibold rounded-lg hover:shadow-lg hover:shadow-[#d4af37]/20 transition-all"
          >
            Browse Collection
          </Link>
        </div>
      )}

      {/* List */}
      {!isLoading && !error && items.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="bg-[#1a1a1a] rounded-lg border border-[#2d2d2d] overflow-hidden hover:border-[#d4af37]/30 transition-colors"
            >
              <div className="flex gap-4 p-6">
                <div className="w-24 h-24 bg-[#2d2d2d] rounded-lg flex items-center justify-center text-3xl shrink-0">
                  ƒOs
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/products/${item.productId}`}
                        className="block text-lg font-semibold text-[#e5e5e5] hover:text-[#d4af37] transition-colors truncate"
                      >
                        {item.name}
                      </Link>
                      <p className="text-sm text-[#808080]">{item.brand} • {item.category}</p>
                      <p className="text-sm text-[#666666] mt-1">
                        Added {new Date(item.addedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-[#d4af37]">${item.price.toLocaleString()}</p>
                      <p className="text-xs text-[#808080]">{item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Link
                      href={`/products/${item.productId}`}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-[#2d2d2d] rounded-lg text-sm text-[#e5e5e5] hover:border-[#d4af37]/40 transition-colors"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => handleRemove(item.productId)}
                      className="px-4 py-2 rounded-lg text-sm bg-[#2a1a1a] text-red-300 border border-red-800/40 hover:bg-red-900/20 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
