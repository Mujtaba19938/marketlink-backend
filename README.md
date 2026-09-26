# MarketLink & MarketEase Express.js Backend

A modern, production-grade Express.js & MongoDB backend engineered for the **MarketLink** fresh farmers' market eCommerce platform. Built to support both local standalone server deployment and Vercel Serverless Function architecture.

---

## 🌟 Key Features

- **Serverless & Standalone Ready**: Configured with `vercel.json` and `@vercel/node` handler for instant Vercel cloud deployment alongside standard local `node server.js` execution.
- **Full Authentication & Authorization**:
  - Customer registration, login, and profile management with `jsonwebtoken` and `bcryptjs`.
  - 6-digit email verification flow with simulation fallbacks.
  - Multi-tiered RBAC (`customer`, `vendor`, `admin`) and API key guards (`x-api-key`).
- **Comprehensive E-Commerce Suite**:
  - **Product Catalog**: Multi-dimensional search (keywords, farmer, market location, categories, price range, stock levels, pagination).
  - **Cart Management**: Persistent shopping carts per user with dynamic subtotal recalculation and inventory checks.
  - **Checkout & Order Processing**: Server-side trusted calculation ensuring clients cannot tamper with prices.
  - **6-Stage Delivery Tracking**: Real-time progress updates (`0: Placed`, `1: Paid`, `2: Processing`, `3: Dispatched`, `4: Out for Delivery`, `5: Delivered`).
- **Stripe Integration**:
  - Stripe Checkout Sessions and PaymentIntents.
  - Secure Webhook handler with cryptographic signature verification (`STRIPE_WEBHOOK_SECRET`) handling `checkout.session.completed`, `payment_intent.succeeded`, `charge.succeeded`, and `setup_intent.created`.
- **Admin & Vendor Operations**:
  - Product approval/rejection moderation workflows.
  - Interactive stall location mapping.
  - Platform announcements and reviews.

---

## 🏗️ Architecture & Project Structure

```text
EXPRESSJS/
├── api/
│   └── index.js              # Vercel serverless entry point
├── config/
│   ├── db.js                 # Cached Mongoose connection (serverless-friendly)
│   └── seedData.js           # Production mock data for categories, products, markets
├── controller/
│   ├── adminController.js    # Moderation & administrative metrics
│   ├── cartController.js     # Shopping cart operations
│   ├── customerController.js # Auth, verification, profile
│   ├── mapController.js      # Stall coordinates & markets
│   ├── orderController.js    # Orders & 6-stage delivery progression
│   ├── paymentController.js  # Stripe payment intents
│   ├── productController.js  # Multi-criteria catalog & search
│   ├── reviewController.js   # Customer ratings & reviews
│   ├── vendorController.js   # Vendor & farmer management
│   └── webhookController.js  # Stripe webhook processing
├── middleware/
│   ├── authMiddleware.js     # API Key protection (x-api-key)
│   ├── jwtMiddleware.js      # JWT authentication & adminOnly RBAC
│   └── uploadMiddleware.js   # Multer file upload handler
├── model/                    # Mongoose schemas & data models
│   ├── announcement.model.js
│   ├── cart.model.js
│   ├── category.model.js
│   ├── customer.model.js
│   ├── farmer.model.js
│   ├── market.model.js
│   ├── moderation.model.js
│   ├── order.model.js
│   ├── product.model.js
│   ├── review.model.js
│   └── stallLocation.model.js
├── routes/
│   └── authRoutes.js         # Unified REST API router & legacy route compatibility
├── uploads/                  # Uploaded assets & product imagery
├── .env.example              # Sample environment template
├── .gitignore
├── .vercelignore
├── package.json
├── seed.js                   # Database seeder script
├── server.js                 # Express server configuration & HTTP listener
├── test_suite.js             # 38-stage automated test suite
└── vercel.json               # Vercel deployment configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- MongoDB running locally or a MongoDB Atlas connection string
- (Optional) Stripe account for test payment credentials

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <repository_url>
cd <repository_directory>
npm install
```

### 3. Environment Setup
Copy the sample environment file and update with your credentials:
```bash
cp .env.example .env
```

### 4. Database Seeding (Optional)
Seed the database with initial categories, farmers, products, markets, and an admin user:
```bash
npm run seed
```

Default credentials:
- **Admin**: `admin@marketlink.org` / `AdminPass123!`
- **Customer**: `clara.higgins@gmail.com` / `CustomerPass123!`

### 5. Running the Application

**Development Mode:**
```bash
npm run dev
```

**Running Tests:**
Run the comprehensive 38-stage integration test suite:
```bash
npm test
```

---

## ☁️ Vercel Serverless Deployment

This project is configured out of the box for deployment to Vercel:

1. Install the Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Deploy directly:
   ```bash
   vercel
   ```
3. Set your environment variables in the Vercel Dashboard (`Settings -> Environment Variables`):
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `API_KEY`
   - `MARKETEASE_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `CLIENT_URL`
