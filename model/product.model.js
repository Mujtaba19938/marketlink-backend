import mongoose from "mongoose";

const productModel = mongoose.Schema(
  {
    productName: String,
    productLine: String,
    productScale: String,
    productVendor: String,
    productDescription: String,
    quantityInStock: Number,
    buyPrice: Number,
    MSRP: String,
    image: String,
    productID: Number,

    // MarketLink SRS & Dashboard Extensions
    name: String, // Convenience alias for productName
    category: String, // Convenience alias for productLine
    price: Number, // Convenience alias for buyPrice
    stock: Number, // Convenience alias for quantityInStock
    description: String, // Convenience alias for productDescription
    unit: {
      type: String,
      default: 'kg',
    },
    farmerId: String,
    farmerName: {
      type: String,
      default: 'Marcus Vance',
    },
    farmName: {
      type: String,
      default: 'Green Valley Organic Stall #14',
    },
    farmerRating: {
      type: Number,
      default: 4.9,
    },
    area: {
      type: String,
      default: 'Downtown Metro',
    },
    marketId: {
      type: String,
      default: 'mkt-1',
    },
    marketName: {
      type: String,
      default: 'Downtown Fresh Pavilion',
    },
    imageType: {
      type: String,
      default: 'cabbage',
    },
    status: {
      type: String,
      enum: ['in_stock', 'sold_out', 'temporarily_unavailable'],
      default: 'in_stock',
    },
    weeklyRecurringStock: {
      type: Number,
      default: 100,
    },
    origin: {
      type: String,
      default: 'Locally grown in mineral-rich soil',
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to synchronize aliases
productModel.pre('save', function (next) {
  if (this.name && !this.productName) this.productName = this.name;
  if (this.productName && !this.name) this.name = this.productName;

  if (this.category && !this.productLine) this.productLine = this.category;
  if (this.productLine && !this.category) this.category = this.productLine;

  if (this.price !== undefined && this.buyPrice === undefined) this.buyPrice = this.price;
  if (this.buyPrice !== undefined && this.price === undefined) this.price = this.buyPrice;

  if (this.stock !== undefined && this.quantityInStock === undefined) this.quantityInStock = this.stock;
  if (this.quantityInStock !== undefined && this.stock === undefined) this.stock = this.quantityInStock;

  if (this.description && !this.productDescription) this.productDescription = this.description;
  if (this.productDescription && !this.description) this.description = this.productDescription;

  if (this.farmerName && !this.productVendor) this.productVendor = this.farmerName;
  if (this.productVendor && !this.farmerName) this.farmerName = this.productVendor;

  next();
});

export default mongoose.model('product', productModel);
