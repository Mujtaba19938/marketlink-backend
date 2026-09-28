import mongoose from 'mongoose'
import userModel from '../model/user.model.js'
import farmerModel from '../model/farmer.model.js'
import productModel from '../model/product.model.js'
import reviewModel from '../model/review.model.js'
import orderModel from '../model/order.model.js'
import marketModel from '../model/market.model.js'
import announcementModel from '../model/announcement.model.js'
import notificationModel from '../model/notification.model.js'
import contactMessageModel from '../model/contactMessage.model.js'
import notify from '../utilities/notify.js'
import { ratingsByFarmer } from './farmerController.js'

const getAllUser = async (req, res) => {

    const page = Math.max(parseInt(req.params.page) || 1, 1)
    const pagesize = Math.min(Math.max(parseInt(req.params.pagesize) || 10, 1), 50)

    const filter = {}
    if (['CUSTOMER', 'FARMER', 'ADMIN'].includes(req.query.role)) filter.role = req.query.role

    const total = await userModel.countDocuments(filter)
    const users = await userModel.find(filter).select('-pwd').sort({ createdAt: -1 }).skip((page - 1) * pagesize).limit(pagesize)

    res.status(200).json({ success: true, total, page, pages: Math.ceil(total / pagesize), users })
}

const updateuserstatus = async (req, res) => {

    const { userId, status } = req.body

    if (!mongoose.isValidObjectId(userId) || !['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ success: false, msg: 'Valid userId and status (ACTIVE/INACTIVE) are required' })
    }

    const user = await userModel.findById(userId)
    if (!user) return res.status(404).json({ success: false, msg: 'User not found' })

    // admin accounts cannot be deactivated from the API
    if (user.role === 'ADMIN') return res.status(403).json({ success: false, msg: 'Admin accounts cannot be changed' })

    user.status = status
    await user.save()

    res.status(200).json({ success: true, msg: 'User is now ' + status })
}

// GET /admin/customers -> every customer with order count, spend and last order date
const getCustomers = async (req, res) => {
    const customers = await userModel.find({ role: 'CUSTOMER' }).select('-pwd').sort({ createdAt: -1 })
    const stats = await orderModel.aggregate([
        { $group: {
            _id: '$customer',
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$totalAmount', 0] } },
            lastOrderAt: { $max: '$createdAt' },
        } },
    ])
    const map = {}
    stats.forEach((s) => { map[String(s._id)] = s })

    res.status(200).json({
        success: true,
        customers: customers.map((c) => {
            const s = map[String(c._id)]
            return {
                ...c.toObject(),
                totalOrders: s ? s.totalOrders : 0,
                totalSpent: s ? Number(s.totalSpent.toFixed(2)) : 0,
                lastOrderAt: s ? s.lastOrderAt : null,
            }
        }),
    })
}

// farmer list with contact info, rating, orders, revenue, product count and categories
const getFarmers = async (req, res) => {

    const status = req.params.status
    const filter = {}

    if (status !== 'all') {
        if (!['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(status)) {
            return res.status(400).json({ success: false, msg: 'Invalid status' })
        }
        filter.approvalStatus = status
    }

    const farmers = await farmerModel.find(filter).populate('user', 'name email phone status').sort({ createdAt: -1 })
    const ids = farmers.map((f) => f._id)

    const [ratings, orderRows, products] = await Promise.all([
        ratingsByFarmer(ids),
        orderModel.aggregate([
            { $match: { farmer: { $in: ids } } },
            { $group: {
                _id: '$farmer',
                totalOrders: { $sum: 1 },
                revenue: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$totalAmount', 0] } },
            } },
        ]),
        productModel.find({ farmer: { $in: ids }, isActive: true }).populate('category', 'name').select('farmer category'),
    ])
    const orderMap = {}
    orderRows.forEach((r) => { orderMap[String(r._id)] = r })

    res.status(200).json({
        success: true,
        farmers: farmers.map((f) => {
            const id = String(f._id)
            const own = products.filter((p) => String(p.farmer) === id)
            return {
                ...f.toObject(),
                rating: ratings[id] ? ratings[id].rating : 0,
                totalOrders: orderMap[id] ? orderMap[id].totalOrders : 0,
                revenue: orderMap[id] ? Number(orderMap[id].revenue.toFixed(2)) : 0,
                productCount: own.length,
                categories: [...new Set(own.filter((p) => p.category).map((p) => p.category.name))],
            }
        }),
    })
}

// one function for all farmer state changes, allowedFrom = valid current states
const changeFarmerStatus = async (req, res, allowedFrom, newStatus, needReason) => {

    const { farmerId, reason } = req.body

    if (!mongoose.isValidObjectId(farmerId)) {
        return res.status(400).json({ success: false, msg: 'Valid farmerId is required' })
    }

    if (needReason && (typeof reason !== 'string' || !reason.trim())) {
        return res.status(400).json({ success: false, msg: 'Reason is required' })
    }

    const farmer = await farmerModel.findById(farmerId)
    if (!farmer) return res.status(404).json({ success: false, msg: 'Farmer not found' })

    if (!allowedFrom.includes(farmer.approvalStatus)) {
        return res.status(409).json({
            success: false,
            msg: 'Cannot change farmer from ' + farmer.approvalStatus + ' to ' + newStatus
        })
    }

    farmer.approvalStatus = newStatus
    farmer.statusReason = needReason ? reason.trim() : ''
    await farmer.save()

    const text = {
        APPROVED: 'Your stall has been approved. You can now publish products and receive pre-orders.',
        REJECTED: 'Your stall registration was rejected: ' + (reason || '').trim(),
        SUSPENDED: 'Your stall has been suspended: ' + (reason || '').trim(),
    }
    await notify(farmer.user, 'Account ' + newStatus.toLowerCase(), text[newStatus], 'FARMER')

    res.status(200).json({ success: true, msg: 'Farmer is now ' + newStatus, farmer })
}

// PENDING -> APPROVED,  REJECTED -> APPROVED (reconsidered),  SUSPENDED -> APPROVED (reinstated)
const approvefarmer = (req, res) => changeFarmerStatus(req, res, ['PENDING', 'REJECTED', 'SUSPENDED'], 'APPROVED', false)

// PENDING -> REJECTED
const rejectfarmer = (req, res) => changeFarmerStatus(req, res, ['PENDING'], 'REJECTED', true)

// APPROVED -> SUSPENDED
const suspendfarmer = (req, res) => changeFarmerStatus(req, res, ['APPROVED'], 'SUSPENDED', true)

// ---------- content moderation ----------

// GET /admin/moderation -> listings and reviews the admin has not looked at yet
const getModerationQueue = async (req, res) => {
    const [products, reviews] = await Promise.all([
        productModel.find({ isActive: true, isBlocked: false, moderated: false })
            .populate({ path: 'farmer', select: 'stallName user', populate: { path: 'user', select: 'name' } })
            .sort({ updatedAt: -1 }),
        reviewModel.find({ status: 'VISIBLE', moderated: false })
            .populate('customer', 'name')
            .populate('product', 'name')
            .sort({ createdAt: -1 }),
    ])

    const items = [
        ...reviews.map((r) => ({
            id: String(r._id),
            type: 'review',
            targetName: r.product ? r.product.name : 'Product review',
            authorName: r.customer ? r.customer.name : 'Customer',
            reason: r.rating <= 2 ? 'Low rating (' + r.rating + '/5), check for abuse' : 'New customer review (' + r.rating + '/5)',
            severity: r.rating <= 2 ? 'high' : r.rating === 3 ? 'medium' : 'low',
            date: r.createdAt,
            contentPreview: r.comment || '(no comment)',
        })),
        ...products.map((p) => ({
            id: String(p._id),
            type: 'product',
            targetName: p.name,
            authorName: p.farmer ? (p.farmer.user ? p.farmer.user.name + ' • ' : '') + p.farmer.stallName : 'Farmer',
            reason: 'New or edited listing awaiting review',
            severity: 'low',
            date: p.updatedAt,
            contentPreview: (p.description || '(no description)') + ' • Rs ' + p.price + ' / ' + p.unit,
        })),
    ]

    res.status(200).json({ success: true, items })
}

// POST /admin/moderation/dismiss { type, id } -> keep content live, remove from queue
const dismissModeration = async (req, res) => {
    const { type, id } = req.body
    if (!['product', 'review'].includes(type) || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, msg: 'Valid type (product/review) and id are required' })
    }
    const model = type === 'product' ? productModel : reviewModel
    const result = await model.updateOne({ _id: id }, { $set: { moderated: true } })
    if (result.matchedCount === 0) return res.status(404).json({ success: false, msg: 'Item not found' })
    res.status(200).json({ success: true, msg: 'Kept live' })
}

// POST /admin/moderation/remove { type, id } -> block listing / hide review
const removeModeration = async (req, res) => {
    const { type, id } = req.body
    if (!['product', 'review'].includes(type) || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, msg: 'Valid type (product/review) and id are required' })
    }

    if (type === 'product') {
        const product = await productModel.findByIdAndUpdate(id, { $set: { isBlocked: true, moderated: true } }, { returnDocument: 'after' })
            .populate('farmer', 'user')
        if (!product) return res.status(404).json({ success: false, msg: 'Product not found' })
        if (product.farmer) await notify(product.farmer.user, 'Listing removed', '"' + product.name + '" was removed by an admin for violating platform guidelines.', 'SYSTEM')
        return res.status(200).json({ success: true, msg: 'Listing removed' })
    }

    const review = await reviewModel.findByIdAndUpdate(id, { $set: { status: 'HIDDEN', moderated: true } }, { returnDocument: 'after' })
    if (!review) return res.status(404).json({ success: false, msg: 'Review not found' })
    res.status(200).json({ success: true, msg: 'Review hidden' })
}

// ---------- announcements ----------

const getAnnouncements = async (req, res) => {
    const announcements = await announcementModel.find().sort({ createdAt: -1 }).limit(50)
    res.status(200).json({ success: true, announcements })
}

// POST /admin/addannouncement { title, message, targetAudience, priority } -> saves + sends in-app notifications
const addAnnouncement = async (req, res) => {
    const { title, message, targetAudience = 'all', priority = 'normal' } = req.body
    if (typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, msg: 'Title and message are required' })
    }

    const announcement = await announcementModel.create({
        title: title.trim(), message: message.trim(), targetAudience, priority, createdBy: req.user._id,
    })

    const roles = targetAudience === 'vendors' ? ['FARMER'] : targetAudience === 'customers' ? ['CUSTOMER'] : ['FARMER', 'CUSTOMER']
    const users = await userModel.find({ role: { $in: roles }, status: 'ACTIVE' }).select('_id')
    if (users.length) {
        await notificationModel.insertMany(users.map((u) => ({
            user: u._id, title: announcement.title, message: announcement.message, type: 'SYSTEM',
        })))
    }

    res.status(201).json({ success: true, msg: 'Announcement sent to ' + users.length + ' user(s)', announcement })
}

const toggleAnnouncement = async (req, res) => {
    const { announcementId } = req.body
    if (!mongoose.isValidObjectId(announcementId)) return res.status(400).json({ success: false, msg: 'Valid announcementId is required' })
    const announcement = await announcementModel.findById(announcementId)
    if (!announcement) return res.status(404).json({ success: false, msg: 'Announcement not found' })
    announcement.isActive = !announcement.isActive
    await announcement.save()
    res.status(200).json({ success: true, msg: announcement.isActive ? 'Announcement shown' : 'Announcement hidden', announcement })
}

// ---------- contact inbox ----------

const getContactMessages = async (req, res) => {
    const messages = await contactMessageModel.find().sort({ createdAt: -1 }).limit(100)
    res.status(200).json({ success: true, messages })
}

const markContactRead = async (req, res) => {
    const { messageId } = req.body
    if (!mongoose.isValidObjectId(messageId)) return res.status(400).json({ success: false, msg: 'Valid messageId is required' })
    const result = await contactMessageModel.updateOne({ _id: messageId }, { $set: { isRead: true } })
    if (result.matchedCount === 0) return res.status(404).json({ success: false, msg: 'Message not found' })
    res.status(200).json({ success: true, msg: 'Marked as read' })
}

// ---------- dashboard report ----------

const SERVER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
const localDateKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

// GET /admin/overview -> headline counts, last 7 days of orders, revenue per market, top farmers
const getOverview = async (req, res) => {

    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - 6)

    const [farmers, pendingFarmers, customers, markets, totalOrders, revenueRow, byDay, byMarket, top] = await Promise.all([
        farmerModel.countDocuments({ approvalStatus: 'APPROVED' }),
        farmerModel.countDocuments({ approvalStatus: 'PENDING' }),
        userModel.countDocuments({ role: 'CUSTOMER' }),
        marketModel.countDocuments({ isActive: true }),
        orderModel.countDocuments(),
        orderModel.aggregate([
            { $match: { status: 'COMPLETED' } },
            { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        ]),
        orderModel.aggregate([
            { $match: { createdAt: { $gte: since } } },
            { $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: SERVER_TZ } },
                orders: { $sum: 1 },
                revenue: { $sum: { $cond: [{ $in: ['$status', ['DECLINED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_FARMER']] }, 0, '$totalAmount'] } },
            } },
        ]),
        orderModel.aggregate([
            { $match: { status: 'COMPLETED' } },
            { $group: { _id: '$market', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
            { $lookup: { from: 'markets', localField: '_id', foreignField: '_id', as: 'market' } },
            { $unwind: '$market' },
            { $project: { name: '$market.name', revenue: 1, orders: 1 } },
            { $sort: { revenue: -1 } },
        ]),
        orderModel.aggregate([
            { $match: { status: { $in: ['PLACED', 'ACCEPTED', 'READY_FOR_PICKUP', 'COMPLETED'] } } },
            { $group: {
                _id: '$farmer',
                orders: { $sum: 1 },
                revenue: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$totalAmount', 0] } },
            } },
            { $sort: { orders: -1, revenue: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'farmers', localField: '_id', foreignField: '_id', as: 'farmer' } },
            { $unwind: '$farmer' },
            { $project: { stallName: '$farmer.stallName', city: '$farmer.city', address: '$farmer.address', orders: 1, revenue: 1 } },
        ]),
    ])

    // fill every one of the last 7 days, even days without orders
    const dayMap = {}
    byDay.forEach((d) => { dayMap[d._id] = d })
    const ordersByDay = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(since)
        d.setDate(since.getDate() + i)
        const key = localDateKey(d)
        ordersByDay.push({
            date: key,
            day: d.toLocaleDateString('en-US', { weekday: 'short' }),
            orders: dayMap[key] ? dayMap[key].orders : 0,
            revenue: dayMap[key] ? Number(dayMap[key].revenue.toFixed(2)) : 0,
        })
    }

    const ratings = await ratingsByFarmer(top.map((t) => t._id))
    const revenue = revenueRow[0] ? revenueRow[0].revenue : 0

    res.status(200).json({
        success: true,
        counts: { farmers, pendingFarmers, customers, markets, orders: totalOrders },
        revenue: Number(revenue.toFixed(2)),
        completedOrders: revenueRow[0] ? revenueRow[0].orders : 0,
        ordersByDay,
        revenueByMarket: byMarket.map((m) => ({
            name: m.name, revenue: Number(m.revenue.toFixed(2)), orders: m.orders,
            share: revenue ? Math.round((m.revenue / revenue) * 100) : 0,
        })),
        topFarmers: top.map((t) => ({
            id: t._id, stallName: t.stallName, location: [t.address, t.city].filter(Boolean).join(', '),
            orders: t.orders, revenue: Number(t.revenue.toFixed(2)),
            rating: ratings[String(t._id)] ? ratings[String(t._id)].rating : 0,
        })),
    })
}

export {
    getAllUser, updateuserstatus, getCustomers, getFarmers, approvefarmer, rejectfarmer, suspendfarmer,
    getModerationQueue, dismissModeration, removeModeration,
    getAnnouncements, addAnnouncement, toggleAnnouncement,
    getContactMessages, markContactRead, getOverview,
}
