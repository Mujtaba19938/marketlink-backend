import mongoose from "mongoose";

const marketModel = mongoose.Schema(
  {
    marketId: String,
    name: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    operatingDays: [String],
    timings: String,
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
    activeVendorsCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'seasonal'],
      default: 'open',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('market', marketModel);
