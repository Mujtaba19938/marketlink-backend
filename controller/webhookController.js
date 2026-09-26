import Stripe from "stripe";
import Order from "../model/order.model.js";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "";

let stripe = null;
if (STRIPE_SECRET) {
  try {
    stripe = new Stripe(STRIPE_SECRET);
  } catch (e) {
    console.warn("Stripe initialization warning in webhookController:", e.message);
  }
}

/**
 * Stripe Webhook Handler
 * Supports:
 * - checkout.session.completed
 * - payment_intent.succeeded
 * - charge.succeeded
 * - setup_intent.created
 * - Optional cryptographic signature verification via STRIPE_WEBHOOK_SECRET
 */
export const confirmPayment = async (req, res) => {
  let event = req.body;
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // 1. Verify Stripe Cryptographic Signature if webhookSecret is configured
  if (webhookSecret && sig && stripe && req.rawBody) {
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
      console.log(`[Stripe Webhook Verified]: ${event.type}`);
    } catch (err) {
      console.error(`[Stripe Webhook Signature Failed]:`, err.message);
      return res.status(400).send(`Webhook Signature Verification Error: ${err.message}`);
    }
  } else {
    // Development / direct JSON payload processing
    if (typeof event === 'string') {
      try {
        event = JSON.parse(event);
      } catch {
        // ignore
      }
    }
  }

  try {
    const eventType = event?.type;
    console.log(`[Stripe Webhook Event Received]: ${eventType || 'unknown'}`);

    if (eventType === "checkout.session.completed") {
      const session = event.data?.object;
      const orderId = session?.metadata?.orderId || session?.client_reference_id;
      const chargeId = session?.payment_intent || session?.id;

      if (orderId) {
        await updateOrderPayment(orderId, chargeId, session?.id);
      }
    } else if (eventType === "payment_intent.succeeded") {
      const intent = event.data?.object;
      const orderId = intent?.metadata?.orderId;
      const chargeId = intent?.id;

      if (orderId) {
        await updateOrderPayment(orderId, chargeId);
      }
    } else if (eventType === "charge.succeeded") {
      const charge = event.data?.object;
      const orderId = charge?.metadata?.orderId;
      if (orderId) {
        await updateOrderPayment(orderId, charge?.id);
      }
    } else if (eventType === "setup_intent.created") {
      console.log(`[Stripe SetupIntent]: Card payment setup initialized`);
    }

    return res.status(200).json({
      received: true,
      success: true,
      eventType: eventType || 'received',
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({
      received: false,
      error: "Webhook handling failed: " + err.message,
    });
  }
};

/**
 * Helper to update order payment status across MongoDB
 */
async function updateOrderPayment(orderId, chargeId, sessionId) {
  try {
    const query = [
      { orderNumber: orderId },
      { orderId: orderId },
    ];

    if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
      query.push({ _id: orderId });
    }
    if (sessionId) {
      query.push({ stripeSessionId: sessionId });
    }

    const updated = await Order.findOneAndUpdate(
      { $or: query },
      {
        $set: {
          paymentStatus: "Paid",
          paymentstatus: "Paid",
          status: "payment_confirmed",
          orderStatus: "payment_confirmed",
          deliveryStep: 1,
          stripeChargeId: chargeId,
        },
      },
      { new: true }
    );

    if (updated) {
      console.log(`[Order Updated via Webhook]: Order #${updated.orderNumber || updated._id} set to Paid & payment_confirmed`);
    } else {
      console.warn(`[Webhook Warning]: Order not found for identifier ${orderId}`);
    }
  } catch (err) {
    console.error("Error updating order via webhook:", err);
  }
}

export default confirmPayment;