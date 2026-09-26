import mongoose from "mongoose";

const farmerModel = mongoose.Schema(
  {
    farmerId: String,
    name: {
      type: String,
      required: true,
    },
    farmName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: String,
    location: String,
    address: String,
    status: {
      type: String,
      enum: ['approved', 'pending', 'suspended'],
      default: 'approved',
    },
    joinDate: {
      type: String,
      default: () => new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    },
    rating: {
      type: Number,
      default: 4.8,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    productCount: {
      type: Number,
      default: 0,
    },
    categories: [String],
    operationalDays: [String],
    pickupWindows: [String],
    marketId: String,
    marketName: String,
    lat: Number,
    lng: Number,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('farmer', farmerModel);
