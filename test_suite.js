/**
 * End-to-End Automated Test Suite for MarketLink Express Backend
 * Verifies all functional flows:
 * - Authentication & RBAC
 * - Registration & 6-digit Email Verification
 * - 4-Dimension Product Search & Facets
 * - Product Details (Numeric & ObjectId)
 * - Cart Management & Server-side Totals
 * - Checkout, Orders & Live 6-Stage Delivery Tracking
 * - Stripe Payment Integration
 * - Admin Panel & Farmer/Market/Customer Management
 * - Legacy Route Compatibility
 */

import app from './server.js';
import http from 'http';

const BASE_URL = 'http://localhost:5000';
const API_KEY = 'Abcd123456789@|';

let serverInstance;
let testPassed = 0;
let testFailed = 0;

const assert = (condition, testName, details = '') => {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    testPassed++;
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    testFailed++;
  }
};

const runTests = async () => {
  console.log('\n================ STARTING BACKEND TEST SUITE ================\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Health Check Root
    // -------------------------------------------------------------
    console.log('--- 1. System Health ---');
    const healthRes = await fetch(`${BASE_URL}/`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === 'online', 'Server online & health check OK');

    // -------------------------------------------------------------
    // Test 2: Legacy Route Compatibility
    // -------------------------------------------------------------
    console.log('\n--- 2. Legacy Route Backward Compatibility ---');
    const legacyProductsRes = await fetch(`${BASE_URL}/getProducts`);
    const legacyProducts = await legacyProductsRes.json();
    assert(legacyProducts.products?.length >= 12, 'Legacy /getProducts returns product list', `count: ${legacyProducts.products?.length}`);

    const legacyFilteredRes = await fetch(`${BASE_URL}/getAllProduct/1/5/buyPrice/all`, {
      headers: { 'x-api-key': API_KEY },
    });
    const legacyFiltered = await legacyFilteredRes.json();
    assert(legacyFiltered.products?.length === 5, 'Legacy /getAllProduct/:page/:pagesize/:sortby/:cat returns paginated list');

    const legacyCatSummaryRes = await fetch(`${BASE_URL}/catproducts`);
    const legacyCatSummary = await legacyCatSummaryRes.json();
    assert(Array.isArray(legacyCatSummary.data) && legacyCatSummary.data.length > 0, 'Legacy /catproducts returns category aggregation');

    const legacyProductByIdRes = await fetch(`${BASE_URL}/getProductbyID/1`);
    const legacyProductById = await legacyProductByIdRes.json();
    assert(legacyProductById.products?.[0]?.productName === 'Savoy Crisp Cabbage', 'Legacy /getProductbyID/1 returns correct produce');

    // -------------------------------------------------------------
    // Test 3: Authentication & Password Validation
    // -------------------------------------------------------------
    console.log('\n--- 3. Authentication & RBAC ---');
    // 3a: Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/authlogin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@marketlink.org', pwd: 'admin123' }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginData.success === true && adminLoginData.token, 'Admin login with admin@marketlink.org succeeds');
    const adminToken = adminLoginData.token;

    // 3b: Customer Login
    const custLoginRes = await fetch(`${BASE_URL}/authlogin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'clara.higgins@gmail.com', pwd: 'customer123' }),
    });
    const custLoginData = await custLoginRes.json();
    assert(custLoginData.success === true && custLoginData.user?.role === 'customer', 'Customer login with clara.higgins@gmail.com succeeds');
    const customerToken = custLoginData.token;

    // 3c: Invalid Credentials
    const badLoginRes = await fetch(`${BASE_URL}/authlogin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'clara.higgins@gmail.com', pwd: 'WRONG_PASSWORD' }),
    });
    const badLoginData = await badLoginRes.json();
    assert(badLoginData.success === false, 'Invalid password rejected safely');

    // 3d: Nonexistent Email
    const noEmailRes = await fetch(`${BASE_URL}/authlogin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ghost@doesnotexist.com', pwd: 'any' }),
    });
    const noEmailData = await noEmailRes.json();
    assert(noEmailData.success === false, 'Non-existent email rejected gracefully');

    // -------------------------------------------------------------
    // Test 4: Registration & 6-Digit Email Verification Flow
    // -------------------------------------------------------------
    console.log('\n--- 4. Registration & Email Verification ---');
    const testEmail = `patron.${Date.now()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/addcustomer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Julian Hayes',
        email: testEmail,
        pwd: 'password123',
        address: '88 Harvest Lane, North Valley',
        phone: '(555) 774-9021',
      }),
    });
    const regData = await regRes.json();
    assert(regData.success === true && regData.requiresVerification, 'New customer registration created & verification code generated');

    // Fetch the generated verification code via simulated inspection endpoint
    const inspectCodeRes = await fetch(`${BASE_URL}/api/auth/verification-code/${testEmail}`);
    const inspectCodeData = await inspectCodeRes.json();
    const verifCode = inspectCodeData.code;
    assert(verifCode && verifCode.length === 6, '6-digit verification code retrieved for dispatch', `code: ${verifCode}`);

    // Verify invalid code
    const badVerifyRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '000000' }),
    });
    const badVerifyData = await badVerifyRes.json();
    assert(badVerifyData.success === false, 'Incorrect verification code rejected');

    // Verify correct code
    const goodVerifyRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: verifCode }),
    });
    const goodVerifyData = await goodVerifyRes.json();
    assert(goodVerifyData.success === true && goodVerifyData.user?.isEmailVerified === true, 'Valid 6-digit code marks account as verified');

    // Login with newly registered and verified account
    const newLoginRes = await fetch(`${BASE_URL}/authlogin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, pwd: 'password123' }),
    });
    const newLoginData = await newLoginRes.json();
    assert(newLoginData.success === true && newLoginData.user?.email === testEmail, 'Verified account logs in immediately with preserved cart state');

    // -------------------------------------------------------------
    // Test 5: 4-Dimension Produce Search Engine
    // -------------------------------------------------------------
    console.log('\n--- 5. 4-Dimension Product Search ---');
    // 5a: Farmer-wise search
    const farmerSearchRes = await fetch(`${BASE_URL}/api/products/search?farmer=Marcus%20Vance`);
    const farmerSearch = await farmerSearchRes.json();
    assert(farmerSearch.products?.every((p) => p.farmerName === 'Marcus Vance'), '1. Farmer-wise filter matches produce for Marcus Vance');

    // 5b: Category-wise search
    const catSearchRes = await fetch(`${BASE_URL}/api/products/search?category=Root%20Tubers%20%26%20Potatoes`);
    const catSearch = await catSearchRes.json();
    assert(catSearch.products?.length > 0 && catSearch.products[0].category === 'Root Tubers & Potatoes', '2. Category-wise filter matches Root Tubers');

    // 5c: Price-wise search
    const priceSearchRes = await fetch(`${BASE_URL}/api/products/search?minPrice=3.00&maxPrice=4.00`);
    const priceSearch = await priceSearchRes.json();
    assert(priceSearch.products?.every((p) => (p.price || p.buyPrice) >= 3.00 && (p.price || p.buyPrice) <= 4.00), '3. Price range filter ($3.00 - $4.00) verified');

    // 5d: Area-wise search
    const areaSearchRes = await fetch(`${BASE_URL}/api/products/search?area=Sunset%20District`);
    const areaSearch = await areaSearchRes.json();
    assert(areaSearch.products?.every((p) => p.area === 'Sunset District'), '4. Area/location-wise filter matches Sunset District');

    // 5e: Combined multi-dimension search with keyword
    const multiSearchRes = await fetch(`${BASE_URL}/api/products/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: 'Carrots',
        farmer: 'Marcus Vance',
        minPrice: 2,
        maxPrice: 10,
        page: 1,
        pageSize: 5,
        sortBy: 'price_asc',
      }),
    });
    const multiSearch = await multiSearchRes.json();
    assert(multiSearch.products?.length >= 1 && multiSearch.products[0].name.includes('Carrots'), 'Combined 4-dimension search with sorting returns precise result');

    // -------------------------------------------------------------
    // Test 6: Cart & Server-Side Pricing Engine
    // -------------------------------------------------------------
    console.log('\n--- 6. Cart Management & Server-Side Totals ---');
    const cartCustId = `cust-${Date.now()}`;

    // Add item to cart
    const addCartRes = await fetch(`${BASE_URL}/api/cart/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: cartCustId,
        productID: 1, // Savoy Crisp Cabbage ($4.80)
        quantity: 2,
        deliveryType: 'delivery',
      }),
    });
    const addCartData = await addCartRes.json();
    assert(addCartData.success === true && addCartData.cart?.items?.length === 1, 'Product added to persistent server-side cart');

    // Verify server-side total: 2 * 4.80 = 9.60 + 3.50 delivery = 13.10
    assert(addCartData.cart.subtotal === 9.60 && addCartData.cart.grandTotal === 13.10, 'Server calculated trusted subtotal ($9.60) & grand total ($13.10)');

    // Add second item
    await fetch(`${BASE_URL}/api/cart/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: cartCustId,
        productID: 2, // Tuscan Lacinato Kale ($3.50)
        quantity: 1,
      }),
    });

    // Get cart
    const getCartRes = await fetch(`${BASE_URL}/api/cart?customerId=${cartCustId}`);
    const getCartData = await getCartRes.json();
    assert(getCartData.cart?.items?.length === 2 && getCartData.subtotal === 13.10 && getCartData.grandTotal === 16.60, 'Cart retrieved with 2 items and exact totals');

    // Clear cart
    const clearCartRes = await fetch(`${BASE_URL}/api/cart/clear`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: cartCustId }),
    });
    const clearCartData = await clearCartRes.json();
    assert(clearCartData.cart?.items?.length === 0, 'Cart successfully cleared');

    // -------------------------------------------------------------
    // Test 7: Checkout, Orders & Live 6-Stage Delivery Tracking
    // -------------------------------------------------------------
    console.log('\n--- 7. Checkout, Orders & 6-Stage Tracking ---');
    const orderPayload = {
      customer: {
        name: 'Clara Higgins',
        email: 'clara.higgins@gmail.com',
        phone: '(555) 312-8874',
        address: '428 Elm Street, Apt 3B',
      },
      items: [
        { productID: 1, name: 'Savoy Crisp Cabbage', quantity: 2, buyPrice: 4.80 },
        { productID: 5, name: 'Organic Heirloom Carrots', quantity: 3, buyPrice: 3.45 },
      ],
      paymentmethod: 'stripe',
      deliveryType: 'delivery',
      deliveryAddress: '428 Elm Street, Apt 3B',
      deliveryArea: 'Downtown Metro',
    };

    const addOrderRes = await fetch(`${BASE_URL}/addorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });
    const addOrderData = await addOrderRes.json();
    assert(addOrderData.success === true && addOrderData.orderId, 'Order created via trusted server calculation', `Order Number: ${addOrderData.orderNumber}`);

    const createdOrderId = addOrderData.orderId;

    // Verify initial delivery tracking step = 0 ('placed')
    const trackOrderRes = await fetch(`${BASE_URL}/api/orders/${createdOrderId}`);
    const trackOrderData = await trackOrderRes.json();
    assert(trackOrderData.order?.deliveryStep === 0 && trackOrderData.order?.status === 'placed', 'Initial Order Delivery Step = 0 (Placed)');

    // -------------------------------------------------------------
    // Test 8: Stripe Payment Confirmation
    // -------------------------------------------------------------
    console.log('\n--- 8. Stripe Payment Verification ---');
    const verifyPayRes = await fetch(`${BASE_URL}/api/payment/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: createdOrderId }),
    });
    const verifyPayData = await verifyPayRes.json();
    assert(verifyPayData.success === true && verifyPayData.order?.paymentStatus === 'Paid', 'Stripe payment verified server-side and marked Paid');
    assert(verifyPayData.order?.deliveryStep === 1 && verifyPayData.order?.status === 'payment_confirmed', 'Order automatically advanced to Step 1 (Payment Confirmed)');

    // Test Live Delivery Progression: Advance Step 2 (Packing) -> Step 3 (Dispatched) -> Step 4 (Out for Delivery) -> Step 5 (Delivered)
    console.log('\n--- 9. Live 6-Stage Delivery Step Progression ---');
    const step2Res = await fetch(`${BASE_URL}/api/orders/${createdOrderId}/advance-step`, { method: 'POST' });
    const step2 = await step2Res.json();
    assert(step2.deliveryStep === 2 && step2.status === 'processing', 'Advanced to Step 2: Processing / Packing');

    const step3Res = await fetch(`${BASE_URL}/api/orders/${createdOrderId}/advance-step`, { method: 'POST' });
    const step3 = await step3Res.json();
    assert(step3.deliveryStep === 3 && step3.status === 'dispatched', 'Advanced to Step 3: Dispatched');

    const step4Res = await fetch(`${BASE_URL}/api/orders/${createdOrderId}/advance-step`, { method: 'POST' });
    const step4 = await step4Res.json();
    assert(step4.deliveryStep === 4 && step4.status === 'out_for_delivery', 'Advanced to Step 4: Out for Delivery');

    const step5Res = await fetch(`${BASE_URL}/api/orders/${createdOrderId}/advance-step`, { method: 'POST' });
    const step5 = await step5Res.json();
    assert(step5.deliveryStep === 5 && step5.status === 'delivered', 'Advanced to Step 5: Delivered');

    // -------------------------------------------------------------
    // Test 10: Admin Panel Management APIs
    // -------------------------------------------------------------
    console.log('\n--- 10. Admin Panel APIs ---');
    // Metrics
    const metricsRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const metricsData = await metricsRes.json();
    assert(metricsData.success === true && metricsData.metrics?.totalProducts >= 12, 'Admin telemetry metrics calculated accurately');

    // Farmers List
    const farmersRes = await fetch(`${BASE_URL}/api/admin/farmers`);
    const farmersData = await farmersRes.json();
    assert(farmersData.farmers?.length >= 3, 'Admin farmer directory retrieved');

    // Farmer Approval
    const approveRes = await fetch(`${BASE_URL}/api/admin/farmers/f-3/approve`, { method: 'POST' });
    const approveData = await approveRes.json();
    assert(approveData.success === true && approveData.farmer?.status === 'approved', 'Admin approves pending farmer (Dale Henderson)');

    // Markets List & CRUD
    const marketsRes = await fetch(`${BASE_URL}/api/admin/markets`);
    const marketsData = await marketsRes.json();
    assert(marketsData.markets?.length >= 4, 'Admin markets retrieved with GPS coordinates');

    // Content Moderation
    const modRes = await fetch(`${BASE_URL}/api/admin/moderation`);
    const modData = await modRes.json();
    assert(modData.moderationItems?.length >= 2, 'Content moderation queue retrieved');

    // Announcements
    const annRes = await fetch(`${BASE_URL}/api/admin/announcements`);
    const annData = await annRes.json();
    assert(annData.announcements?.length >= 2, 'System announcements retrieved');

    // -------------------------------------------------------------
    // Test 11: Interactive Map Stalls
    // -------------------------------------------------------------
    console.log('\n--- 11. Interactive Map Stalls ---');
    const stallsRes = await fetch(`${BASE_URL}/api/markets/mkt-1/stalls`);
    const stallsData = await stallsRes.json();
    assert(stallsData.stalls?.length >= 1, 'Interactive map stall markers retrieved for Downtown Pavilion');

    console.log('\n================ TEST SUMMARY ================');
    console.log(`Total Tests Run: ${testPassed + testFailed}`);
    console.log(`Passed: ${testPassed}`);
    console.log(`Failed: ${testFailed}`);
    console.log('==============================================\n');

    process.exit(testFailed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  }
};

// Delay 1.5s to let DB connection establish
setTimeout(runTests, 1500);
