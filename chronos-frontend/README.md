# Chronos Frontend

A luxury watch e-commerce frontend built with Next.js, featuring a dark premium theme with gold accents.

## Features

### Advanced Discovery
- **Real-time Search Bar**: Instant search across product catalog
- **Brand Filter**: Dropdown to filter watches by brand (Rolex, Omega, Patek Philippe, etc.)
- **Category Filter**: Filter by category (Sport, Luxury, Dress, Dive, etc.)
- **Dynamic Counts**: Shows filtered vs total product count
- **Clear Filters**: One-click reset for all active filters

### Personalized Recommendations
- **Hybrid Algorithm**: Combines content-based and collaborative filtering
- **Cold Start Handling**: Shows trending/top-selling for new users
- **"Curated For You"**: Personalized section for users with purchase history
- **Exclusive Badges**: Visual indicators for recommended products

### Loyalty & Rewards
- **Automatic Tier Discounts**: Applied at checkout based on user tier
  - Platinum: 15% off
  - Gold: 10% off
  - Silver: 7.5% off
  - Bronze: 5% off
- **Reward Points**: Earned on every purchase, displayed in real-time
- **Tier Progress**: Visual loyalty status in user profile

### Wishlist
- **Save Products**: Heart icon to add/remove from wishlist
- **Dedicated Page**: View all saved items at `/wishlist`
- **Persistent Storage**: Synced with backend per user
- **Quick Actions**: Add to cart directly from wishlist

### Order History
- **Orders Page**: View all past purchases at `/orders`
- **Order Details**: Items, quantities, prices, and status
- **Date Tracking**: Order timestamps and delivery status
- **Reward Summary**: Points earned per order

### Product Experience
- **Product Detail Pages**: Full specifications and imagery
- **Real-time Stock**: Live inventory updates after purchase
- **Low Stock Alerts**: "Limited" badge when stock < 3
- **Optimistic Updates**: Instant UI feedback on checkout

### UI/UX
- **Dark Luxury Theme**: Premium black (#0a0a0a) with gold (#d4af37) accents
- **Responsive Design**: Mobile, tablet, and desktop optimized
- **Loading States**: Skeleton screens during data fetch
- **Toast Notifications**: Real-time feedback for all actions
- **User Switcher**: Test with different user profiles

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: React Context API
- **API**: Fetch with custom client

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

App runs on [http://localhost:8080](http://localhost:8080)

## Project Structure

```
chronos-frontend/
├── app/
│   ├── page.tsx              # Homepage (hero, recommendations, catalog)
│   ├── products/[id]/        # Product detail page
│   ├── orders/               # Order history page
│   ├── wishlist/             # Wishlist page
│   └── globals.css           # Global styles (dark theme)
├── components/
│   ├── Navbar.tsx            # Navigation with user switcher
│   ├── ProductCard.tsx       # Product grid cards
│   └── SearchBar.tsx         # Search component
├── contexts/
│   ├── UserContext.tsx       # User state management
│   └── ToastContext.tsx      # Notification system
└── lib/
    └── api.ts                # Backend API client
```

## User Profiles

Switch between users to test personalization:

| User          | ID        | History | Tier   |
|---------------|-----------|---------|--------|
| James Bond    | cust_001  | Yes     | Gold   |
| Alice Johnson | cust_002  | Yes     | Silver |
| Guest         | -         | No      | -      |

## API Integration

Connects to backend gateway at `http://localhost:3000`:

```
GET  /products                    # Product catalog
GET  /products/:id                # Product details
GET  /recommendations/:userId     # Personalized recommendations
POST /checkout                    # Place order
GET  /orders/:userId              # Order history
GET  /wishlist/:customerId        # User wishlist
POST /wishlist/:customerId/:id    # Add to wishlist
DELETE /wishlist/:customerId/:id  # Remove from wishlist
```

## Environment

- **Frontend Port**: 8080
- **Backend Gateway**: http://localhost:3000
