import mongoose from "mongoose";

const customerModel = mongoose.Schema(
  {
    customerNumber: Number,
    customerName: String,
    contactLastName: String,
    contactFirstName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    salesRepEmployeeNumber: String,
    creditLimit: String,
    email: {
      type: String,
      required: true,
      unique: true,
    },
    file: String,
    pwd: {
      type: String,
      required: true,
    },
    type: String,

    // MarketLink SRS & Dashboard Extensions
    name: String, // Convenience alias for customerName
    address: String, // Convenience alias for addressLine1
    role: {
      type: String,
      enum: ['admin', 'vendor', 'customer'],
      default: 'customer',
    },
    status: {
      type: String,
      enum: ['active', 'deactivated'],
      default: 'active',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationCode: String,
    emailVerificationExpires: Date,
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    lastOrderDate: String,
    avatar: String,
    badge: String,
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to keep name and customerName in sync
customerModel.pre('save', function (next) {
  if (this.name && !this.customerName) {
    this.customerName = this.name;
  } else if (this.customerName && !this.name) {
    this.name = this.customerName;
  }
  if (this.address && !this.addressLine1) {
    this.addressLine1 = this.address;
  } else if (this.addressLine1 && !this.address) {
    this.address = this.addressLine1;
  }
  next();
});

export default mongoose.model('customer', customerModel);