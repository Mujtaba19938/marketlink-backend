import mongoose from 'mongoose'
import farmerMarketModel from '../model/farmerMarket.model.js'
import marketModel from '../model/market.model.js'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const validDays = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every((d) => DAYS.includes(d))
const timeOk = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
const MARKET_FIELDS = 'name city address latitude longitude operatingDays timings status'

// optional stall pin / number fields shared by assign + update
const applyStallFields = (fm, body) => {
    if (body.stallNumber !== undefined) fm.stallNumber = String(body.stallNumber).trim()
    if (body.latitude !== undefined && body.latitude !== '' && body.latitude !== null) fm.latitude = Number(body.latitude)
    if (body.longitude !== undefined && body.longitude !== '' && body.longitude !== null) fm.longitude = Number(body.longitude)
}

// ---------- farmer ----------
const assignMarket = async (req, res) => {

    const { marketId, operatingDays, pickupStart, pickupEnd, cutoffHours } = req.body

    if (!mongoose.isValidObjectId(marketId)) return res.status(400).json({ success: false, msg: 'Valid marketId is required' })
    if (!validDays(operatingDays)) return res.status(400).json({ success: false, msg: 'operatingDays must be a non-empty array of MON..SUN' })
    if (!timeOk(pickupStart) || !timeOk(pickupEnd)) {
        return res.status(400).json({ success: false, msg: 'pickupStart and pickupEnd (HH:MM) are required' })
    }

    const market = await marketModel.findOne({ _id: marketId, isActive: true })
    if (!market) return res.status(404).json({ success: false, msg: 'Market not found' })

    try {
        const fm = new farmerMarketModel({
            farmer: req.farmer._id,
            market: marketId,
            operatingDays,
            pickupStart,
            pickupEnd,
            cutoffHours: cutoffHours !== undefined ? Number(cutoffHours) : 12,
        })
        applyStallFields(fm, req.body)
        await fm.save()
        await fm.populate('market', MARKET_FIELDS)
        res.status(201).json({ success: true, msg: 'Assigned to market', farmerMarket: fm })
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, msg: 'You are already assigned to this market' })
        throw err
    }
}

const updateAssignment = async (req, res) => {

    const { farmerMarketId, operatingDays, pickupStart, pickupEnd, cutoffHours, isActive } = req.body
    if (!mongoose.isValidObjectId(farmerMarketId)) return res.status(400).json({ success: false, msg: 'Valid farmerMarketId is required' })

    const fm = await farmerMarketModel.findOne({ _id: farmerMarketId, farmer: req.farmer._id })
    if (!fm) return res.status(404).json({ success: false, msg: 'Assignment not found' })

    if (operatingDays !== undefined) {
        if (!validDays(operatingDays)) return res.status(400).json({ success: false, msg: 'Invalid operatingDays' })
        fm.operatingDays = operatingDays
    }
    if (pickupStart !== undefined) {
        if (!timeOk(pickupStart)) return res.status(400).json({ success: false, msg: 'pickupStart must be HH:MM' })
        fm.pickupStart = pickupStart
    }
    if (pickupEnd !== undefined) {
        if (!timeOk(pickupEnd)) return res.status(400).json({ success: false, msg: 'pickupEnd must be HH:MM' })
        fm.pickupEnd = pickupEnd
    }
    if (cutoffHours !== undefined) fm.cutoffHours = Number(cutoffHours)
    if (isActive !== undefined) fm.isActive = !!isActive
    applyStallFields(fm, req.body)

    await fm.save()
    await fm.populate('market', MARKET_FIELDS)
    res.status(200).json({ success: true, msg: 'Assignment updated', farmerMarket: fm })
}

const getMyMarkets = async (req, res) => {
    const list = await farmerMarketModel.find({ farmer: req.farmer._id }).populate('market', MARKET_FIELDS)
    res.status(200).json({ success: true, farmerMarkets: list })
}

// ---------- public ----------
const getFarmerMarkets = async (req, res) => {
    const id = req.params.farmerId
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, msg: 'Invalid farmer id' })

    const list = await farmerMarketModel.find({ farmer: id, isActive: true })
        .populate({ path: 'market', match: { isActive: true }, select: MARKET_FIELDS })
    res.status(200).json({ success: true, farmerMarkets: list.filter((fm) => fm.market) })
}

export { assignMarket, updateAssignment, getMyMarkets, getFarmerMarkets }
