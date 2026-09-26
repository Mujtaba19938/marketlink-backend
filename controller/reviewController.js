import reviewModel from '../model/review.model.js';
import orderModel from '../model/order.model.js';

export const submitFeedback = async (req, res) => {
  try {
    const {
      orderId,
      farmerName,
      productName,
      rating,
      comment,
      tags = [],
      customerName,
    } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({ success: false, message: "Rating and comment are required." });
    }

    const review = new reviewModel({
      reviewId: `rev-${Date.now()}`,
      orderId,
      farmerName: farmerName || 'Green Valley Organic Stall',
      productName: productName || 'Produce Order',
      customerName: customerName || req.user?.name || 'Clara Higgins',
      customerId: req.user?._id || req.user?.id,
      rating: Number(rating),
      comment,
      tags,
      verifiedPurchase: true,
    });

    await review.save();

    // Mark order as having feedback
    if (orderId) {
      await orderModel.updateOne(
        { $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderNumber: orderId }] },
        { $set: { hasFeedback: true } }
      ).catch(() => {});
    }

    res.status(201).json({ success: true, message: "Feedback submitted successfully", review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getReviews = async (req, res) => {
  try {
    const { productId, farmerName } = req.query;
    const query = {};
    if (productId) query.productId = productId;
    if (farmerName) query.farmerName = { $regex: new RegExp(farmerName, 'i') };

    const reviews = await reviewModel.find(query).sort({ createdAt: -1 });
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  submitFeedback,
  getReviews,
};
