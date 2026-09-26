import mongoose from "mongoose";

const moderationModel = mongoose.Schema(
  {
    moderationId: String,
    type: {
      type: String,
      enum: ['product', 'review'],
      required: true,
    },
    targetName: String,
    authorName: String,
    reason: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    date: {
      type: String,
      default: () => new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    },
    contentPreview: String,
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('moderation', moderationModel);
