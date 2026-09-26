import mongoose from "mongoose";

const reviewModel = mongoose.Schema(
  {
    reviewId: String,
    productId: String,
    productName: String,
    farmerId: String,
    farmerName: String,
    customerId: String,
    customerName: {
      type: String,
      required: true,
    },
    orderId: String,
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
    },
    tags: [String],
    date: {
      type: String,
      default: () => new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    },
    verifiedPurchase: {
      type: Boolean,
      default: true,
    },
    reply: {
      text: String,
      date: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('review', reviewModel);
