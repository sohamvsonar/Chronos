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
  totalAmount: number;
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

export const api = {
  async getToken(userId: string, email: string): Promise<string> {
    console.log('🌐 API: POST /auth/token', { userId, email });
    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, email }),
    });

    console.log('📡 API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to get authentication token');
    }

    const data = await response.json();
    console.log('📥 API: Token received');
    return data.token;
  },

  async getProducts(): Promise<Product[]> {
    console.log('🌐 API: GET /products');
    console.log('📤 API: Headers:', getAuthHeaders());
    const response = await fetch(`${API_BASE_URL}/products`, {
      headers: getAuthHeaders(),
    });
    console.log('📡 API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    const data = await response.json();
    console.log('📥 API: Products data:', data);
    // Backend returns { success, data, pagination }, not { products }
    return data.data || [];
  },

  async getProduct(id: string): Promise<Product> {
    console.log('🌐 API: GET /products/:id', { id });
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      headers: getAuthHeaders(),
    });
    console.log('📡 API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to fetch product');
    }
    const data = await response.json();
    console.log('📥 API: Product data:', data);
    // Backend returns { success, data, cached }, not { product }
    return data.data;
  },

  async getRecommendations(userId: string): Promise<RecommendationResponse> {
    console.log('🌐 API: GET /recommendations/:userId', { userId });
    console.log('📤 API: Headers:', getAuthHeaders());
    const response = await fetch(`${API_BASE_URL}/recommendations/${userId}`, {
      headers: getAuthHeaders(),
    });
    console.log('📡 API: Response status:', response.status);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found');
      }
      throw new Error('Failed to fetch recommendations');
    }
    const rawData = await response.json();
    console.log('📥 API: Raw recommendations data:', rawData);

    // Transform backend response to match frontend TypeScript interface
    // Backend returns product fields at top level, we need them nested under 'product'
    const data: RecommendationResponse = {
      success: rawData.success,
      userId: rawData.user_id || userId,
      recommendations: (rawData.recommendations || []).map((rec: any) => ({
        productId: rec.id,
        score: rec.score || rec.hybrid_score || 1.0,
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
      })),
      count: rawData.count || rawData.recommendations?.length || 0,
      weights: rawData.weights || { collaborative: 0.5, content: 0.5 },
      coldStart: rawData.strategy === 'cold-start'
    };

    console.log('📥 API: Transformed recommendations:', data);
    return data;
  },

  async checkout(data: CheckoutRequest): Promise<CheckoutResponse> {
    console.log('🌐 API: POST /checkout', data);
    const response = await fetch(`${API_BASE_URL}/checkout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    console.log('📡 API: Response status:', response.status);

    const responseData = await response.json();
    console.log('📥 API: Checkout response:', responseData);

    if (!response.ok) {
      throw new Error(responseData.error || 'Checkout failed');
    }

    return responseData;
  },

  // Admin: Get current recommendation weights
  async getWeights(): Promise<WeightsResponse> {
    console.log('🌐 API: GET /recommendations/admin/weights');
    const response = await fetch(`${API_BASE_URL}/recommendations/admin/weights`, {
      headers: getAuthHeaders(),
    });
    console.log('📡 API: Response status:', response.status);

    if (!response.ok) {
      throw new Error('Failed to fetch weights');
    }

    const data = await response.json();
    console.log('📥 API: Weights data:', data);
    return data;
  },

  // Admin: Update recommendation weights
  async updateWeights(weights: UpdateWeightsRequest): Promise<WeightsResponse> {
    console.log('🌐 API: POST /recommendations/admin/weights', weights);
    const response = await fetch(`${API_BASE_URL}/recommendations/admin/weights`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(weights),
    });
    console.log('📡 API: Response status:', response.status);

    const data = await response.json();
    console.log('📥 API: Update weights response:', data);

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update weights');
    }

    return data;
  },
};
