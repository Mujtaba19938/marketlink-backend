import mongoose from "mongoose";

const announcementModel = mongoose.Schema(
  {
    announcementId: String,
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    targetAudience: {
      type: String,
      enum: ['all', 'vendors', 'customers'],
      default: 'all',
    },
    priority: {
      type: String,
      enum: ['normal', 'important', 'urgent'],
      default: 'normal',
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdAtText: {
      type: String,
      default: () => new Date().toLocaleString(),
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('announcement', announcementModel);
