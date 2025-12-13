const API_BASE_URL = 'http://localhost:3000';

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('chronos_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  stock: number;
  category: string;
  metadata?: {
    description?: string;
    image?: string;
    features?: string[];
  };
}

export interface Recommendation {
  productId: string;
  score: number;
  source: 'collaborative' | 'content' | 'hybrid';
}

export interface RecommendationResponse {
  success: boolean;
  userId: string;
  recommendations: Array<{
    productId: string;
    score: number;
    source: string;
    product: Product;
  }>;
  count: number;
  weights: {
    collaborative: number;
    content: number;
  };
  coldStart: boolean;
}

export interface CheckoutRequest {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface CheckoutResponse {
  success: boolean;
  message: string;
  orderId: number;
  orderNumber: string;
  status: string;
  subtotal?: number;
  discountRate?: number;
  discountAmount?: number;
  totalAmount: number;
  rewardPointsEarned?: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
  }>;
  jobId: string;
}

export interface WeightsResponse {
  success: boolean;
  weights: {
    collaborative: number;
    content: number;
  };
}

export interface UpdateWeightsRequest {
  collaborative: number;
  content: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: string;
  total_amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface OrdersResponse {
  success: boolean;
  userId: string;
  orders: Order[];
  count: number;
}

export interface WishlistItem {
  productId: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  metadata?: Record<string, any>;
  addedAt: string;
}

export interface WishlistResponse {
  success: boolean;
  customer_id: string;
  count: number;
  items: WishlistItem[];
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  tier: string;
  phone?: string;
  address?: Record<string, any>;
  reward_points?: number;
  total_spent?: number;
  vip_tier?: string;
}

export interface CustomerResponse {
  success: boolean;
  data: Customer;
}

export const api = {
  async getToken(userId: string, email: string): Promise<string> {
    console.log('dYO? API: POST /auth/token', { userId, email });
    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, email }),
    });

    console.log('dY"­ API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to get authentication token');
    }

    const data = await response.json();
    console.log('dY"ť API: Token received');
    return data.token;
  },

  async getProducts(limit: number = 1000): Promise<Product[]> {
    console.log('dYO? API: GET /products');
    console.log('dY" API: Headers:', getAuthHeaders());
    const response = await fetch(`${API_BASE_URL}/products?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    console.log('dY"­ API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    const data = await response.json();
    console.log('dY"ť API: Products data:', data);
    return data.data || [];
  },

  async getProduct(id: string): Promise<Product> {
    console.log('dYO? API: GET /products/:id', { id });
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      headers: getAuthHeaders(),
    });
    console.log('dY"­ API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to fetch product');
    }
    const data = await response.json();
    console.log('dY"ť API: Product data:', data);
    return data.data;
  },

  async getRecommendations(userId: string): Promise<RecommendationResponse> {
    console.log('dYO? API: GET /recommendations/:userId', { userId });
    console.log('dY" API: Headers:', getAuthHeaders());
    const response = await fetch(`${API_BASE_URL}/recommendations/${userId}`, {
      headers: getAuthHeaders(),
    });
    console.log('dY"­ API: Response status:', response.status);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found');
      }
      throw new Error('Failed to fetch recommendations');
    }
    const rawData = await response.json();
    console.log('dY"ť API: Raw recommendations data:', rawData);

    const data: RecommendationResponse = {
      success: rawData.success,
      userId: rawData.user_id || userId,
      recommendations: (rawData.recommendations || []).map((rec: any) => {
        const hybridScore = rec.scores?.hybrid || rec.score || rec.hybrid_score || 1.0;
        console.log(`dY"S Product ${rec.name}: content=${rec.scores?.content}, collab=${rec.scores?.collaborative}, hybrid=${hybridScore}`);
        return {
          productId: rec.id,
          score: hybridScore,
          source: rec.source || rawData.strategy || 'hybrid',
          product: {
            id: rec.id,
            name: rec.name,
            brand: rec.brand,
            price: parseFloat(rec.price) || rec.price,
            stock: rec.stock,
            category: rec.category,
            metadata: rec.metadata
          }
        };
      }),
      count: rawData.count || rawData.recommendations?.length || 0,
      weights: rawData.weights || { collaborative: 0.5, content: 0.5 },
      coldStart: rawData.strategy === 'cold-start'
    };

    console.log('dY"ť API: Transformed recommendations:', data);
    return data;
  },

  async checkout(data: CheckoutRequest): Promise<CheckoutResponse> {
    console.log('dYO? API: POST /checkout', data);
    const response = await fetch(`${API_BASE_URL}/checkout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    console.log('dY"­ API: Response status:', response.status);

    const responseData = await response.json();
    console.log('dY"ť API: Checkout response:', responseData);

    if (!response.ok) {
      throw new Error(responseData.error || 'Checkout failed');
    }

    return responseData;
  },

  async getWeights(): Promise<WeightsResponse> {
    console.log('dYO? API: GET /recommendations/admin/weights');
    const response = await fetch(`${API_BASE_URL}/recommendations/admin/weights`, {
      headers: getAuthHeaders(),
    });
    console.log('dY"­ API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to fetch weights');
    }

    const data = await response.json();
    console.log('dY"ť API: Weights data:', data);
    return data;
  },

  async updateWeights(weights: UpdateWeightsRequest): Promise<WeightsResponse> {
    console.log('dYO? API: POST /recommendations/admin/weights', weights);
    const response = await fetch(`${API_BASE_URL}/recommendations/admin/weights`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(weights),
    });
    console.log('dY"­ API: Response status:', response.status);

    const data = await response.json();
    console.log('dY"ť API: Update weights response:', data);

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update weights');
    }

    return data;
  },

  async getOrders(userId: string): Promise<OrdersResponse> {
    console.log('dYO? API: GET /orders/:userId', { userId });
    const response = await fetch(`${API_BASE_URL}/orders/${userId}`, {
      headers: getAuthHeaders(),
    });
    console.log('dY"­ API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }

    const data = await response.json();
    console.log('dY"ť API: Orders data:', data);
    return data;
  },

  async getCustomer(userId: string): Promise<Customer> {
    console.log('dYO? API: GET /customers/:id', { userId });
    const response = await fetch(`${API_BASE_URL}/customers/${userId}`, {
      headers: getAuthHeaders(),
    });
    console.log('dY"­ API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to fetch customer');
    }

    const data = await response.json();
    console.log('dY"ť API: Customer data:', data);
    return data.data;
  },

  async getWishlist(userId: string): Promise<WishlistResponse> {
    console.log('dYO? API: GET /customers/:id/wishlist', { userId });
    const response = await fetch(`${API_BASE_URL}/customers/${userId}/wishlist`, {
      headers: getAuthHeaders(),
    });
    console.log('dY"­ API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to fetch wishlist');
    }

    const data = await response.json();
    console.log('dY"ť API: Wishlist data:', data);

    return {
      success: data.success,
      customer_id: data.customer_id || userId,
      count: data.count || (data.items?.length ?? 0),
      items: (data.items || []).map((item: any) => ({
        productId: item.productId || item.product_id,
        name: item.name,
        brand: item.brand,
        category: item.category,
        price: parseFloat(item.price) || item.price,
        stock: item.stock,
        metadata: item.metadata,
        addedAt: item.addedAt || item.created_at || item.createdAt
      }))
    };
  },

  async addToWishlist(userId: string, productId: string): Promise<WishlistItem> {
    console.log('dYO? API: POST /customers/:id/wishlist', { userId, productId });
    const response = await fetch(`${API_BASE_URL}/customers/${userId}/wishlist`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ productId }),
    });
    console.log('dY"­ API: Response status:', response.status);

    const data = await response.json();
    console.log('dY"ť API: Add wishlist response:', data);

    if (!response.ok) {
      throw new Error(data.error || 'Failed to add to wishlist');
    }

    const item = data.item || {};
    return {
      productId: item.productId || productId,
      name: item.name,
      brand: item.brand,
      category: item.category,
      price: parseFloat(item.price) || item.price,
      stock: item.stock,
      metadata: item.metadata,
      addedAt: item.addedAt || item.created_at || new Date().toISOString(),
    };
  },

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    console.log('dYO? API: DELETE /customers/:id/wishlist/:productId', { userId, productId });
    const response = await fetch(`${API_BASE_URL}/customers/${userId}/wishlist/${productId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    console.log('dY"­ API: Response status:', response.status);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to remove from wishlist');
    }
  },
};
