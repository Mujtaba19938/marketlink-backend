import orderModel from '../model/order.model.js';
import productModel from '../model/product.model.js';
import farmerModel from '../model/farmer.model.js';
import reviewModel from '../model/review.model.js';

/**
 * 1. Vendor Orders Management
 */
export const getVendorOrders = async (req, res) => {
  try {
    const { farmerId, farmerName } = req.query;
    const orders = await orderModel.find().sort({ createdAt: -1 });

    const filtered = orders.filter((o) => {
      if (!farmerName) return true;
      return (
        o.stallName?.toLowerCase().includes(farmerName.toLowerCase()) ||
        o.items?.some((i) => i.farmerName?.toLowerCase().includes(farmerName.toLowerCase()))
      );
    });

    res.json({ success: true, vendorOrders: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateVendorOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'accepted', 'ready_for_pickup', 'completed', 'declined', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const order = await orderModel.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { orderNumber: id },
        { orderId: id },
      ].filter(Boolean),
    });

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.status = status;
    order.orderStatus = status;

    if (status === 'ready_for_pickup') {
      order.deliveryStep = 4;
    } else if (status === 'completed') {
      order.deliveryStep = 5;
    }

    await order.save();

    res.json({ success: true, message: `Order updated to ${status}`, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 2. Vendor Stall Settings
 */
export const getStallSettings = async (req, res) => {
  try {
    const { farmerName = 'Marcus Vance' } = req.query;
    const farmer = await farmerModel.findOne({
      $or: [{ name: farmerName }, { farmName: farmerName }],
    });

    const settings = {
      stallName: farmer?.farmName || "Green Valley Organic Stall #14",
      contactPerson: farmer?.name || "Marcus Vance",
      phone: farmer?.phone || "(555) 234-8901",
      email: farmer?.email || "marcus@greenvalleyfarms.com",
      operationalDays: farmer?.operationalDays || ["Wednesday", "Saturday", "Sunday"],
      pickupWindows: farmer?.pickupWindows || [
        "08:00 AM - 09:30 AM",
        "09:30 AM - 11:00 AM",
        "11:00 AM - 12:30 PM",
        "12:30 PM - 02:00 PM",
      ],
      locationName: "Downtown Fresh Pavilion - North Shed A",
      marketName: farmer?.marketName || "Downtown Fresh Pavilion",
      lat: farmer?.lat || 37.7749,
      lng: farmer?.lng || -122.4194,
      cutoffHoursBeforePickup: 12,
      autoResetWeeklyStock: true,
    };

    res.json({ success: true, stallSettings: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateStallSettings = async (req, res) => {
  try {
    const { farmerName = 'Marcus Vance', ...updates } = req.body;
    const updated = await farmerModel.findOneAndUpdate(
      { $or: [{ name: farmerName }, { farmName: farmerName }] },
      { $set: updates },
      { new: true }
    );

    res.json({ success: true, message: "Stall settings updated successfully", settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 3. Vendor Reviews & Farmer Replies
 */
export const getVendorReviews = async (req, res) => {
  try {
    const { farmerName } = req.query;
    const query = farmerName ? { farmerName: { $regex: new RegExp(farmerName, 'i') } } : {};
    const reviews = await reviewModel.find(query).sort({ createdAt: -1 });
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const replyToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyText } = req.body;

    const review = await reviewModel.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { reviewId: id },
      ].filter(Boolean),
    });

    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    review.reply = {
      text: replyText,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    await review.save();
    res.json({ success: true, message: "Reply added to review", review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getVendorOrders,
  updateVendorOrderStatus,
  getStallSettings,
  updateStallSettings,
  getVendorReviews,
  replyToReview,
};
