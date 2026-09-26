import mongoose from "mongoose";

const cartItemSchema = mongoose.Schema(
  {
    productId: String,
    productID: Number,
    name: String,
    price: Number,
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    unit: {
      type: String,
      default: 'kg',
    },
    imageType: String,
    image: String,
    farmerName: String,
  },
  { _id: false }
);

const cartModel = mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    items: [cartItemSchema],
    deliveryType: {
      type: String,
      enum: ['delivery', 'pickup'],
      default: 'delivery',
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Method to recalculate totals
cartModel.methods.calculateTotals = function () {
  const subtotal = this.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  this.subtotal = Number(subtotal.toFixed(2));
  this.deliveryCharge = this.deliveryType === 'delivery' ? 3.5 : 0;
  this.grandTotal = Number((this.subtotal + this.deliveryCharge).toFixed(2));
  return this;
};

export default mongoose.model('cart', cartModel);
