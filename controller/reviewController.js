import mongoose from 'mongoose'
import reviewModel from '../model/review.model.js'
import orderModel from '../model/order.model.js'
import orderItemModel from '../model/orderItem.model.js'
import farmerModel from '../model/farmer.model.js'
import notify from '../utilities/notify.js'

const addReview = async (req, res) => {

    const { orderItemId, rating, comment } = req.body
    if (!mongoose.isValidObjectId(orderItemId)) return res.status(400).json({ success: false, msg: 'Valid orderItemId is required' })

    const r = Number(rating)
    if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ success: false, msg: 'Rating must be an integer 1-5' })

    const orderItem = await orderItemModel.findById(orderItemId)
    if (!orderItem) return res.status(404).json({ success: false, msg: 'Order item not found' })

    const order = await orderModel.findById(orderItem.order)
    // both "not found" and "not yours" return the same 404, so ownership isn't leaked
    if (!order || String(order.customer) !== String(req.user._id)) {
        return res.status(404).json({ success: false, msg: 'Order item not found' })
    }
    if (order.status !== 'COMPLETED') {
        return res.status(409).json({ success: false, msg: 'You can only review items from a completed order' })
    }

    try {
        const review = await reviewModel.create({
            customer: req.user._id, product: orderItem.product, farmer: order.farmer,
            order: order._id, orderItem: orderItem._id, rating: r,
            comment: typeof comment === 'string' ? comment.trim().slice(0, 1000) : undefined,
        })
        const farmer = await farmerModel.findById(order.farmer).select('user')
        if (farmer) await notify(farmer.user, 'New review', req.user.name + ' rated ' + orderItem.productName + ' ' + r + '/5', 'SYSTEM')
        res.status(201).json({ success: true, msg: 'Review submitted', review })
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, msg: 'You already reviewed this item' })
        throw err
    }
}

// public
const getProductReviews = async (req, res) => {
    const id = req.params.productId
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, msg: 'Invalid product id' })

    const reviews = await reviewModel.find({ product: id, status: 'VISIBLE' }).populate('customer', 'name').sort({ createdAt: -1 })
    res.status(200).json({ success: true, reviews })
}

// farmer
const respondReview = async (req, res) => {

    const { reviewId, response } = req.body
    if (!mongoose.isValidObjectId(reviewId) || typeof response !== 'string' || !response.trim()) {
        return res.status(400).json({ success: false, msg: 'Valid reviewId and response text are required' })
    }

    const review = await reviewModel.findOne({ _id: reviewId, farmer: req.farmer._id })
    if (!review) return res.status(404).json({ success: false, msg: 'Review not found' })

    review.farmerResponse = response.trim()
    await review.save()
    await review.populate([{ path: 'customer', select: 'name' }, { path: 'product', select: 'name' }])
    await notify(review.customer._id, 'The farmer replied to your review', req.farmer.stallName + ': ' + review.farmerResponse, 'SYSTEM')

    res.status(200).json({ success: true, msg: 'Response added', review })
}

// admin
const moderateReview = async (req, res) => {

    const { reviewId, status } = req.body
    if (!mongoose.isValidObjectId(reviewId) || !['VISIBLE', 'HIDDEN'].includes(status)) {
        return res.status(400).json({ success: false, msg: 'Valid reviewId and status (VISIBLE/HIDDEN) are required' })
    }

    const review = await reviewModel.findByIdAndUpdate(reviewId, { $set: { status, moderated: true } }, { returnDocument: 'after' })
    if (!review) return res.status(404).json({ success: false, msg: 'Review not found' })

    res.status(200).json({ success: true, msg: 'Review is now ' + status, review })
}

export { addReview, getProductReviews, respondReview, moderateReview }
