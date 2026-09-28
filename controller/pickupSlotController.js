import mongoose from 'mongoose'
import pickupSlotModel from '../model/pickupSlot.model.js'
import farmerMarketModel from '../model/farmerMarket.model.js'
import orderModel from '../model/order.model.js'
import { dayOfWeek, combineDateTime, subtractHours } from '../utilities/dateHelpers.js'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const ACTIVE_STATUSES = ['PLACED', 'ACCEPTED', 'READY_FOR_PICKUP', 'COMPLETED']
const timeOk = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
const dateOk = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

// ---------- farmer ----------
const addSlot = async (req, res) => {

    const { farmerMarketId, dayOfWeek: dow, startTime, endTime, capacity } = req.body

    if (!mongoose.isValidObjectId(farmerMarketId)) return res.status(400).json({ success: false, msg: 'Valid farmerMarketId is required' })
    if (!DAYS.includes(dow)) return res.status(400).json({ success: false, msg: 'dayOfWeek must be one of ' + DAYS.join(',') })
    if (!timeOk(startTime) || !timeOk(endTime)) return res.status(400).json({ success: false, msg: 'startTime/endTime must be HH:MM' })
    if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1) return res.status(400).json({ success: false, msg: 'capacity must be a positive integer' })

    const fm = await farmerMarketModel.findOne({ _id: farmerMarketId, farmer: req.farmer._id })
    if (!fm) return res.status(404).json({ success: false, msg: 'Market assignment not found' })
    if (!fm.operatingDays.includes(dow)) return res.status(400).json({ success: false, msg: 'You do not operate on ' + dow + ' at this market' })

    if (startTime >= endTime) return res.status(400).json({ success: false, msg: 'endTime must be after startTime' })

    const slot = await pickupSlotModel.create({ farmerMarket: farmerMarketId, dayOfWeek: dow, startTime, endTime, capacity: Number(capacity) })
    await slot.populate('farmerMarket', 'market')
    res.status(201).json({ success: true, msg: 'Pickup slot added', slot })
}

const updateSlot = async (req, res) => {

    const { slotId, startTime, endTime, capacity, isActive } = req.body
    if (!mongoose.isValidObjectId(slotId)) return res.status(400).json({ success: false, msg: 'Valid slotId is required' })

    const slot = await pickupSlotModel.findById(slotId).populate('farmerMarket')
    if (!slot || !slot.farmerMarket || String(slot.farmerMarket.farmer) !== String(req.farmer._id)) {
        return res.status(404).json({ success: false, msg: 'Slot not found' })
    }

    if (startTime !== undefined) {
        if (!timeOk(startTime)) return res.status(400).json({ success: false, msg: 'Invalid startTime' })
        slot.startTime = startTime
    }
    if (endTime !== undefined) {
        if (!timeOk(endTime)) return res.status(400).json({ success: false, msg: 'Invalid endTime' })
        slot.endTime = endTime
    }
    if (capacity !== undefined) {
        if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1) return res.status(400).json({ success: false, msg: 'Invalid capacity' })
        slot.capacity = Number(capacity)
    }
    if (isActive !== undefined) slot.isActive = !!isActive
    if (slot.startTime >= slot.endTime) return res.status(400).json({ success: false, msg: 'endTime must be after startTime' })

    await slot.save()
    await slot.populate('farmerMarket', 'market')
    res.status(200).json({ success: true, msg: 'Slot updated', slot })
}

// removes a slot; slots that already have orders are only deactivated so order history stays intact
const deleteSlot = async (req, res) => {

    const { slotId } = req.body
    if (!mongoose.isValidObjectId(slotId)) return res.status(400).json({ success: false, msg: 'Valid slotId is required' })

    const slot = await pickupSlotModel.findById(slotId).populate('farmerMarket')
    if (!slot || !slot.farmerMarket || String(slot.farmerMarket.farmer) !== String(req.farmer._id)) {
        return res.status(404).json({ success: false, msg: 'Slot not found' })
    }

    const used = await orderModel.countDocuments({ pickupSlot: slot._id })
    if (used > 0) {
        slot.isActive = false
        await slot.save()
        return res.status(200).json({ success: true, msg: 'Slot has past orders, so it was deactivated instead', deactivated: true })
    }

    await pickupSlotModel.deleteOne({ _id: slot._id })
    res.status(200).json({ success: true, msg: 'Slot deleted' })
}

const getMySlots = async (req, res) => {
    const fmIds = await farmerMarketModel.find({ farmer: req.farmer._id }).distinct('_id')
    const slots = await pickupSlotModel.find({ farmerMarket: { $in: fmIds } }).populate('farmerMarket', 'market')
    res.status(200).json({ success: true, slots })
}

// ---------- public ----------
// GET /api/getPickupSlots/:farmerMarketId?date=YYYY-MM-DD -> slots + remaining capacity for that date
const getAvailableSlots = async (req, res) => {

    const { farmerMarketId } = req.params
    const { date } = req.query

    if (!mongoose.isValidObjectId(farmerMarketId)) return res.status(400).json({ success: false, msg: 'Invalid farmerMarketId' })
    if (!dateOk(date)) return res.status(400).json({ success: false, msg: 'date query param (YYYY-MM-DD) is required' })

    const fm = await farmerMarketModel.findOne({ _id: farmerMarketId, isActive: true })
    if (!fm) return res.status(404).json({ success: false, msg: 'Market assignment not found' })

    const dow = dayOfWeek(date)
    if (!fm.operatingDays.includes(dow)) return res.status(200).json({ success: true, slots: [], msg: 'Not an operating day' })

    const slots = await pickupSlotModel.find({ farmerMarket: farmerMarketId, dayOfWeek: dow, isActive: true })

    const result = []
    for (const slot of slots) {
        const booked = await orderModel.countDocuments({
            pickupSlot: slot._id,
            pickupDate: new Date(date + 'T00:00:00'),
            status: { $in: ACTIVE_STATUSES },
        })
        const cutoffAt = subtractHours(combineDateTime(date, slot.startTime), fm.cutoffHours)
        result.push({ ...slot.toObject(), remaining: Math.max(slot.capacity - booked, 0), cutoffAt, cutoffPassed: new Date() > cutoffAt })
    }

    res.status(200).json({ success: true, slots: result })
}

export { addSlot, updateSlot, deleteSlot, getMySlots, getAvailableSlots }
