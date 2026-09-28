import mongoose from 'mongoose'
import farmerModel from '../model/farmer.model.js'
import userModel from '../model/user.model.js'
import productModel from '../model/product.model.js'
import orderModel from '../model/order.model.js'
import orderItemModel from '../model/orderItem.model.js'
import reviewModel from '../model/review.model.js'
import farmerMarketModel from '../model/farmerMarket.model.js'
import pick from '../utilities/pick.js'
import { saveImage, deleteImage } from '../utilities/imageStore.js'

// public: never show user id, email, phone or admin notes
const publicFields = '-user -statusReason'

// rating + review count per farmer, from visible reviews only
const ratingsByFarmer = async (farmerIds) => {
    const rows = await reviewModel.aggregate([
        { $match: { farmer: { $in: farmerIds }, status: 'VISIBLE' } },
        { $group: { _id: '$farmer', rating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
    ])
    const map = {}
    rows.forEach((r) => { map[String(r._id)] = { rating: Number(r.rating.toFixed(1)), reviewCount: r.reviewCount } })
    return map
}

// ---------- public ----------
const getAllFarmer = async (req, res) => {

    const page = Math.max(parseInt(req.params.page) || 1, 1)
    const pagesize = Math.min(Math.max(parseInt(req.params.pagesize) || 10, 1), 50)

    const filter = { approvalStatus: 'APPROVED' }

    const total = await farmerModel.countDocuments(filter)
    const farmers = await farmerModel.find(filter).select(publicFields).sort({ stallName: 1 }).skip((page - 1) * pagesize).limit(pagesize)

    res.status(200).json({ success: true, total, page, pages: Math.ceil(total / pagesize), farmers })
}

// GET /getFarmerDirectory -> approved farmers with rating, categories, markets and stall pins in one call
const getFarmerDirectory = async (req, res) => {

    const farmers = await farmerModel.find({ approvalStatus: 'APPROVED' })
        .populate('user', 'name')
        .sort({ stallName: 1 })
    const ids = farmers.map((f) => f._id)

    const [ratings, assignments, products, completed] = await Promise.all([
        ratingsByFarmer(ids),
        farmerMarketModel.find({ farmer: { $in: ids }, isActive: true })
            .populate({ path: 'market', match: { isActive: true }, select: 'name address city latitude longitude operatingDays timings status' }),
        productModel.find({ farmer: { $in: ids }, isActive: true, isBlocked: false }).populate('category', 'name').select('farmer category'),
        orderModel.aggregate([
            { $match: { farmer: { $in: ids }, status: 'COMPLETED' } },
            { $group: { _id: '$farmer', count: { $sum: 1 } } },
        ]),
    ])

    const completedMap = {}
    completed.forEach((c) => { completedMap[String(c._id)] = c.count })

    const directory = farmers.map((f) => {
        const id = String(f._id)
        const own = products.filter((p) => String(p.farmer) === id)
        const categories = [...new Set(own.filter((p) => p.category).map((p) => p.category.name))]
        return {
            _id: f._id,
            stallName: f.stallName,
            description: f.description,
            address: f.address,
            city: f.city,
            latitude: f.latitude,
            longitude: f.longitude,
            image: f.image,
            contactPerson: f.user ? f.user.name : '',
            rating: ratings[id] ? ratings[id].rating : 0,
            reviewCount: ratings[id] ? ratings[id].reviewCount : 0,
            completedOrders: completedMap[id] || 0,
            productCount: own.length,
            categories,
            markets: assignments
                .filter((a) => String(a.farmer) === id && a.market)
                .map((a) => ({
                    _id: a._id,
                    market: a.market,
                    operatingDays: a.operatingDays,
                    pickupStart: a.pickupStart,
                    pickupEnd: a.pickupEnd,
                    cutoffHours: a.cutoffHours,
                    stallNumber: a.stallNumber,
                    latitude: a.latitude,
                    longitude: a.longitude,
                })),
            createdAt: f.createdAt,
        }
    })

    res.status(200).json({ success: true, farmers: directory })
}

const getFarmerbyID = async (req, res) => {
    const id = req.params.id
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, msg: 'Invalid farmer id' })

    const farmer = await farmerModel.findOne({ _id: id, approvalStatus: 'APPROVED' }).select(publicFields)
    if (!farmer) return res.status(404).json({ success: false, msg: 'Farmer not found' })

    res.status(200).json({ success: true, farmer })
}

// ---------- farmer (req.farmer is set by loadFarmer) ----------
const getFarmerProfile = async (req, res) => {
    res.status(200).json({ success: true, farmer: req.farmer, user: req.user })
}

const updateFarmerProfile = async (req, res) => {

    const farmer = req.farmer

    // approvalStatus is NOT in this list, so a farmer cannot approve himself
    const updates = pick(req.body, ['stallName', 'description', 'address', 'city', 'latitude', 'longitude', 'autoResetWeeklyStock'])
    if (updates.stallName !== undefined && (typeof updates.stallName !== 'string' || !updates.stallName.trim())) {
        return res.status(400).json({ success: false, msg: 'Stall name cannot be empty' })
    }
    if (updates.autoResetWeeklyStock !== undefined) {
        updates.autoResetWeeklyStock = updates.autoResetWeeklyStock === true || updates.autoResetWeeklyStock === 'true'
    }
    Object.assign(farmer, updates)

    let oldImage = null
    let newImage = null
    if (req.file) {
        newImage = await saveImage(req.file) // photo goes to MongoDB GridFS
        oldImage = farmer.image
        farmer.image = newImage
    }

    try {
        await farmer.save()
    } catch (err) {
        await deleteImage(newImage)
        throw err
    }
    await deleteImage(oldImage)

    // contact person + phone live on the user account
    const userUpdates = {}
    if (typeof req.body.contactPerson === 'string' && req.body.contactPerson.trim()) userUpdates.name = req.body.contactPerson.trim()
    if (typeof req.body.phone === 'string') userUpdates.phone = req.body.phone.trim()
    let user = req.user
    if (Object.keys(userUpdates).length) {
        user = await userModel.findByIdAndUpdate(req.user._id, { $set: userUpdates }, { returnDocument: 'after', runValidators: true }).select('-pwd')
    }

    res.status(200).json({ success: true, msg: 'Your Profile has been updated', farmer, user })
}

// GET /farmer/reviews -> every review left on this farmer's products
const getMyReviews = async (req, res) => {
    const reviews = await reviewModel.find({ farmer: req.farmer._id })
        .populate('customer', 'name')
        .populate('product', 'name')
        .sort({ createdAt: -1 })

    const visible = reviews.filter((r) => r.status === 'VISIBLE')
    const average = visible.length ? Number((visible.reduce((s, r) => s + r.rating, 0) / visible.length).toFixed(1)) : 0

    res.status(200).json({ success: true, average, count: visible.length, reviews })
}

// GET /farmer/insights -> totals, pending, revenue, best sellers, busiest pickup slots
const getInsights = async (req, res) => {
    const farmerId = req.farmer._id

    const [statusRows, revenueRow, orderIds] = await Promise.all([
        orderModel.aggregate([{ $match: { farmer: farmerId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        orderModel.aggregate([
            { $match: { farmer: farmerId, status: 'COMPLETED' } },
            { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        ]),
        orderModel.find({ farmer: farmerId, status: { $in: ['PLACED', 'ACCEPTED', 'READY_FOR_PICKUP', 'COMPLETED'] } }).distinct('_id'),
    ])

    const byStatus = {}
    statusRows.forEach((r) => { byStatus[r._id] = r.count })
    const totalOrders = statusRows.reduce((s, r) => s + r.count, 0)

    const bestSellers = await orderItemModel.aggregate([
        { $match: { order: { $in: orderIds } } },
        { $group: { _id: '$product', name: { $first: '$productName' }, unit: { $first: '$unit' }, quantity: { $sum: '$quantity' }, revenue: { $sum: '$lineTotal' } } },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $project: { name: 1, unit: 1, quantity: 1, revenue: 1, imageType: { $arrayElemAt: ['$product.imageType', 0] } } },
    ])

    const slotRows = await orderModel.aggregate([
        { $match: { _id: { $in: orderIds } } },
        { $group: { _id: { start: '$pickupStart', end: '$pickupEnd' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
    ])
    const slotTotal = slotRows.reduce((s, r) => s + r.count, 0)

    res.status(200).json({
        success: true,
        totalOrders,
        pendingOrders: byStatus.PLACED || 0,
        acceptedOrders: byStatus.ACCEPTED || 0,
        readyOrders: byStatus.READY_FOR_PICKUP || 0,
        completedOrders: byStatus.COMPLETED || 0,
        cancelledOrders: (byStatus.DECLINED || 0) + (byStatus.CANCELLED_BY_CUSTOMER || 0) + (byStatus.CANCELLED_BY_FARMER || 0),
        revenue: revenueRow[0] ? Number(revenueRow[0].revenue.toFixed(2)) : 0,
        bestSellers,
        slots: slotRows.map((r) => ({
            label: (r._id.start || '?') + ' - ' + (r._id.end || '?'),
            count: r.count,
            share: slotTotal ? Math.round((r.count / slotTotal) * 100) : 0,
        })),
    })
}

export { getAllFarmer, getFarmerDirectory, getFarmerbyID, getFarmerProfile, updateFarmerProfile, getMyReviews, getInsights, ratingsByFarmer }
