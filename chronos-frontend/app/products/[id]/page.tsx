'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { api, Product } from '@/lib/api';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { showToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      if (!params.id) return;

      setIsLoading(true);
      try {
        const data = await api.getProduct(params.id as string);
        setProduct(data);
      } catch (error) {
        console.error('Failed to fetch product:', error);
        showToast('Failed to load product', 'error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProduct();
  }, [params.id, showToast]);

  useEffect(() => {
    async function fetchWishlistStatus() {
      if (!product || !user || user.id === 'guest' || user.id === 'admin') {
        setIsInWishlist(false);
        return;
      }

      setIsWishlistLoading(true);
      try {
        const wishlist = await api.getWishlist(user.id);
        const exists = wishlist.items.some(item => item.productId === product.id);
        setIsInWishlist(exists);
      } catch (error) {
        console.error('Failed to fetch wishlist status:', error);
      } finally {
        setIsWishlistLoading(false);
      }
    }

    fetchWishlistStatus();
  }, [product?.id, user]);

  const handleBuyNow = async () => {
    if (!product || !user) return;

    if (user.id === 'guest') {
      showToast('Please select a user to make a purchase', 'error');
      return;
    }

    if (product.stock === 0) {
      showToast('This product is out of stock', 'error');
      return;
    }

    setIsPurchasing(true);
    try {
      const response = await api.checkout({
        userId: user.id,
        items: [
          {
            productId: product.id,
            quantity: 1,
          },
        ],
      });

      showToast(
        `Order Placed! ID: ${response.orderId} (${response.orderNumber})`,
        'success'
      );

      // Optimistically update stock immediately
      setProduct(prev => prev ? { ...prev, stock: prev.stock - 1 } : null);
    } catch (error: any) {
      if (error.message.includes('Insufficient stock')) {
        showToast('Sorry, this item is out of stock', 'error');
        // Refresh product data
        try {
          const updatedProduct = await api.getProduct(product.id);
          setProduct(updatedProduct);
        } catch (refreshError) {
          console.error('Failed to refresh product:', refreshError);
        }
      } else {
        showToast(error.message || 'Checkout failed. Please try again.', 'error');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleWishlistToggle = async () => {
    if (!product || !user) return;
    if (user.id === 'guest') {
      showToast('Please select a user to save items', 'error');
      return;
    }
    if (user.id === 'admin') {
      showToast('Admin cannot save wishlist items', 'error');
      return;
    }

    setIsWishlistLoading(true);
    try {
      if (isInWishlist) {
        await api.removeFromWishlist(user.id, product.id);
        setIsInWishlist(false);
        showToast('Removed from wishlist', 'success');
      } else {
        await api.addToWishlist(user.id, product.id);
        setIsInWishlist(true);
        showToast('Saved to wishlist', 'success');
      }
    } catch (error: any) {
      console.error('Wishlist toggle failed:', error);
      showToast(error.message || 'Unable to update wishlist', 'error');
    } finally {
      setIsWishlistLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-[#2d2d2d] rounded w-1/4 mb-8"></div>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-[#2d2d2d] h-96 rounded-lg"></div>
            <div>
              <div className="h-10 bg-[#2d2d2d] rounded mb-4"></div>
              <div className="h-6 bg-[#2d2d2d] rounded w-1/3 mb-8"></div>
              <div className="h-32 bg-[#2d2d2d] rounded mb-8"></div>
              <div className="h-12 bg-[#2d2d2d] rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h1 className="text-2xl font-bold text-[#e5e5e5] mb-4">Product not found</h1>
        <Link href="/" className="text-[#d4af37] hover:text-[#f4d03f]">
          Return to homepage
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link
        href="/"
        className="inline-flex items-center text-[#c0c0c0] hover:text-[#d4af37] transition-colors mb-8"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Collection
      </Link>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Product Image */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] rounded-lg aspect-square flex items-center justify-center">
          <div className="text-9xl">⌚</div>
        </div>

        {/* Product Details */}
        <div>
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-[#e5e5e5] mb-2">
              {product.name}
            </h1>
            <p className="text-xl text-[#c0c0c0]">{product.brand}</p>
          </div>

          <div className="mb-8">
            <div className="flex items-baseline gap-4 mb-4">
              <span className="text-4xl font-bold text-[#d4af37]">
                ${product.price.toLocaleString()}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  product.stock === 0
                    ? 'bg-red-900/30 text-red-400 border border-red-800'
                    : product.stock < 5
                    ? 'bg-orange-900/30 text-orange-400 border border-orange-800'
                    : 'bg-green-900/30 text-green-400 border border-green-800'
                }`}
              >
                {product.stock === 0
                  ? 'Out of Stock'
                  : `${product.stock} in stock`}
              </span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-semibold text-[#d4af37] mb-2">
              Details
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-[#c0c0c0]">Brand</dt>
                <dd className="text-base font-medium text-[#e5e5e5]">
                  {product.brand}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[#c0c0c0]">Category</dt>
                <dd className="text-base font-medium text-[#e5e5e5]">
                  {product.category}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[#c0c0c0]">Product ID</dt>
                <dd className="text-base font-medium text-[#e5e5e5]">
                  {product.id}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[#c0c0c0]">Availability</dt>
                <dd className="text-base font-medium text-[#e5e5e5]">
                  {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                </dd>
              </div>
            </dl>
          </div>

          {product.metadata?.description && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-[#d4af37] mb-2">
                Description
              </h2>
              <p className="text-[#c0c0c0]">{product.metadata.description}</p>
            </div>
          )}

          <div className="space-y-3">
            {user?.id !== 'admin' ? (
              <button
                onClick={handleBuyNow}
                disabled={isPurchasing || product.stock === 0 || user?.id === 'guest'}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-[#0a0a0a] text-lg transition-all ${
                  isPurchasing || product.stock === 0 || user?.id === 'guest'
                    ? 'bg-[#2d2d2d] text-[#606060] cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#d4af37] to-[#f4d03f] hover:shadow-lg hover:shadow-[#d4af37]/20 active:scale-95'
                }`}
              >
                {isPurchasing
                  ? 'Processing...'
                  : product.stock === 0
                  ? 'Out of Stock'
                  : user?.id === 'guest'
                  ? 'Select User to Purchase'
                  : 'Buy Now'}
              </button>
            ) : (
              <div className="w-full py-4 px-6 rounded-lg border border-[#2d2d2d] text-center text-sm text-[#c0c0c0]">
                Admin accounts cannot place orders.
              </div>
            )}

            <button
              onClick={handleWishlistToggle}
              disabled={isWishlistLoading || user?.id === 'guest' || user?.id === 'admin'}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-sm border transition-all ${
                isWishlistLoading || user?.id === 'guest' || user?.id === 'admin'
                  ? 'bg-[#1a1a1a] border-[#2d2d2d] text-[#606060] cursor-not-allowed'
                  : isInWishlist
                  ? 'bg-[#1a1a1a] border-[#d4af37]/40 text-[#d4af37] hover:border-[#d4af37]/60'
                  : 'bg-[#1a1a1a] border-[#2d2d2d] text-[#e5e5e5] hover:border-[#d4af37]/40'
              }`}
            >
              {isWishlistLoading
                ? 'Updating...'
                : isInWishlist
                ? 'Remove from Wishlist'
                : 'Save to Wishlist'}
            </button>
          </div>

          {user?.id === 'guest' && (
            <p className="text-sm text-[#c0c0c0] mt-4 text-center">
              Please select a user from the navbar to make a purchase
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
