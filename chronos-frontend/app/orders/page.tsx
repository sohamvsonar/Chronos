'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { api, Order, Customer } from '@/lib/api';

export default function OrdersPage() {
  const { user } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<Customer | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      if (!user || user.id === 'guest' || user.id === 'admin') {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getOrders(user.id);
        setOrders(data.orders || []);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
        setError('Failed to load orders');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrders();
  }, [user]);

  useEffect(() => {
    async function fetchCustomer() {
      if (!user || user.id === 'guest' || user.id === 'admin') {
        setCustomerInfo(null);
        return;
      }
      try {
        const data = await api.getCustomer(user.id);
        setCustomerInfo(data);
      } catch (err) {
        console.error('Failed to fetch customer info:', err);
      }
    }

    fetchCustomer();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-900/30 text-green-400 border-green-800';
      case 'processing':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-800';
      case 'pending':
        return 'bg-orange-900/30 text-orange-400 border-orange-800';
      case 'cancelled':
        return 'bg-red-900/30 text-red-400 border-red-800';
      default:
        return 'bg-[#2d2d2d] text-[#c0c0c0] border-[#3d3d3d]';
    }
  };

  if (!user || user.id === 'guest') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-16">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-2xl font-bold text-[#e5e5e5] mb-4">Sign In Required</h1>
          <p className="text-[#808080] mb-8">Please select a user from the navbar to view your orders.</p>
          <Link
            href="/"
            className="inline-flex items-center text-[#d4af37] hover:text-[#f4d03f] transition-colors"
          >
            ← Back to Collection
          </Link>
        </div>
      </div>
    );
  }

  if (user.id === 'admin') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-16">
          <div className="text-6xl mb-6">⚙️</div>
          <h1 className="text-2xl font-bold text-[#e5e5e5] mb-4">Admin Account</h1>
          <p className="text-[#808080] mb-8">Admin accounts don't have personal orders. Switch to a customer account to view orders.</p>
          <Link
            href="/"
            className="inline-flex items-center text-[#d4af37] hover:text-[#f4d03f] transition-colors"
          >
            ← Back to Collection
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
            Your Orders
          </h1>
          <p className="text-[#808080] mt-1">Order history for {user.name}</p>
        </div>
        {customerInfo && (
          <div className="text-right bg-[#111111] border border-[#2d2d2d] rounded-lg px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[#666666]">Loyalty</p>
            <p className="text-sm text-[#e5e5e5] font-semibold">Tier: {customerInfo.tier || '—'}</p>
            <p className="text-xs text-[#c0c0c0]">Reward Points: {customerInfo.reward_points ?? 0}</p>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2d2d2d] animate-pulse">
              <div className="flex justify-between mb-4">
                <div className="h-6 bg-[#2d2d2d] rounded w-1/4"></div>
                <div className="h-6 bg-[#2d2d2d] rounded w-20"></div>
              </div>
              <div className="h-4 bg-[#2d2d2d] rounded w-1/3 mb-4"></div>
              <div className="h-16 bg-[#2d2d2d] rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && orders.length === 0 && (
        <div className="text-center py-16 bg-[#1a1a1a] rounded-lg border border-[#2d2d2d]">
          <div className="text-6xl mb-6">📦</div>
          <h2 className="text-xl font-semibold text-[#e5e5e5] mb-2">No Orders Yet</h2>
          <p className="text-[#808080] mb-6">You haven't made any purchases yet. Start shopping to see your orders here!</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-[#0a0a0a] font-semibold rounded-lg hover:shadow-lg hover:shadow-[#d4af37]/20 transition-all"
          >
            Browse Collection
          </Link>
        </div>
      )}

      {/* Orders List */}
      {!isLoading && !error && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-[#1a1a1a] rounded-lg border border-[#2d2d2d] overflow-hidden hover:border-[#d4af37]/30 transition-colors"
            >
              {/* Order Header */}
              <div className="px-6 py-4 border-b border-[#2d2d2d] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-[#e5e5e5]">
                      {order.order_number}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-[#808080] mt-1">
                    {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#d4af37]">
                    ${order.total_amount.toLocaleString()}
                  </p>
                  <p className="text-sm text-[#808080]">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div className="px-6 py-4">
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 border-b border-[#2d2d2d] last:border-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#2d2d2d] rounded-lg flex items-center justify-center text-2xl">
                          ⌚
                        </div>
                        <div>
                          <p className="text-[#e5e5e5] font-medium">{item.productName}</p>
                          <p className="text-sm text-[#808080]">
                            Qty: {item.quantity} × ${item.pricePerUnit.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <p className="text-[#c0c0c0] font-medium">
                        ${item.totalPrice.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
