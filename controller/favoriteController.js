import mongoose from 'mongoose'
import favoriteModel from '../model/favorite.model.js'
import farmerModel from '../model/farmer.model.js'
import productModel from '../model/product.model.js'
import marketModel from '../model/market.model.js'

const TYPES = ['FARMER', 'PRODUCT', 'MARKET']
const modelFor = { FARMER: farmerModel, PRODUCT: productModel, MARKET: marketModel }

const addFavorite = async (req, res) => {

    const { targetType, target } = req.body
    if (!TYPES.includes(targetType) || !mongoose.isValidObjectId(target)) {
        return res.status(400).json({ success: false, msg: 'Valid targetType (FARMER/PRODUCT/MARKET) and target id are required' })
    }

    const exists = await modelFor[targetType].exists({ _id: target })
    if (!exists) return res.status(404).json({ success: false, msg: targetType + ' not found' })

    try {
        const fav = await favoriteModel.create({ customer: req.user._id, targetType, target })
        res.status(201).json({ success: true, msg: 'Added to favorites', favorite: fav })
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, msg: 'Already in favorites' })
        throw err
    }
}

const removeFavorite = async (req, res) => {

    const { targetType, target } = req.body
    if (!TYPES.includes(targetType) || !mongoose.isValidObjectId(target)) {
        return res.status(400).json({ success: false, msg: 'Valid targetType and target id are required' })
    }

    const result = await favoriteModel.deleteOne({ customer: req.user._id, targetType, target })
    if (result.deletedCount === 0) return res.status(404).json({ success: false, msg: 'Not in favorites' })

    res.status(200).json({ success: true, msg: 'Removed from favorites' })
}

const getMyFavorites = async (req, res) => {

    const filter = { customer: req.user._id }
    if (req.query.type) {
        if (!TYPES.includes(req.query.type)) return res.status(400).json({ success: false, msg: 'Invalid type' })
        filter.targetType = req.query.type
    }

    const favorites = await favoriteModel.find(filter).sort({ createdAt: -1 })

    // target is a dynamic ref (no refPath), so populate manually per type
    const grouped = { FARMER: [], PRODUCT: [], MARKET: [] }
    for (const f of favorites) grouped[f.targetType].push(f.target)

    const [farmers, products, markets] = await Promise.all([
        farmerModel.find({ _id: { $in: grouped.FARMER } }).select('-user -statusReason'),
        productModel.find({ _id: { $in: grouped.PRODUCT } }),
        marketModel.find({ _id: { $in: grouped.MARKET } }),
    ])

    res.status(200).json({ success: true, farmers, products, markets })
}

export { addFavorite, removeFavorite, getMyFavorites }
