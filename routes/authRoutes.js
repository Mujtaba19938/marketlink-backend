import express from 'express';
import fs from 'fs';
import path from 'path';

// Controllers
import {
  getAllProduct,
  getProductbyID,
  getProductbyCAT,
  getProductbyName,
  CatWiseNoOfProducts,
  getProducts,
  addproduct,
  updateproduct,
  searchProducts,
  deleteProduct,
} from '../controller/productController.js';

import {
  getAllcustomer,
  addcustomer,
  getpwd,
  getcomppwd,
  authlogin,
  getEmail,
  updatecustomer,
  changepwd,
  verifyEmailCode,
  resendVerificationCode,
  getSimulatedVerificationCode,
  getCustomerProfile,
} from '../controller/customerController.js';

import {
  addOrder,
  getOrderById,
  getCustomerOrders,
  advanceDeliveryStep,
  cancelOrder,
  modifyOrder,
} from '../controller/orderController.js';

import { confirmPayment } from '../controller/webhookController.js';
import { createPaymentIntent, verifyPayment } from '../controller/paymentController.js';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  calculateTotals,
} from '../controller/cartController.js';

import {
  getAdminMetrics,
  getFarmers,
  approveFarmer,
  suspendFarmer,
  addFarmer,
  getCustomers,
  toggleCustomerStatus,
  getMarkets,
  createMarket,
  updateMarket,
  deleteMarket,
  getModerationItems,
  resolveModerationItem,
  dismissModerationItem,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAnnouncements,
  broadcastAnnouncement,
  toggleAnnouncement,
} from '../controller/adminController.js';

import {
  getVendorOrders,
  updateVendorOrderStatus,
  getStallSettings,
  updateStallSettings,
  getVendorReviews,
  replyToReview,
} from '../controller/vendorController.js';

import { submitFeedback, getReviews } from '../controller/reviewController.js';
import { getMarketStalls, getAllStallsGrouped } from '../controller/mapController.js';

// Middlewares
import apiKeyMiddleware from '../middleware/authMiddleware.js';
import authMiddleware from '../middleware/jwtMiddleware.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// ==========================================
// 1. PRESERVED ORIGINAL ROUTES (Zero Regressions)
// ==========================================
router.get('/getAllProduct/:page/:pagesize/:sortby/:cat', apiKeyMiddleware, getAllProduct);
router.get('/getProductbyID/:ID', getProductbyID);
router.get('/getProductbyCAT/:CAT', getProductbyCAT);
router.get('/getProductbyName/:NAME', getProductbyName);
router.get('/getAllcustomer', authMiddleware, getAllcustomer);
router.post('/addcustomer', addcustomer);
router.get('/catproducts', CatWiseNoOfProducts);

router.get('/getpwd/:pwd', getpwd);
router.get('/getcomppwd/:pwd/:cpwd', getcomppwd);

router.post('/authlogin', authlogin);
router.get('/getEmail/:email', getEmail);
router.post('/updatecustomer', updatecustomer);
router.get('/changepwd/:email/:pwd', changepwd);

router.get('/getProducts', getProducts);
router.post('/addorder', addOrder);
router.post('/webhook', confirmPayment);
router.post('/api/webhooks/stripe', confirmPayment);
router.post('/api/webhook', confirmPayment);
router.post('/api/stripe/webhook', confirmPayment);

router.post('/addproduct', upload.single('image'), addproduct);
router.post('/updateproduct', upload.single('image'), updateproduct);

// Static image streaming endpoint with fallback
router.get('/images/:imageName', (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(process.cwd(), 'uploads', imageName);
  if (fs.existsSync(imagePath)) {
    const readStream = fs.createReadStream(imagePath);
    readStream.pipe(res);
  } else {
    // Return placeholder SVG or 404
    res.status(404).send('Image not found');
  }
});

// ==========================================
// 2. ENHANCED SEARCH & PRODUCT DETAILS
// ==========================================
router.get('/api/products/search', searchProducts);
router.post('/api/products/search', searchProducts);
router.get('/searchProducts', searchProducts);
router.delete('/api/products/:id', deleteProduct);

// ==========================================
// 3. EMAIL VERIFICATION & AUTH EXTENSIONS
// ==========================================
router.post('/api/auth/verify-email', verifyEmailCode);
router.post('/api/auth/resend-code', resendVerificationCode);
router.get('/api/auth/verification-code/:email', getSimulatedVerificationCode);
router.get('/api/auth/me', authMiddleware, getCustomerProfile);

// ==========================================
// 4. CART & CHECKOUT ENDPOINTS
// ==========================================
router.get('/api/cart', getCart);
router.post('/api/cart/add', addToCart);
router.put('/api/cart/update', updateCartItem);
router.delete('/api/cart/item/:productId', removeFromCart);
router.delete('/api/cart/clear', clearCart);
router.post('/api/cart/calculate', calculateTotals);

// ==========================================
// 5. ORDERS & LIVE 6-STAGE DELIVERY TRACKING
// ==========================================
router.get('/api/orders/:id', getOrderById);
router.get('/api/orders', getCustomerOrders);
router.post('/api/orders/:id/advance-step', advanceDeliveryStep);
router.post('/api/orders/:id/cancel', cancelOrder);
router.put('/api/orders/:id/modify', modifyOrder);

// ==========================================
// 6. STRIPE PAYMENT INTEGRATION
// ==========================================
router.post('/api/payment/create-intent', createPaymentIntent);
router.post('/api/payment/verify', verifyPayment);

// ==========================================
// 7. ADMIN PANEL APIs
// ==========================================
router.get('/api/admin/metrics', getAdminMetrics);
router.get('/api/admin/farmers', getFarmers);
router.post('/api/admin/farmers/:id/approve', approveFarmer);
router.post('/api/admin/farmers/:id/suspend', suspendFarmer);
router.post('/api/admin/farmers', addFarmer);

router.get('/api/admin/customers', getCustomers);
router.post('/api/admin/customers/:id/toggle', toggleCustomerStatus);

router.get('/api/admin/markets', getMarkets);
router.post('/api/admin/markets', createMarket);
router.put('/api/admin/markets/:id', updateMarket);
router.delete('/api/admin/markets/:id', deleteMarket);

router.get('/api/admin/moderation', getModerationItems);
router.post('/api/admin/moderation/:id/resolve', resolveModerationItem);
router.post('/api/admin/moderation/:id/dismiss', dismissModerationItem);

router.get('/api/admin/categories', getCategories);
router.post('/api/admin/categories', createCategory);
router.put('/api/admin/categories/:id', updateCategory);
router.delete('/api/admin/categories/:id', deleteCategory);

router.get('/api/admin/announcements', getAnnouncements);
router.post('/api/admin/announcements', broadcastAnnouncement);
router.post('/api/admin/announcements/:id/toggle', toggleAnnouncement);

// ==========================================
// 8. VENDOR / FARMER PORTAL APIs
// ==========================================
router.get('/api/vendor/orders', getVendorOrders);
router.post('/api/vendor/orders/:id/status', updateVendorOrderStatus);
router.get('/api/vendor/settings', getStallSettings);
router.put('/api/vendor/settings', updateStallSettings);
router.get('/api/vendor/reviews', getVendorReviews);
router.post('/api/vendor/reviews/:id/reply', replyToReview);

// ==========================================
// 9. REVIEWS & FEEDBACK
// ==========================================
router.post('/api/reviews', submitFeedback);
router.get('/api/reviews', getReviews);

// ==========================================
// 10. INTERACTIVE MAP & STALL GEOLOCATIONS
// ==========================================
router.get('/api/markets/:marketId/stalls', getMarketStalls);
router.get('/api/markets/stalls/all', getAllStallsGrouped);

export default router;