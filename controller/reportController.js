import orderModel from '../model/order.model.js'
import orderItemModel from '../model/orderItem.model.js'

const ordersSummary = async (req, res) => {
    const rows = await orderModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    const summary = {}
    rows.forEach((r) => { summary[r._id] = r.count })
    res.status(200).json({ success: true, summary })
}

const revenueSummary = async (req, res) => {
    const [row] = await orderModel.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 } } },
    ])
    res.status(200).json({ success: true, totalRevenue: row ? row.totalRevenue : 0, totalOrders: row ? row.totalOrders : 0 })
}

const topFarmers = async (req, res) => {
    const rows = await orderModel.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $group: { _id: '$farmer', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'farmers', localField: '_id', foreignField: '_id', as: 'farmer' } },
        { $unwind: '$farmer' },
        { $project: { stallName: '$farmer.stallName', revenue: 1, orders: 1 } },
    ])
    res.status(200).json({ success: true, topFarmers: rows })
}

const topProducts = async (req, res) => {
    const validOrders = await orderModel.find({ status: { $in: ['PLACED', 'ACCEPTED', 'READY_FOR_PICKUP', 'COMPLETED'] } }).distinct('_id')
    const rows = await orderItemModel.aggregate([
        { $match: { order: { $in: validOrders } } },
        { $group: { _id: '$product', totalQuantity: { $sum: '$quantity' }, totalRevenue: { $sum: '$lineTotal' }, name: { $first: '$productName' } } },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
    ])
    res.status(200).json({ success: true, topProducts: rows })
}

export { ordersSummary, revenueSummary, topFarmers, topProducts }
