import mongoose from "mongoose";

const stallLocationModel = mongoose.Schema(
  {
    stallId: String,
    stallNumber: String,
    stallName: String,
    farmerName: String,
    farmerId: String,
    marketId: {
      type: String,
      required: true,
    },
    marketName: String,
    category: String,
    lat: Number,
    lng: Number,
    rating: {
      type: Number,
      default: 4.8,
    },
    ordersCount: {
      type: Number,
      default: 0,
    },
    phone: String,
    description: String,
    specialtyItems: [String],
    pickupWindows: [String],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('stalllocation', stallLocationModel);
