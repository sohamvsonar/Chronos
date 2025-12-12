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

  console.log('🏠 HomePage render - User:', user);
  console.log('🏠 HomePage render - Recommendations:', recommendations);
  console.log('🏠 HomePage render - Products count:', products.length);
  console.log('🏠 HomePage render - Loading states:', { isLoadingRecs, isLoadingProducts });

  useEffect(() => {
    async function fetchRecommendations() {
      console.log('📊 fetchRecommendations called - User:', user);
      if (!user) {
        console.log('⚠️ No user, skipping recommendations fetch');
        return;
      }

      // Skip recommendations for admin user (not a real customer)
      if (user.id === 'admin') {
        console.log('👤 Admin user, skipping recommendations fetch');
        setIsLoadingRecs(false);
        setRecommendations(null);
        return;
      }

      setIsLoadingRecs(true);
      try {
        console.log('🔄 Fetching recommendations for userId:', user.id);
        const data = await api.getRecommendations(user.id);
        console.log('✅ Recommendations received:', data);
        console.log('📦 Recommendations count:', data?.recommendations?.length || 0);
        setRecommendations(data);
      } catch (error) {
        console.error('❌ Failed to fetch recommendations:', error);
      } finally {
        setIsLoadingRecs(false);
      }
    }

    fetchRecommendations();
  }, [user]);

  useEffect(() => {
    async function fetchProducts() {
      console.log('🛍️ fetchProducts called');
      setIsLoadingProducts(true);
      try {
        console.log('🔄 Fetching products...');
        const data = await api.getProducts();
        console.log('✅ Products received:', data);
        console.log('📦 Products count:', data?.length || 0);
        setProducts(data);
      } catch (error) {
        console.error('❌ Failed to fetch products:', error);
      } finally {
        setIsLoadingProducts(false);
      }
    }

    fetchProducts();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Welcome to CHRONOS
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8">
            Discover the world's finest luxury timepieces
          </p>
          <p className="text-lg text-gray-400">
            Curated exclusively for {user?.name || 'you'}
          </p>
        </div>
      </section>

      {/* Admin Panel - Only visible for admin users */}
      {isAdmin && (
        <section className="py-8 bg-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AdminPanel />
          </div>
        </section>
      )}

      {/* Recommendations Section - Hidden for admin */}
      {!isAdmin && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {recommendations?.coldStart ? '🔥 Trending Now' : '✨ Curated For You'}
              </h2>
              <p className="text-gray-600">
                {recommendations?.coldStart
                  ? 'Best-selling watches from our collection'
                  : 'Personalized recommendations based on your preferences'}
              </p>
              {/* Show current weights for debugging */}
              {recommendations?.weights && !recommendations.coldStart && (
                <p className="text-sm text-purple-600 mt-2">
                  Weights: Content {Math.round(recommendations.weights.content * 100)}% | Collaborative {Math.round(recommendations.weights.collaborative * 100)}%
                </p>
              )}
            </div>

            {isLoadingRecs ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 h-64 rounded-lg mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : recommendations && recommendations.recommendations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {recommendations.recommendations
                  .filter(rec => rec.product && rec.product.id)
                  .map((rec, index) => (
                    <ProductCard key={`rec-${rec.productId}-${index}`} product={rec.product} score={rec.score} />
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-10">
                No recommendations available
              </p>
            )}
          </div>
        </section>
      )}

      {/* Full Catalog Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Collection
            </h2>
            <p className="text-gray-600">
              Browse all {products.length} luxury timepieces
            </p>
          </div>

          {isLoadingProducts ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 h-64 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products
                .filter(product => product && product.id)
                .map((product, index) => (
                  <ProductCard key={`product-${product.id}-${index}`} product={product} />
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProductCard({ product, score }: { product: Product; score?: number }) {
  if (!product || !product.id) {
    return null;
  }

  return (
    <Link href={`/products/${product.id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden cursor-pointer group">
        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative overflow-hidden">
          <div className="text-6xl group-hover:scale-110 transition-transform duration-300">
            ⌚
          </div>
          {score !== undefined && (
            <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
              {Math.round(score * 100)}% match
            </div>
          )}
          {product.stock < 5 && product.stock > 0 && (
            <div className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
              Low Stock
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
              Out of Stock
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-purple-600 transition-colors">
            {product.name}
          </h3>
          <p className="text-sm text-gray-600 mb-2">{product.brand}</p>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-gray-900">
              ${product.price.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">
              {product.stock} in stock
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
