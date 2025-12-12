# Chronos Frontend

Next.js frontend for the Chronos luxury watch store.

## Features

- **User Simulation**: Switch between predefined users (James Bond, Alice Johnson, Guest)
- **Personalized Recommendations**: "For You" section with hybrid recommendation algorithm
- **Product Catalog**: Browse all luxury timepieces
- **Product Details**: View detailed information and purchase watches
- **Toast Notifications**: Real-time feedback for orders
- **Responsive Design**: Tailwind CSS for beautiful UI on all devices

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **API Communication**: Fetch API

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend services running on port 3000

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will run on [http://localhost:8080](http://localhost:8080)

### Build

```bash
npm run build
npm start
```

## Project Structure

```
chronos-frontend/
├── app/                    # Next.js App Router
│   ├── products/[id]/     # Product detail page
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Homepage
│   └── globals.css        # Global styles
├── components/            # React components
│   └── Navbar.tsx         # Navigation bar
├── contexts/              # React contexts
│   ├── UserContext.tsx    # User management
│   └── ToastContext.tsx   # Toast notifications
├── lib/                   # Utilities
│   └── api.ts             # API client
└── tailwind.config.ts     # Tailwind configuration
```

## User Switcher

The navbar includes a user switcher dropdown with three options:

1. **James Bond** (cust_001) - User with purchase history
2. **Alice Johnson** (cust_002) - User with purchase history
3. **Guest** - Cannot make purchases

Switch users to see personalized recommendations change in real-time.

## API Integration

The frontend communicates with the backend gateway at `http://localhost:3000`:

- `GET /products` - Fetch all products
- `GET /products/:id` - Fetch product details
- `GET /recommendations/:userId` - Fetch personalized recommendations
- `POST /checkout` - Place an order

## Features Walkthrough

### Homepage

- **Hero Section**: Welcome message with current user
- **For You Section**:
  - Shows "Curated For You" with personalized recommendations for users with purchase history
  - Shows "Trending Now" with global best-sellers for new users (cold start)
- **Complete Collection**: Grid of all products with stock indicators

### Product Detail Page

- View product information (name, brand, price, stock)
- See availability status (In Stock, Low Stock, Out of Stock)
- Buy Now button with real-time inventory validation
- Error handling for insufficient stock
- Toast notifications for order confirmations

### User Experience

- **Loading States**: Skeleton screens while fetching data
- **Error Handling**: User-friendly error messages
- **Real-time Updates**: Product stock updates after purchase
- **Responsive Design**: Works on mobile, tablet, and desktop

## Environment

- **Port**: 8080 (configured in package.json)
- **Backend Gateway**: http://localhost:3000

## Next Steps

- Add shopping cart functionality
- Implement order history page
- Add product search and filters
- Include product images
- Add authentication with JWT tokens
