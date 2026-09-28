import mongoose from 'mongoose'
import cartModel from '../model/cart.model.js'
import productModel from '../model/product.model.js'
import farmerModel from '../model/farmer.model.js'
import farmerMarketModel from '../model/farmerMarket.model.js'
import marketModel from '../model/market.model.js'
import pickupSlotModel from '../model/pickupSlot.model.js'
import orderModel from '../model/order.model.js'
import orderItemModel from '../model/orderItem.model.js'
import reviewModel from '../model/review.model.js'
import notify from '../utilities/notify.js'
import { restoreStock, takeStock } from '../utilities/stock.js'
import { dayOfWeek, combineDateTime, subtractHours } from '../utilities/dateHelpers.js'

const dateOk = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
const ACTIVE_STATUSES = ['PLACED', 'ACCEPTED', 'READY_FOR_PICKUP', 'COMPLETED']

// attaches order items (and, for customers, which items were already reviewed) to a list of orders
const withItems = async (orders, customerId) => {
    const ids = orders.map((o) => o._id)
    const items = await orderItemModel.find({ order: { $in: ids } })

    let reviewedIds = new Set()
    if (customerId) {
        const reviews = await reviewModel.find({ customer: customerId, order: { $in: ids } }).select('orderItem')
        reviewedIds = new Set(reviews.map((r) => String(r.orderItem)))
    }

    return orders.map((o) => ({
        ...o.toObject(),
        items: items
            .filter((i) => String(i.order) === String(o._id))
            .map((i) => ({ ...i.toObject(), reviewed: reviewedIds.has(String(i._id)) })),
    }))
}

// ============ CUSTOMER ============

const createOrder = async (req, res) => {

    const { farmerMarketId, pickupSlotId, pickupDate, notes } = req.body

    if (!mongoose.isValidObjectId(farmerMarketId) || !mongoose.isValidObjectId(pickupSlotId) || !dateOk(pickupDate)) {
        return res.status(400).json({ success: false, msg: 'Valid farmerMarketId, pickupSlotId and pickupDate (YYYY-MM-DD) are required' })
    }

    const cart = await cartModel.findOne({ customer: req.user._id })
    if (!cart || cart.items.length === 0) return res.status(400).json({ success: false, msg: 'Your cart is empty' })

    const farmer = await farmerModel.findById(cart.farmer)
    if (!farmer || farmer.approvalStatus !== 'APPROVED') {
        return res.status(409).json({ success: false, msg: 'This farmer is not currently accepting orders' })
    }

    const fm = await farmerMarketModel.findOne({ _id: farmerMarketId, farmer: cart.farmer, isActive: true })
    if (!fm) return res.status(404).json({ success: false, msg: 'Market assignment not found for this farmer' })

    const market = await marketModel.findOne({ _id: fm.market, isActive: true })
    if (!market || market.status === 'closed') return res.status(409).json({ success: false, msg: 'This market is currently closed' })

    const dow = dayOfWeek(pickupDate)
    if (!fm.operatingDays.includes(dow)) return res.status(400).json({ success: false, msg: 'Farmer does not operate on ' + dow + ' at this market' })

    const slot = await pickupSlotModel.findOne({ _id: pickupSlotId, farmerMarket: farmerMarketId, isActive: true })
    if (!slot || slot.dayOfWeek !== dow) return res.status(404).json({ success: false, msg: 'Pickup slot not valid for this date' })

    const pickupDateTime = combineDateTime(pickupDate, slot.startTime)
    const cutoffAt = subtractHours(pickupDateTime, fm.cutoffHours)
    if (new Date() > cutoffAt) return res.status(409).json({ success: false, msg: 'Cutoff time has passed for this pickup date' })

    const booked = await orderModel.countDocuments({
        pickupSlot: slot._id,
        pickupDate: new Date(pickupDate + 'T00:00:00'),
        status: { $in: ACTIVE_STATUSES },
    })
    if (booked >= slot.capacity) return res.status(409).json({ success: false, msg: 'This pickup slot is full, please choose another' })

    // ---- stock handling ----
    // NOT using a Mongoose multi-document transaction here on purpose: transactions need a
    // replica set, and a student's local standalone MongoDB usually isn't one. Instead each
    // product is decremented with ONE atomic conditional update (quantity only drops if
    // still >= requested), so two customers racing for the last item can never both succeed.
    // If a later item in the cart fails, everything decremented so far is rolled back manually.
    const decremented = []
    const orderItemsData = []
    let totalAmount = 0

    for (const item of cart.items) {
        const updated = await takeStock(item.product, item.quantity)

        if (!updated) {
            await restoreStock(decremented)
            const failedProduct = await productModel.findById(item.product).select('name')
            return res.status(409).json({
                success: false,
                msg: 'Not enough stock for ' + (failedProduct ? failedProduct.name : 'a product') + '. Please update your cart.',
            })
        }

        decremented.push({ productId: item.product, qty: item.quantity })

        const lineTotal = Number((updated.price * item.quantity).toFixed(2))
        totalAmount += lineTotal

        orderItemsData.push({
            product: updated._id, productName: updated.name, unit: updated.unit,
            price: updated.price, quantity: item.quantity, lineTotal,
        })
    }

    let order
    try {
        order = await orderModel.create({
            customer: req.user._id, farmer: cart.farmer, market: fm.market,
            pickupSlot: slot._id, pickupDate: new Date(pickupDate + 'T00:00:00'),
            pickupStart: slot.startTime, pickupEnd: slot.endTime, cutoffAt,
            totalAmount: Number(totalAmount.toFixed(2)),
            notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : undefined,
        })
        await orderItemModel.insertMany(orderItemsData.map((i) => ({ ...i, order: order._id })))
    } catch (err) {
        await restoreStock(decremented) // order/orderItem save failed -> undo the stock decrement
        throw err
    }

    cart.items = []
    cart.farmer = undefined
    await cart.save()

    await notify(farmer.user, 'New order received', 'You have a new pre-order worth Rs ' + order.totalAmount + ' for ' + pickupDate, 'ORDER')
    await notify(req.user._id, 'Order placed', 'Your pre-order with ' + farmer.stallName + ' was placed. Pay at pickup on ' + pickupDate + ' (' + slot.startTime + '-' + slot.endTime + ').', 'ORDER')

    const [full] = await withItems([await order.populate([
        { path: 'farmer', select: 'stallName' },
        { path: 'market', select: 'name address city latitude longitude' },
    ])], req.user._id)

    res.status(201).json({ success: true, msg: 'Order placed', order: full })
}

const getMyOrders = async (req, res) => {
    const orders = await orderModel.find({ customer: req.user._id })
        .populate('farmer', 'stallName')
        .populate('market', 'name address city latitude longitude')
        .sort({ createdAt: -1 })
    res.status(200).json({ success: true, orders: await withItems(orders, req.user._id) })
}

const getOrderById = async (req, res) => {
    const id = req.params.id
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, msg: 'Invalid order id' })

    const order = await orderModel.findOne({ _id: id, customer: req.user._id })
        .populate('farmer', 'stallName')
        .populate('market', 'name address city latitude longitude')
    if (!order) return res.status(404).json({ success: false, msg: 'Order not found' })

    const [full] = await withItems([order], req.user._id)
    res.status(200).json({ success: true, order: full, items: full.items })
}

const cancelOrder = async (req, res) => {

    const { orderId, reason } = req.body
    if (!mongoose.isValidObjectId(orderId)) return res.status(400).json({ success: false, msg: 'Valid orderId is required' })

    const order = await orderModel.findOne({ _id: orderId, customer: req.user._id })
    if (!order) return res.status(404).json({ success: false, msg: 'Order not found' })

    if (!['PLACED', 'ACCEPTED'].includes(order.status)) {
        return res.status(409).json({ success: false, msg: 'Order cannot be cancelled from status ' + order.status })
    }
    if (new Date() > order.cutoffAt) {
        return res.status(409).json({ success: false, msg: 'Cutoff time has passed, this order can no longer be cancelled' })
    }

    order.status = 'CANCELLED_BY_CUSTOMER'
    order.cancelReason = reason || ''
    await order.save()

    const items = await orderItemModel.find({ order: order._id })
    await restoreStock(items.map((i) => ({ productId: i.product, qty: i.quantity })))

    const farmerDoc = await farmerModel.findById(order.farmer)
    if (farmerDoc) await notify(farmerDoc.user, 'Order cancelled', 'Customer cancelled order #' + String(order._id).slice(-6).toUpperCase(), 'ORDER')

    res.status(200).json({ success: true, msg: 'Order cancelled', order })
}

// POST /customer/orders/modify  { orderId, items: [{ orderItemId, quantity }] }
// changes quantities before the cutoff; quantity 0 removes the line. Stock moves by the difference only.
const modifyOrder = async (req, res) => {

    const { orderId, items } = req.body
    if (!mongoose.isValidObjectId(orderId) || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, msg: 'Valid orderId and items are required' })
    }

    const order = await orderModel.findOne({ _id: orderId, customer: req.user._id })
    if (!order) return res.status(404).json({ success: false, msg: 'Order not found' })

    if (!['PLACED', 'ACCEPTED'].includes(order.status)) {
        return res.status(409).json({ success: false, msg: 'Order cannot be modified from status ' + order.status })
    }
    if (new Date() > order.cutoffAt) {
        return res.status(409).json({ success: false, msg: 'Cutoff time has passed, this order can no longer be modified' })
    }

    const orderItems = await orderItemModel.find({ order: order._id })
    const changes = []

    for (const change of items) {
        const oi = orderItems.find((i) => String(i._id) === String(change.orderItemId))
        const qty = Number(change.quantity)
        if (!oi) return res.status(404).json({ success: false, msg: 'Order item not found' })
        if (!(qty >= 0)) return res.status(400).json({ success: false, msg: 'Quantity cannot be negative' })
        if (qty !== oi.quantity) changes.push({ oi, qty, delta: qty - oi.quantity })
    }

    const remaining = orderItems.filter((oi) => {
        const c = changes.find((ch) => String(ch.oi._id) === String(oi._id))
        return c ? c.qty > 0 : true
    })
    if (remaining.length === 0) return res.status(400).json({ success: false, msg: 'An order needs at least one item. Cancel the order instead.' })
    if (changes.length === 0) return res.status(200).json({ success: true, msg: 'Nothing changed', order })

    // 1) take extra stock first (can fail); roll back on failure
    const taken = []
    for (const ch of changes.filter((c) => c.delta > 0)) {
        const ok = await takeStock(ch.oi.product, ch.delta)
        if (!ok) {
            await restoreStock(taken)
            return res.status(409).json({ success: false, msg: 'Not enough stock to increase ' + ch.oi.productName })
        }
        taken.push({ productId: ch.oi.product, qty: ch.delta })
    }

    // 2) give back stock for reduced / removed lines
    await restoreStock(changes.filter((c) => c.delta < 0).map((c) => ({ productId: c.oi.product, qty: -c.delta })))

    // 3) save the new quantities
    for (const ch of changes) {
        if (ch.qty === 0) {
            await orderItemModel.deleteOne({ _id: ch.oi._id })
        } else {
            ch.oi.quantity = ch.qty
            ch.oi.lineTotal = Number((ch.oi.price * ch.qty).toFixed(2))
            await ch.oi.save()
        }
    }

    const fresh = await orderItemModel.find({ order: order._id })
    order.totalAmount = Number(fresh.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2))
    await order.save()

    const farmerDoc = await farmerModel.findById(order.farmer)
    if (farmerDoc) await notify(farmerDoc.user, 'Order modified', 'Customer changed quantities on order #' + String(order._id).slice(-6).toUpperCase(), 'ORDER')

    const populated = await orderModel.findById(order._id)
        .populate('farmer', 'stallName')
        .populate('market', 'name address city latitude longitude')
    const [full] = await withItems([populated], req.user._id)

    res.status(200).json({ success: true, msg: 'Order updated', order: full })
}

// re-adds an old order's items to the cart; skips items whose product is no longer available
const reorder = async (req, res) => {

    const id = req.params.id
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, msg: 'Invalid order id' })

    const order = await orderModel.findOne({ _id: id, customer: req.user._id })
    if (!order) return res.status(404).json({ success: false, msg: 'Order not found' })

    const cart = await cartModel.findOne({ customer: req.user._id }) || await cartModel.create({ customer: req.user._id, items: [] })
    if (cart.items.length > 0 && String(cart.farmer) !== String(order.farmer)) {
        return res.status(409).json({ success: false, msg: 'Your cart has items from a different farmer. Clear it first.' })
    }

    const items = await orderItemModel.find({ order: order._id })
    const skipped = []

    for (const oi of items) {
        const product = await productModel.findOne({ _id: oi.product, isActive: true, isBlocked: false, availability: 'AVAILABLE' })
        if (!product) { skipped.push(oi.productName); continue }

        const existing = cart.items.find((i) => String(i.product) === String(product._id))
        const wanted = (existing ? existing.quantity : 0) + oi.quantity
        const qty = Math.min(wanted, product.quantity) // never put more in the cart than is in stock
        if (existing) existing.quantity = qty
        else cart.items.push({ product: product._id, quantity: qty })
    }

    if (cart.items.length > 0) cart.farmer = order.farmer
    await cart.save()
    await cart.populate([
        { path: 'farmer', select: 'stallName' },
        { path: 'items.product', select: 'name price unit image imageType availability quantity isActive farmer category' },
    ])

    res.status(200).json({
        success: true,
        msg: skipped.length ? 'Added to cart. Unavailable now: ' + skipped.join(', ') : 'Added to cart',
        cart,
    })
}

// ============ FARMER ============

const validTransition = (from, to) => {
    const map = {
        PLACED: ['ACCEPTED', 'DECLINED'],
        ACCEPTED: ['READY_FOR_PICKUP', 'CANCELLED_BY_FARMER'],
        READY_FOR_PICKUP: ['COMPLETED'],
    }
    return (map[from] || []).includes(to)
}

const getFarmerOrders = async (req, res) => {

    const allStatuses = ACTIVE_STATUSES.concat(['DECLINED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_FARMER', 'EXPIRED'])
    const filter = { farmer: req.farmer._id }

    if (req.params.status !== 'all') {
        if (!allStatuses.includes(req.params.status)) return res.status(400).json({ success: false, msg: 'Invalid status' })
        filter.status = req.params.status
    }

    const orders = await orderModel.find(filter).populate('customer', 'name phone').populate('market', 'name').sort({ createdAt: -1 })
    res.status(200).json({ success: true, orders: await withItems(orders) })
}

const changeOrderStatus = async (req, res, newStatus, needReason) => {

    const { orderId, reason } = req.body
    if (!mongoose.isValidObjectId(orderId)) return res.status(400).json({ success: false, msg: 'Valid orderId is required' })
    if (needReason && (typeof reason !== 'string' || !reason.trim())) return res.status(400).json({ success: false, msg: 'Reason is required' })

    const order = await orderModel.findOne({ _id: orderId, farmer: req.farmer._id })
    if (!order) return res.status(404).json({ success: false, msg: 'Order not found' })

    if (!validTransition(order.status, newStatus)) {
        return res.status(409).json({ success: false, msg: 'Cannot change order from ' + order.status + ' to ' + newStatus })
    }

    order.status = newStatus
    if (newStatus === 'DECLINED') order.declineReason = reason.trim()
    if (newStatus === 'CANCELLED_BY_FARMER') order.cancelReason = reason.trim()
    if (newStatus === 'COMPLETED') order.paymentStatus = 'PAID' // paid in person at pickup
    await order.save()

    if (['DECLINED', 'CANCELLED_BY_FARMER'].includes(newStatus)) {
        const items = await orderItemModel.find({ order: order._id })
        await restoreStock(items.map((i) => ({ productId: i.product, qty: i.quantity })))
    }

    const code = '#' + String(order._id).slice(-6).toUpperCase()
    const messages = {
        ACCEPTED: 'Order ' + code + ' was accepted by ' + req.farmer.stallName + '.',
        DECLINED: 'Order ' + code + ' was declined: ' + (reason || '').trim(),
        READY_FOR_PICKUP: 'Order ' + code + ' is packed and ready for pickup at ' + req.farmer.stallName + '.',
        COMPLETED: 'Order ' + code + ' was picked up. Thank you! You can now rate your items.',
        CANCELLED_BY_FARMER: 'Order ' + code + ' was cancelled by the farmer: ' + (reason || '').trim(),
    }
    await notify(order.customer, newStatus === 'READY_FOR_PICKUP' ? 'Ready for pickup' : 'Order update', messages[newStatus], 'ORDER')

    const populated = await orderModel.findById(order._id).populate('customer', 'name phone').populate('market', 'name')
    const [full] = await withItems([populated])
    res.status(200).json({ success: true, msg: 'Order is now ' + newStatus, order: full })
}

const acceptOrder = (req, res) => changeOrderStatus(req, res, 'ACCEPTED', false)
const declineOrder = (req, res) => changeOrderStatus(req, res, 'DECLINED', true)
const readyOrder = (req, res) => changeOrderStatus(req, res, 'READY_FOR_PICKUP', false)
const completeOrder = (req, res) => changeOrderStatus(req, res, 'COMPLETED', false)
const cancelByFarmer = (req, res) => changeOrderStatus(req, res, 'CANCELLED_BY_FARMER', true)

export {
    createOrder, getMyOrders, getOrderById, cancelOrder, modifyOrder, reorder,
    getFarmerOrders, acceptOrder, declineOrder, readyOrder, completeOrder, cancelByFarmer,
}
