import orderModel from '../model/order.model.js';
import productModel from '../model/product.model.js';
import customerModel from '../model/customer.model.js';
import Stripe from 'stripe';
import { sendOrderConfirmationEmail } from '../utilities/emailService.js';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "";

let stripe = null;
if (STRIPE_SECRET) {
  try {
    stripe = new Stripe(STRIPE_SECRET);
  } catch (e) {
    console.warn("Stripe initialization warning:", e.message);
  }
}

const DELIVERY_FEE = 3.50;

/**
 * 1. Create Pre-Order / Order & Initiate Stripe Checkout (Preserves existing addOrder API)
 */
const addOrder = async (req, res) => {
  try {
    const {
      customer,
      items = [],
      paymentmethod = "Card",
      paymentMethod,
      deliveryType = "delivery",
      deliveryAddress,
      deliveryArea,
      pickupDate,
      pickupSlot,
      notes,
      marketId,
      marketName,
      stallName,
      stallNumber,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: "Order items cannot be empty." });
    }

    // 1. Validate & calculate prices server-side using trusted database products
    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const prodId = item.id || item.productId || item.productID || item._id;
      let dbProduct = null;

      if (prodId) {
        if (!isNaN(prodId)) {
          dbProduct = await productModel.findOne({ productID: Number(prodId) });
        } else {
          dbProduct = await productModel.findById(prodId).catch(() => null);
        }
      }

      if (!dbProduct && item.name) {
        dbProduct = await productModel.findOne({
          $or: [{ name: item.name }, { productName: item.name }],
        });
      }

      const unitPrice = dbProduct
        ? Number(dbProduct.price || dbProduct.buyPrice || 0)
        : Number(item.price || item.buyPrice || 0);

      const qty = Math.max(1, Number(item.qty || item.quantity || 1));
      calculatedSubtotal += unitPrice * qty;

      validatedItems.push({
        id: prodId || `prod-${Date.now()}`,
        productID: dbProduct?.productID || item.productID,
        name: dbProduct?.name || dbProduct?.productName || item.name || "Produce Item",
        price: unitPrice,
        buyPrice: unitPrice,
        qty: qty,
        quantity: qty,
        unit: dbProduct?.unit || item.unit || "kg",
        imageType: dbProduct?.imageType || item.imageType || "cabbage",
      });
    }

    calculatedSubtotal = Number(calculatedSubtotal.toFixed(2));
    const effectiveDeliveryType = deliveryType.toLowerCase() === 'pickup' ? 'pickup' : 'delivery';
    const applicableDeliveryFee = effectiveDeliveryType === 'delivery' ? DELIVERY_FEE : 0;
    const finalTotal = Number((calculatedSubtotal + applicableDeliveryFee).toFixed(2));

    // 2. Parse Customer Information
    let customerData = {};
    if (typeof customer === 'string') {
      customerData = {
        name: customer,
        email: req.user?.email || "customer@marketlink.org",
        address: deliveryAddress || "Customer Address",
      };
    } else if (customer && typeof customer === 'object') {
      customerData = {
        customerId: customer.customerId || customer._id || customer.id,
        name: customer.name || customer.customerName || "Customer",
        email: customer.email || req.user?.email || "customer@marketlink.org",
        phone: customer.phone || customer.contactNumber,
        address: customer.address || customer.addressLine1 || deliveryAddress || "Address",
      };
    }

    const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    const effectivePaymentMethod = paymentMethod || paymentmethod;
    const isPickupCash = effectivePaymentMethod === 'pickup' || effectivePaymentMethod === 'cod';

    const newOrder = new orderModel({
      orderNumber,
      orderId: orderNumber,
      customer: customerData,
      items: validatedItems,
      subtotal: calculatedSubtotal,
      deliveryCharge: applicableDeliveryFee,
      total: finalTotal,
      status: isPickupCash ? "placed" : "placed",
      orderStatus: isPickupCash ? "placed" : "placed",
      paymentstatus: isPickupCash ? "Pending" : "Pending",
      paymentStatus: isPickupCash ? "Pending" : "Pending",
      paymentmethod: effectivePaymentMethod,
      paymentMethod: effectivePaymentMethod,
      deliveryType: effectiveDeliveryType,
      deliveryAddress: deliveryAddress || customerData.address,
      deliveryArea: deliveryArea || "Downtown Metro",
      deliveryEstimatedTime: "30-45 mins",
      deliveryStep: 0,
      courierName: "Mark Fresh Logistics (Driver #12)",
      courierPhone: "(555) 301-4491",
      pickupDate: pickupDate || new Date().toISOString().split('T')[0],
      pickupSlot: pickupSlot || "09:30 AM - 11:00 AM",
      notes: notes || "",
      marketId: marketId || "mkt-1",
      marketName: marketName || "Downtown Fresh Pavilion",
      stallName: stallName || "Green Valley Organic Stall #14",
      stallNumber: stallNumber || "Stall #14",
    });

    await newOrder.save();

    // Increment customer's order history if registered
    if (customerData.email) {
      await customerModel.updateOne(
        { email: customerData.email },
        {
          $inc: { totalOrders: 1, totalSpent: finalTotal },
          $set: { lastOrderDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) },
        }
      ).catch(() => {});
    }

    // Send order confirmation email
    if (customerData.email) {
      sendOrderConfirmationEmail(customerData.email, newOrder).catch(() => {});
    }

    // 3. Handle Stripe Checkout Session
    let stripeUrl = null;
    let stripeSessionId = null;

    if (!isPickupCash && stripe) {
      try {
        const clientOrigin =
          req.body.clientOrigin ||
          req.headers.origin ||
          process.env.CLIENT_URL ||
          process.env.CLIENT_URL_ALT ||
          "https://marketlink-two.vercel.app";

        const lineItems = validatedItems.map((item) => ({
          price_data: {
            currency: "usd",
            product_data: {
              name: item.name || "Produce Item",
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.qty,
        }));

        if (applicableDeliveryFee > 0) {
          lineItems.push({
            price_data: {
              currency: "usd",
              product_data: {
                name: "Fresh Local Delivery Fee",
              },
              unit_amount: Math.round(applicableDeliveryFee * 100),
            },
            quantity: 1,
          });
        }

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: lineItems,
          mode: "payment",
          success_url: `${clientOrigin}/#/dashboard?payment_success=true&order_id=${newOrder._id}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${clientOrigin}/#/dashboard?payment_cancelled=true`,
          metadata: {
            orderId: newOrder._id.toString(),
            orderNumber: newOrder.orderNumber,
          },
        });

        stripeUrl = session.url;
        stripeSessionId = session.id;

        newOrder.stripeSessionId = session.id;
        await newOrder.save();
      } catch (stripeErr) {
        console.warn("Stripe Checkout creation notice:", stripeErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      msg: "Your Order has been placed",
      url: stripeUrl,
      order: newOrder,
      orderId: newOrder._id,
      orderNumber: newOrder.orderNumber,
      total: finalTotal,
      stripeSessionId,
    });
  } catch (err) {
    console.error("Order creation error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to place order: " + err.message,
    });
  }
};

/**
 * 2. Get Order by Mongo ID or human orderNumber
 */
const getOrderById = async (req, res) => {
  try {
    const id = req.params.id;
    const order = await orderModel.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { orderNumber: id },
        { orderId: id },
      ].filter(Boolean),
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 3. Get Orders for Customer
 */
const getCustomerOrders = async (req, res) => {
  try {
    const { email, customerId } = req.query;
    const queryEmail = email || req.user?.email;
    const queryId = customerId || req.user?._id || req.user?.id;

    const conditions = [];
    if (queryEmail) conditions.push({ "customer.email": { $regex: new RegExp(`^${queryEmail}$`, 'i') } });
    if (queryId) conditions.push({ "customer.customerId": queryId.toString() });

    const query = conditions.length > 0 ? { $or: conditions } : {};
    const orders = await orderModel.find(query).sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 4. Advance Delivery Step (Live 6-Stage Tracking)
 * 0: Placed -> 1: Paid -> 2: Packing -> 3: Dispatched -> 4: Out for Delivery -> 5: Delivered
 */
const advanceDeliveryStep = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { orderNumber: id },
        { orderId: id },
      ].filter(Boolean),
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const nextStep = Math.min(5, (order.deliveryStep || 0) + 1);
    const stepStatusMap = {
      0: "placed",
      1: "payment_confirmed",
      2: "processing",
      3: "dispatched",
      4: "out_for_delivery",
      5: "delivered",
    };

    order.deliveryStep = nextStep;
    order.status = stepStatusMap[nextStep];
    order.orderStatus = stepStatusMap[nextStep];

    if (nextStep >= 1) {
      order.paymentStatus = "Paid";
      order.paymentstatus = "Paid";
    }

    await order.save();

    res.json({
      success: true,
      message: `Order advanced to Step ${nextStep}: ${order.status}`,
      deliveryStep: nextStep,
      status: order.status,
      order,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 5. Cancel Order (SRS Section 1.6: before cutoff / fulfillment)
 */
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { orderNumber: id },
        { orderId: id },
      ].filter(Boolean),
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.deliveryStep > 2 || order.status === 'dispatched' || order.status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled once dispatched or completed.",
      });
    }

    order.status = "cancelled";
    order.orderStatus = "cancelled";
    order.canCancel = false;
    order.canModify = false;
    await order.save();

    res.json({ success: true, message: "Order has been cancelled.", order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 6. Modify Order (SRS Section 1.6: Modify items before cutoff)
 */
const modifyOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items = [] } = req.body;

    const order = await orderModel.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { orderNumber: id },
        { orderId: id },
      ].filter(Boolean),
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!order.canModify || order.deliveryStep > 1) {
      return res.status(400).json({
        success: false,
        message: "Order modifications are locked as the cutoff time has passed.",
      });
    }

    // Recalculate totals
    let newSubtotal = 0;
    const updatedItems = items.map((it) => {
      const itemPrice = Number(it.price || it.buyPrice || 0);
      const itemQty = Number(it.qty || it.quantity || 1);
      newSubtotal += itemPrice * itemQty;
      return {
        ...it,
        price: itemPrice,
        buyPrice: itemPrice,
        qty: itemQty,
        quantity: itemQty,
      };
    });

    order.items = updatedItems;
    order.subtotal = Number(newSubtotal.toFixed(2));
    order.total = Number((order.subtotal + (order.deliveryCharge || 0)).toFixed(2));
    await order.save();

    res.json({ success: true, message: "Order modified successfully", order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export {
  addOrder,
  getOrderById,
  getCustomerOrders,
  advanceDeliveryStep,
  cancelOrder,
  modifyOrder,
};