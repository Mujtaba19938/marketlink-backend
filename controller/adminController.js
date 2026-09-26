import customerModel from '../model/customer.model.js';
import farmerModel from '../model/farmer.model.js';
import productModel from '../model/product.model.js';
import marketModel from '../model/market.model.js';
import orderModel from '../model/order.model.js';
import moderationModel from '../model/moderation.model.js';
import categoryModel from '../model/category.model.js';
import announcementModel from '../model/announcement.model.js';

/**
 * 1. Admin Dashboard Statistics & Analytics (Section 1.6 & 13)
 */
export const getAdminMetrics = async (req, res) => {
  try {
    const totalFarmers = await farmerModel.countDocuments();
    const approvedFarmers = await farmerModel.countDocuments({ status: 'approved' });
    const pendingFarmers = await farmerModel.countDocuments({ status: 'pending' });

    const totalCustomers = await customerModel.countDocuments({ role: { $ne: 'admin' } });
    const totalMarkets = await marketModel.countDocuments();
    const totalOrders = await orderModel.countDocuments();
    const totalProducts = await productModel.countDocuments();

    const revenueResult = await orderModel.aggregate([
      { $match: { $or: [{ paymentStatus: 'Paid' }, { paymentstatus: 'Paid' }] } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } },
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    const pendingModeration = await moderationModel.countDocuments({ status: 'pending' });
    const activeAnnouncements = await announcementModel.countDocuments({ active: true });

    res.json({
      success: true,
      metrics: {
        totalFarmers,
        approvedFarmers,
        pendingFarmers,
        totalCustomers,
        totalMarkets,
        totalOrders,
        totalProducts,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        pendingModeration,
        activeAnnouncements,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 2. Farmer Management: List, Filter, Search
 */
export const getFarmers = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { farmName: regex },
        { location: regex },
        { categories: regex },
      ];
    }

    const farmers = await farmerModel.find(query).sort({ createdAt: -1 });
    res.json({ success: true, farmers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const approveFarmer = async (req, res) => {
  try {
    const { id } = req.params;
    const farmer = await farmerModel.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { farmerId: id },
      ].filter(Boolean),
    });

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    farmer.status = 'approved';
    await farmer.save();

    res.json({ success: true, message: `Approved farmer ${farmer.name}`, farmer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const suspendFarmer = async (req, res) => {
  try {
    const { id } = req.params;
    const farmer = await farmerModel.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { farmerId: id },
      ].filter(Boolean),
    });

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    farmer.status = farmer.status === 'suspended' ? 'approved' : 'suspended';
    await farmer.save();

    res.json({
      success: true,
      message: `${farmer.status === 'suspended' ? 'Suspended' : 'Re-activated'} farmer ${farmer.name}`,
      farmer,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addFarmer = async (req, res) => {
  try {
    const newFarmer = new farmerModel({
      ...req.body,
      farmerId: `f-${Date.now()}`,
      status: req.body.status || 'pending',
    });
    await newFarmer.save();
    res.status(201).json({ success: true, message: "Farmer registration created", farmer: newFarmer });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * 3. Customer Management
 */
export const getCustomers = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = { role: { $ne: 'admin' } };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { customerName: regex },
        { name: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    const customers = await customerModel.find(query).select('-pwd').sort({ createdAt: -1 });
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const toggleCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await customerModel.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { customerNumber: !isNaN(id) ? Number(id) : null },
      ].filter(Boolean),
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    customer.status = customer.status === 'active' ? 'deactivated' : 'active';
    await customer.save();

    res.json({
      success: true,
      message: `Customer ${customer.customerName || customer.name} is now ${customer.status}`,
      customer,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 4. Markets Management (SRS Section 1.6 & 1.8)
 */
export const getMarkets = async (req, res) => {
  try {
    const markets = await marketModel.find().sort({ createdAt: -1 });
    res.json({ success: true, markets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMarket = async (req, res) => {
  try {
    const { name, address, operatingDays, timings, lat, lng, status } = req.body;
    const newMarket = new marketModel({
      marketId: `mkt-${Date.now()}`,
      name,
      address,
      operatingDays: operatingDays || ['Saturday', 'Sunday'],
      timings: timings || '08:00 AM - 02:00 PM',
      lat: Number(lat || 37.7749),
      lng: Number(lng || -122.4194),
      status: status || 'open',
    });
    await newMarket.save();
    res.status(201).json({ success: true, message: "Market created successfully", market: newMarket });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateMarket = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await marketModel.findOneAndUpdate(
      { $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { marketId: id }].filter(Boolean) },
      { $set: req.body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Market not found" });
    res.json({ success: true, message: "Market updated", market: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteMarket = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await marketModel.findOneAndDelete({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { marketId: id }].filter(Boolean),
    });
    if (!deleted) return res.status(404).json({ success: false, message: "Market not found" });
    res.json({ success: true, message: "Market deleted", deletedId: id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 5. Content Moderation
 */
export const getModerationItems = async (req, res) => {
  try {
    const items = await moderationModel.find().sort({ createdAt: -1 });
    res.json({ success: true, moderationItems: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const resolveModerationItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await moderationModel.findOneAndUpdate(
      { $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { moderationId: id }].filter(Boolean) },
      { $set: { status: 'resolved' } },
      { new: true }
    );
    res.json({ success: true, message: "Moderation item resolved", item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const dismissModerationItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await moderationModel.findOneAndUpdate(
      { $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { moderationId: id }].filter(Boolean) },
      { $set: { status: 'dismissed' } },
      { new: true }
    );
    res.json({ success: true, message: "Moderation item dismissed", item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 6. Master Categories
 */
export const getCategories = async (req, res) => {
  try {
    const categories = await categoryModel.find().sort({ itemCount: -1 });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, badgeColor, iconName, description } = req.body;
    const newCat = new categoryModel({
      categoryId: `cat-${Date.now()}`,
      name,
      badgeColor,
      iconName,
      description,
    });
    await newCat.save();
    res.status(201).json({ success: true, category: newCat });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await categoryModel.findOneAndUpdate(
      { $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { categoryId: id }].filter(Boolean) },
      { $set: req.body },
      { new: true }
    );
    res.json({ success: true, category: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await categoryModel.findOneAndDelete({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { categoryId: id }].filter(Boolean),
    });
    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 7. System Announcements
 */
export const getAnnouncements = async (req, res) => {
  try {
    const announcements = await announcementModel.find().sort({ createdAt: -1 });
    res.json({ success: true, announcements });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const broadcastAnnouncement = async (req, res) => {
  try {
    const { title, message, targetAudience, priority } = req.body;
    const newAnnouncement = new announcementModel({
      announcementId: `ann-${Date.now()}`,
      title,
      message,
      targetAudience: targetAudience || 'all',
      priority: priority || 'normal',
      active: true,
    });
    await newAnnouncement.save();
    res.status(201).json({ success: true, message: "Announcement broadcasted", announcement: newAnnouncement });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const toggleAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const ann = await announcementModel.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { announcementId: id }].filter(Boolean),
    });
    if (!ann) return res.status(404).json({ success: false, message: "Announcement not found" });

    ann.active = !ann.active;
    await ann.save();
    res.json({ success: true, announcement: ann });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getAdminMetrics,
  getFarmers,
  approveFarmer,
  suspendFarmer,
  addFarmer,
  getCustomers,
  toggleCustomerStatus,
  getMarkets,
  createMarket,
  updateMarket,
  deleteMarket,
  getModerationItems,
  resolveModerationItem,
  dismissModerationItem,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAnnouncements,
  broadcastAnnouncement,
  toggleAnnouncement,
};
