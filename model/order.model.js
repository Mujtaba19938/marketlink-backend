import mongoose from "mongoose";

const orderCustomerSchema = mongoose.Schema(
  {
    customerId: String,
    name: String,
    email: String,
    phone: String,
    address: String,
  },
  { _id: false }
);

const orderItemSchema = mongoose.Schema(
  {
    id: String,
    productID: Number,
    name: String,
    price: Number,
    buyPrice: Number,
    qty: Number,
    quantity: Number,
    unit: {
      type: String,
      default: 'kg',
    },
    imageType: String,
  },
  { _id: false }
);

const orderModel = mongoose.Schema(
  {
    orderNumber: String,
    orderId: String,
    customer: orderCustomerSchema,
    items: [orderItemSchema],
    total: Number,
    subtotal: Number,
    deliveryCharge: {
      type: Number,
      default: 0,
    },

    // Order & Delivery Status (Synchronized)
    status: {
      type: String,
      default: "placed",
    },
    orderStatus: {
      type: String,
      default: "placed",
    },
    deliveryStep: {
      type: Number,
      default: 0, // 0: Placed, 1: Paid, 2: Processing, 3: Dispatched, 4: Out for Delivery, 5: Delivered
    },

    // Payment Information (Synchronized)
    paymentstatus: {
      type: String,
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      default: "Pending",
    },
    paymentmethod: {
      type: String,
      default: "Card",
    },
    paymentMethod: {
      type: String,
      default: "stripe",
    },
    paymentIntentId: String,
    stripeChargeId: String,
    stripeSessionId: String,

    // Fulfillment & Delivery Details
    deliveryType: {
      type: String,
      enum: ['delivery', 'pickup'],
      default: 'delivery',
    },
    deliveryAddress: String,
    deliveryArea: String,
    deliveryEstimatedTime: String,
    courierName: String,
    courierPhone: String,

    // Stall & Market Details (for Pickup pre-orders)
    marketId: String,
    marketName: String,
    marketAddress: String,
    stallName: String,
    stallNumber: String,
    stallLat: Number,
    stallLng: Number,
    pickupSlot: String,
    pickupDate: String,
    cutoffTime: String,
    notes: String,

    canModify: {
      type: Boolean,
      default: true,
    },
    canCancel: {
      type: Boolean,
      default: true,
    },
    hasFeedback: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save synchronization hook
orderModel.pre('save', function (next) {
  // Sync orderNumber / orderId
  if (!this.orderNumber && !this.orderId) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = `ORD-${randomSuffix}`;
    this.orderId = this.orderNumber;
  } else if (this.orderNumber && !this.orderId) {
    this.orderId = this.orderNumber;
  } else if (this.orderId && !this.orderNumber) {
    this.orderNumber = this.orderId;
  }

  // Sync statuses
  if (this.status && !this.orderStatus) this.orderStatus = this.status;
  if (this.orderStatus && !this.status) this.status = this.orderStatus;

  // Sync payment statuses
  if (this.paymentStatus && !this.paymentstatus) this.paymentstatus = this.paymentStatus;
  if (this.paymentstatus && !this.paymentStatus) this.paymentStatus = this.paymentstatus;

  // Sync payment methods
  if (this.paymentMethod && !this.paymentmethod) this.paymentmethod = this.paymentMethod;
  if (this.paymentmethod && !this.paymentMethod) this.paymentMethod = this.paymentmethod;

  // Sync item quantities and prices
  if (Array.isArray(this.items)) {
    this.items.forEach((item) => {
      if (item.qty !== undefined && item.quantity === undefined) item.quantity = item.qty;
      if (item.quantity !== undefined && item.qty === undefined) item.qty = item.quantity;
      if (item.price !== undefined && item.buyPrice === undefined) item.buyPrice = item.price;
      if (item.buyPrice !== undefined && item.price === undefined) item.price = item.buyPrice;
    });
  }

  next();
});

export default mongoose.model('order', orderModel);