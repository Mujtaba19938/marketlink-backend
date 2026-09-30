import mongoose from 'mongoose'
import marketModel from '../model/market.model.js'
import farmerMarketModel from '../model/farmerMarket.model.js'
import farmerModel from '../model/farmer.model.js'
import orderModel from '../model/order.model.js'
import pick from '../utilities/pick.js'

const marketFields = ['name', 'description', 'address', 'city', 'latitude', 'longitude', 'operatingDays', 'timings', 'status']

// number of approved farmers actively selling at each market
const vendorCounts = async () => {
    const approved = await farmerModel.find({ approvalStatus: 'APPROVED' }).distinct('_id')
    const rows = await farmerMarketModel.aggregate([
        { $match: { isActive: true, farmer: { $in: approved } } },
        { $group: { _id: '$market', count: { $sum: 1 } } },
    ])
    const map = {}
    rows.forEach((r) => { map[String(r._id)] = r.count })
    return map
}

const withCounts = (markets, counts) => markets.map((m) => ({ ...m.toObject(), activeVendorsCount: counts[String(m._id)] || 0 }))

// ---------- public ----------
const getAllMarket = async (req, res) => {
    const [markets, counts] = await Promise.all([marketModel.find({ isActive: true }).sort({ name: 1 }), vendorCounts()])
    res.status(200).json({ success: true, markets: withCounts(markets, counts) })
}

// GET /getNearbyMarkets?lat=24.86&lng=67.00&km=25
// Markets sorted by distance from the user's location. The distance is calculated inside MongoDB with
// the haversine formula straight from each market's latitude/longitude fields, so coordinates edited
// in Atlas or from the admin panel are picked up immediately (no extra geo field to keep in sync).
const getNearbyMarkets = async (req, res) => {
    const lat = Number(req.query.lat)
    const lng = Number(req.query.lng)
    const km = Math.min(Math.max(Number(req.query.km) || 25, 1), 500)

    if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || req.query.lat === undefined || req.query.lng === undefined) {
        return res.status(400).json({ success: false, msg: 'Valid lat and lng query parameters are required' })
    }

    const toRad = (field) => ({ $degreesToRadians: field })
    const [markets, counts] = await Promise.all([
        marketModel.aggregate([
            { $match: { isActive: true, latitude: { $type: 'number' }, longitude: { $type: 'number' } } },
            { $addFields: {
                distanceKm: { $multiply: [6371, { $multiply: [2, { $asin: { $sqrt: { $add: [
                    { $pow: [{ $sin: { $divide: [{ $subtract: [toRad('$latitude'), toRad(lat)] }, 2] } }, 2] },
                    { $multiply: [
                        { $cos: toRad(lat) },
                        { $cos: toRad('$latitude') },
                        { $pow: [{ $sin: { $divide: [{ $subtract: [toRad('$longitude'), toRad(lng)] }, 2] } }, 2] },
                    ] },
                ] } } }] }] },
            } },
            { $match: { distanceKm: { $lte: km } } },
            { $sort: { distanceKm: 1 } },
            { $limit: 20 },
        ]),
        vendorCounts(),
    ])

    res.status(200).json({
        success: true,
        markets: markets.map((m) => ({ ...m, distanceKm: Number(m.distanceKm.toFixed(2)), activeVendorsCount: counts[String(m._id)] || 0 })),
    })
}

const getMarketbyID = async (req, res) => {
    const id = req.params.id
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, msg: 'Invalid market id' })

    const market = await marketModel.findOne({ _id: id, isActive: true })
    if (!market) return res.status(404).json({ success: false, msg: 'Market not found' })

    res.status(200).json({ success: true, market })
}

// ---------- admin ----------
const addmarket = async (req, res) => {
    const market = await marketModel.create(pick(req.body, marketFields))
    res.status(201).json({ success: true, msg: 'Market added', market: { ...market.toObject(), activeVendorsCount: 0 } })
}

const updatemarket = async (req, res) => {
    const { marketId } = req.body
    if (!mongoose.isValidObjectId(marketId)) return res.status(400).json({ success: false, msg: 'Valid marketId is required' })

    const market = await marketModel.findOne({ _id: marketId, isActive: true })
    if (!market) return res.status(404).json({ success: false, msg: 'Market not found' })

    Object.assign(market, pick(req.body, marketFields))
    await market.save()

    const counts = await vendorCounts()
    res.status(200).json({ success: true, msg: 'Market updated', market: withCounts([market], counts)[0] })
}

// removes a market. Markets that already have orders are archived (hidden everywhere) so order history stays valid.
const deletemarket = async (req, res) => {
    const { marketId } = req.body
    if (!mongoose.isValidObjectId(marketId)) return res.status(400).json({ success: false, msg: 'Valid marketId is required' })

    const market = await marketModel.findOne({ _id: marketId, isActive: true })
    if (!market) return res.status(404).json({ success: false, msg: 'Market not found' })

    const orders = await orderModel.countDocuments({ market: market._id })
    if (orders > 0) {
        market.isActive = false
        await market.save()
        await farmerMarketModel.updateMany({ market: market._id }, { $set: { isActive: false } })
        return res.status(200).json({ success: true, msg: 'Market removed (archived because it has order history)' })
    }

    await farmerMarketModel.deleteMany({ market: market._id })
    await marketModel.deleteOne({ _id: market._id })
    res.status(200).json({ success: true, msg: 'Market deleted' })
}

export { getAllMarket, getNearbyMarkets, getMarketbyID, addmarket, updatemarket, deletemarket }
