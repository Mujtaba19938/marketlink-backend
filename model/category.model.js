import mongoose from "mongoose";

const categoryModel = mongoose.Schema(
  {
    categoryId: String,
    name: {
      type: String,
      required: true,
      unique: true,
    },
    itemCount: {
      type: Number,
      default: 0,
    },
    badgeColor: {
      type: String,
      default: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    iconName: {
      type: String,
      default: 'veggies',
    },
    description: String,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('category', categoryModel);
