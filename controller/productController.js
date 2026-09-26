import mongoose from 'mongoose';
import productModel from '../model/product.model.js';

/**
 * 1. Get all products (unpaginated)
 */
const getProducts = async (req, res) => {
  try {
    const products = await productModel.find({});
    res.json({ success: true, products });
  } catch (err) {
    console.error("error due to", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 2. Add product (with optional file upload)
 */
const addproduct = async (req, res) => {
  try {
    const {
      name,
      productName,
      cat,
      category,
      price,
      buyPrice,
      vendor,
      farmerName,
      farmName,
      area,
      unit,
      stock,
      description,
      imageType,
    } = req.body;

    const prodName = name || productName;
    const prodCat = cat || category || "Fresh Vegetables";
    const prodPrice = Number(price || buyPrice || 0);
    const prodVendor = vendor || farmerName || "Marcus Vance";

    let imagename = "Aptech-1.jpg";
    if (req.file) {
      imagename = "Aptech-" + req.file.originalname;
    }

    const noofrec = await productModel.countDocuments();
    const maxid = noofrec + 1;

    const productData = {
      productName: prodName,
      name: prodName,
      productLine: prodCat,
      category: prodCat,
      productVendor: prodVendor,
      farmerName: prodVendor,
      farmName: farmName || `${prodVendor}'s Farm Stall`,
      buyPrice: prodPrice,
      price: prodPrice,
      productID: maxid,
      image: imagename,
      imageType: imageType || 'cabbage',
      unit: unit || 'kg',
      quantityInStock: Number(stock || 100),
      stock: Number(stock || 100),
      productDescription: description || 'Fresh harvest produce direct from local farm.',
      description: description || 'Fresh harvest produce direct from local farm.',
      area: area || 'Downtown Metro',
    };

    const product = new productModel(productData);
    await product.save();

    res.status(200).json({
      success: true,
      msg: "Your product has been add with id=" + maxid,
      productID: maxid,
      product,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      msg: "Your product has not been completed due to " + err.message,
    });
  }
};

/**
 * 3. Legacy Categorized & Paginated products
 */
const getAllProduct = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const pagesize = parseInt(req.params.pagesize) || 10;
    const skiprec = (page - 1) * pagesize;
    const sortby = req.params.sortby || "buyPrice";
    const cat = req.params.cat;

    const query = {};
    if (cat && cat !== 'all') {
      query.$or = [
        { productLine: { $regex: new RegExp(cat, 'i') } },
        { category: { $regex: new RegExp(cat, 'i') } },
      ];
    }

    const sortField = sortby === 'popular' ? { farmerRating: -1 } : { [sortby]: 1 };

    const totalCount = await productModel.countDocuments(query);
    const products = await productModel
      .find(query)
      .skip(skiprec)
      .limit(pagesize)
      .sort(sortField);

    res.json({
      success: true,
      products,
      page,
      pagesize,
      totalCount,
      totalPages: Math.ceil(totalCount / pagesize),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 4. Get product by ID (Supports numeric productID or MongoDB ObjectId)
 */
const getProductbyID = async (req, res) => {
  try {
    const id = req.params.ID;
    const queryConditions = [];

    if (!isNaN(id)) {
      queryConditions.push({ productID: Number(id) });
    }
    if (mongoose.isValidObjectId(id)) {
      queryConditions.push({ _id: id });
    }

    // Fallback search by string id
    queryConditions.push({ id: id });

    const products = await productModel.find({ $or: queryConditions });

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "record not found",
        products: [],
      });
    }

    res.json({
      success: true,
      products,
      product: products[0],
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "record not found",
      error: err.message,
    });
  }
};

/**
 * 5. Get product by Category
 */
const getProductbyCAT = async (req, res) => {
  try {
    const cat = req.params.CAT;
    const products = await productModel.find({
      $or: [
        { productLine: { $regex: new RegExp(`^${cat}$`, 'i') } },
        { category: { $regex: new RegExp(`^${cat}$`, 'i') } },
      ],
    });

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "record not found",
        products: [],
      });
    } else {
      res.json({ success: true, products });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 6. Get product by Name
 */
const getProductbyName = async (req, res) => {
  try {
    const name = req.params.NAME;
    const products = await productModel.find({
      $or: [
        { productName: { $regex: new RegExp(name, 'i') } },
        { name: { $regex: new RegExp(name, 'i') } },
      ],
    });

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "record not found",
        products: [],
      });
    } else {
      res.json({ success: true, products });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 7. Category summary counts
 */
const CatWiseNoOfProducts = async (req, res) => {
  try {
    const data = await productModel.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$category", "$productLine"] },
          totalnoofproduct: { $sum: 1 },
        },
      },
      {
        $sort: { totalnoofproduct: -1 },
      },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "record not found",
      error: err.message,
    });
  }
};

/**
 * 8. Update product
 */
const updateproduct = async (req, res) => {
  try {
    const { name, cat, price, vendor, id } = req.body;

    const product1 = {
      productName: name,
      name: name,
      productLine: cat,
      category: cat,
      productVendor: vendor,
      farmerName: vendor,
      buyPrice: Number(price),
      price: Number(price),
    };

    if (req.file) {
      product1.image = "Aptech-" + req.file.originalname;
    }

    const query = !isNaN(id)
      ? { productID: Number(id) }
      : mongoose.isValidObjectId(id)
      ? { _id: id }
      : { productID: id };

    await productModel.updateMany(query, { $set: product1 });

    res.status(200).json({
      success: true,
      msg: "Your product has been updated",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      msg: "Your product has not been updated due to " + err.message,
    });
  }
};

/**
 * 9. Multi-Dimensional Search (Section 4 Requirements)
 * Supports:
 * - Farmer-wise search
 * - Price-wise search (minPrice, maxPrice)
 * - Category-wise search
 * - Area/location-wise search
 * - Keyword/Search Query
 * - Pagination & Sorting
 */
const searchProducts = async (req, res) => {
  try {
    const {
      q,
      searchQuery,
      farmer,
      category,
      area,
      minPrice,
      maxPrice,
      page = 1,
      pageSize = 12,
      sortBy = 'popular',
    } = { ...req.query, ...req.body };

    const filter = {};

    // 1. Keyword search (Name, description, vendor, origin)
    const keyword = q || searchQuery;
    if (keyword && keyword.trim() !== '') {
      const regex = new RegExp(keyword.trim(), 'i');
      filter.$or = [
        { productName: regex },
        { name: regex },
        { productDescription: regex },
        { description: regex },
        { productVendor: regex },
        { farmerName: regex },
        { farmName: regex },
      ];
    }

    // 2. Farmer-wise filter
    if (farmer && farmer !== 'all') {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { farmerName: { $regex: new RegExp(farmer, 'i') } },
          { productVendor: { $regex: new RegExp(farmer, 'i') } },
          { farmerId: farmer },
        ],
      });
    }

    // 3. Category-wise filter
    if (category && category !== 'all') {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { category: { $regex: new RegExp(category, 'i') } },
          { productLine: { $regex: new RegExp(category, 'i') } },
        ],
      });
    }

    // 4. Area / Location-wise filter
    if (area && area !== 'all') {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { area: { $regex: new RegExp(area, 'i') } },
          { marketName: { $regex: new RegExp(area, 'i') } },
        ],
      });
    }

    // 5. Price-wise filter (minPrice, maxPrice)
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min) || !isNaN(max)) {
      const priceFilter = {};
      if (!isNaN(min) && min >= 0) priceFilter.$gte = min;
      if (!isNaN(max) && max > 0) priceFilter.$lte = max;

      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [{ price: priceFilter }, { buyPrice: priceFilter }],
      });
    }

    // Sorting
    let sortObj = {};
    if (sortBy === 'price_asc' || sortBy === 'low_to_high') {
      sortObj = { price: 1, buyPrice: 1 };
    } else if (sortBy === 'price_desc' || sortBy === 'high_to_low') {
      sortObj = { price: -1, buyPrice: -1 };
    } else if (sortBy === 'name') {
      sortObj = { name: 1, productName: 1 };
    } else {
      // Default: popularity / rating / newest
      sortObj = { farmerRating: -1, createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(pageSize) || 12));
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await productModel.countDocuments(filter);
    const products = await productModel
      .find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    // Extract dynamic available facets for frontend filters
    const availableFarmers = await productModel.distinct('farmerName');
    const availableAreas = await productModel.distinct('area');
    const availableCategories = await productModel.distinct('category');

    res.json({
      success: true,
      totalCount,
      page: pageNum,
      pageSize: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
      products,
      facets: {
        farmers: availableFarmers.filter(Boolean),
        areas: availableAreas.filter(Boolean),
        categories: availableCategories.filter(Boolean),
      },
    });
  } catch (err) {
    console.error("Search products error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 10. Delete Product (Admin / Vendor)
 */
const deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const query = !isNaN(id)
      ? { productID: Number(id) }
      : mongoose.isValidObjectId(id)
      ? { _id: id }
      : { productID: id };

    const deleted = await productModel.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, message: "Product deleted successfully", deletedId: id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export {
  getAllProduct,
  getProductbyID,
  getProductbyCAT,
  getProductbyName,
  CatWiseNoOfProducts,
  getProducts,
  addproduct,
  updateproduct,
  searchProducts,
  deleteProduct,
};