import mongoose from 'mongoose'
import cartModel from '../model/cart.model.js'
import productModel from '../model/product.model.js'
import farmerModel from '../model/farmer.model.js'

const getOrCreateCart = async (customerId) => {
    let cart = await cartModel.findOne({ customer: customerId })
    if (!cart) cart = await cartModel.create({ customer: customerId, items: [] })
    return cart
}

const populated = (cart) => cart.populate([
    { path: 'farmer', select: 'stallName' },
    { path: 'items.product', select: 'name price unit image imageType availability quantity isActive farmer category' },
])

const getCart = async (req, res) => {
    const cart = await getOrCreateCart(req.user._id)
    await populated(cart)
    res.status(200).json({ success: true, cart })
}

const addItem = async (req, res) => {

    const { productId, quantity } = req.body
    const qty = Number(quantity)

    if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ success: false, msg: 'Valid productId is required' })
    if (!(qty > 0)) return res.status(400).json({ success: false, msg: 'Quantity must be greater than 0' })

    const product = await productModel.findOne({ _id: productId, isActive: true, isBlocked: false })
    if (!product) return res.status(404).json({ success: false, msg: 'Product not found' })
    if (product.availability !== 'AVAILABLE') return res.status(409).json({ success: false, msg: 'Product is not available' })

    if (qty > product.quantity) return res.status(409).json({ success: false, msg: 'Only ' + product.quantity + ' ' + product.unit + ' of ' + product.name + ' left' })

    const farmer = await farmerModel.findById(product.farmer)
    if (!farmer || farmer.approvalStatus !== 'APPROVED') return res.status(409).json({ success: false, msg: 'Farmer is not currently active' })

    const cart = await getOrCreateCart(req.user._id)

    // one-farmer-per-cart rule from the SRS
    if (cart.items.length > 0 && String(cart.farmer) !== String(product.farmer)) {
        return res.status(409).json({ success: false, msg: 'Your cart already has items from a different farmer. Clear the cart first.' })
    }

    const existing = cart.items.find((i) => String(i.product) === String(productId))
    if (existing) existing.quantity = qty // sets to the given value, does not add on top
    else cart.items.push({ product: productId, quantity: qty })

    cart.farmer = product.farmer
    await cart.save()
    await populated(cart)

    res.status(200).json({ success: true, msg: 'Cart updated', cart })
}

const updateItem = async (req, res) => {

    const { productId, quantity } = req.body
    const qty = Number(quantity)

    if (!mongoose.isValidObjectId(productId) || !(qty > 0)) {
        return res.status(400).json({ success: false, msg: 'Valid productId and quantity > 0 are required' })
    }

    const cart = await getOrCreateCart(req.user._id)
    const item = cart.items.find((i) => String(i.product) === String(productId))
    if (!item) return res.status(404).json({ success: false, msg: 'Item not in cart' })

    const product = await productModel.findById(productId).select('name unit quantity')
    if (product && qty > product.quantity) return res.status(409).json({ success: false, msg: 'Only ' + product.quantity + ' ' + product.unit + ' of ' + product.name + ' left' })

    item.quantity = qty
    await cart.save()
    await populated(cart)

    res.status(200).json({ success: true, msg: 'Cart updated', cart })
}

const removeItem = async (req, res) => {

    const { productId } = req.body
    if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ success: false, msg: 'Valid productId is required' })

    const cart = await getOrCreateCart(req.user._id)
    cart.items = cart.items.filter((i) => String(i.product) !== String(productId))
    if (cart.items.length === 0) cart.farmer = undefined

    await cart.save()
    await populated(cart)

    res.status(200).json({ success: true, msg: 'Item removed', cart })
}

const clearCart = async (req, res) => {
    const cart = await getOrCreateCart(req.user._id)
    cart.items = []
    cart.farmer = undefined
    await cart.save()

    res.status(200).json({ success: true, msg: 'Cart cleared', cart })
}

export { getCart, addItem, updateItem, removeItem, clearCart }
