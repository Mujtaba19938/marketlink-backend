import mongoose from 'mongoose'
import productModel from '../model/product.model.js'
import categoryModel from '../model/category.model.js'
import farmerModel from '../model/farmer.model.js'
import removeFile from '../utilities/removefile.js'
import { notifyRestock } from '../utilities/stock.js'

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// multipart form fields arrive as strings; '' must not become 0
const toNumber = (v) => (v === '' || v === null ? NaN : Number(v))

const IMAGE_TYPES = ['cabbage', 'kale', 'broccoli', 'celery', 'carrot', 'tomato', 'pepper', 'mushroom']

// returns 400 and deletes the image that multer already saved
const badRequest = (req, res, msg) => {
    if (req.file) removeFile(req.file.filename)
    return res.status(400).json({ success: false, msg })
}

// ================= PUBLIC =================

// /getAllProduct/:page/:pagesize/:sortby/:cat   (cat = category id or 'all')
// optional query: ?search=tomato&minPrice=10&maxPrice=500&farmer=<id>
const getAllProduct = async (req, res) => {

    const page = Math.max(parseInt(req.params.page) || 1, 1)
    const pagesize = Math.min(Math.max(parseInt(req.params.pagesize) || 10, 1), 50)
    const { sortby, cat } = req.params
    const { search, minPrice, maxPrice, farmer } = req.query

    const sortOptions = {
        new: { createdAt: -1 },
        priceLow: { price: 1 },
        priceHigh: { price: -1 },
        name: { name: 1 },
    }
    const sort = sortOptions[sortby] || sortOptions.new

    // only products of APPROVED farmers are visible
    const approvedFarmers = await farmerModel.find({ approvalStatus: 'APPROVED' }).distinct('_id')

    const filter = { isActive: true, isBlocked: false, farmer: { $in: approvedFarmers } }

    if (cat !== 'all') {
        if (!mongoose.isValidObjectId(cat)) return res.status(400).json({ success: false, msg: 'Invalid category id' })
        filter.category = cat
    }

    if (farmer !== undefined) {
        if (!mongoose.isValidObjectId(farmer)) return res.status(400).json({ success: false, msg: 'Invalid farmer id' })
        filter.farmer = approvedFarmers.some((id) => String(id) === String(farmer)) ? farmer : null
    }

    if (typeof search === 'string' && search.trim()) {
        filter.name = { $regex: escapeRegex(search.trim()), $options: 'i' }
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
        filter.price = {}
        if (minPrice !== undefined) filter.price.$gte = toNumber(minPrice)
        if (maxPrice !== undefined) filter.price.$lte = toNumber(maxPrice)
        if (Object.values(filter.price).some((v) => Number.isNaN(v))) {
            return res.status(400).json({ success: false, msg: 'minPrice / maxPrice must be numbers' })
        }
    }

    const total = await productModel.countDocuments(filter)
    const products = await productModel.find(filter)
        .populate('farmer', 'stallName city')
        .populate('category', 'name')
        .sort(sort)
        .skip((page - 1) * pagesize)
        .limit(pagesize)

    res.status(200).json({ success: true, total, page, pages: Math.ceil(total / pagesize), products })
}

// GET /getCatalog -> every visible product in one call (shop, home page and dashboard grid filter client-side)
const getCatalog = async (req, res) => {
    const approvedFarmers = await farmerModel.find({ approvalStatus: 'APPROVED' }).distinct('_id')
    const products = await productModel.find({ isActive: true, isBlocked: false, farmer: { $in: approvedFarmers } })
        .populate('farmer', 'stallName city address')
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .limit(1000)

    res.status(200).json({ success: true, products })
}

const getProductbyID = async (req, res) => {

    const id = req.params.id
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, msg: 'Invalid product id' })

    const product = await productModel.findOne({ _id: id, isActive: true, isBlocked: false })
        .populate('farmer', 'stallName city address latitude longitude approvalStatus')
        .populate('category', 'name')

    if (!product || product.farmer.approvalStatus !== 'APPROVED') {
        return res.status(404).json({ success: false, msg: 'Product not found' })
    }

    res.status(200).json({ success: true, product })
}

const getProductbyFarmer = async (req, res) => {

    const id = req.params.farmerId
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, msg: 'Invalid farmer id' })

    const farmer = await farmerModel.findOne({ _id: id, approvalStatus: 'APPROVED' })
    if (!farmer) return res.status(404).json({ success: false, msg: 'Farmer not found' })

    const products = await productModel.find({ farmer: id, isActive: true, isBlocked: false }).populate('category', 'name')

    res.status(200).json({ success: true, products })
}

// ================= FARMER (req.farmer is set by loadFarmer) =================

const getMyProducts = async (req, res) => {
    const products = await productModel.find({ farmer: req.farmer._id, isActive: true })
        .populate('category', 'name')
        .sort({ createdAt: -1 })

    res.status(200).json({ success: true, products })
}

// needs: loadFarmer + farmerApproved + upload.single('image')
const addproduct = async (req, res) => {

    const { name, categoryId, price, unit, quantity, description, imageType, weeklyStock, availability } = req.body

    if (!mongoose.isValidObjectId(categoryId)) return badRequest(req, res, 'Valid categoryId is required')

    const category = await categoryModel.findOne({ _id: categoryId, isActive: true })
    if (!category) return badRequest(req, res, 'Category not found')

    const qty = toNumber(quantity)
    let avail = ['AVAILABLE', 'SOLD_OUT', 'UNAVAILABLE'].includes(availability) ? availability : 'AVAILABLE'
    if (qty === 0 && avail === 'AVAILABLE') avail = 'SOLD_OUT'

    // farmer id comes from the logged-in user, never from the body
    const product = await productModel.create({
        farmer: req.farmer._id,
        category: categoryId,
        name,
        description,
        price: toNumber(price),
        unit,
        quantity: qty,
        weeklyStock: weeklyStock !== undefined && weeklyStock !== '' ? toNumber(weeklyStock) : 0,
        imageType: IMAGE_TYPES.includes(imageType) ? imageType : 'cabbage',
        availability: avail,
        image: req.file ? req.file.filename : null,
    })

    await product.populate('category', 'name')
    res.status(201).json({ success: true, msg: 'Product added', product })
}

const updateproduct = async (req, res) => {

    const { productId, name, categoryId, price, unit, quantity, description, imageType, weeklyStock, availability } = req.body

    if (!mongoose.isValidObjectId(productId)) return badRequest(req, res, 'Valid productId is required')

    // ownership check: product must belong to THIS farmer
    const product = await productModel.findOne({ _id: productId, farmer: req.farmer._id, isActive: true })
    if (!product) {
        if (req.file) removeFile(req.file.filename)
        return res.status(404).json({ success: false, msg: 'Product not found' })
    }

    if (categoryId !== undefined) {
        if (!mongoose.isValidObjectId(categoryId)) return badRequest(req, res, 'Invalid categoryId')
        const category = await categoryModel.findOne({ _id: categoryId, isActive: true })
        if (!category) return badRequest(req, res, 'Category not found')
        product.category = categoryId
    }

    // listing text changed -> goes back into the admin moderation queue
    if ((name !== undefined && name !== product.name) || (description !== undefined && description !== product.description)) {
        product.moderated = false
    }

    const wasOutOfStock = product.quantity <= 0 || product.availability !== 'AVAILABLE'

    if (name !== undefined) product.name = name
    if (description !== undefined) product.description = description
    if (unit !== undefined) product.unit = unit
    if (price !== undefined) product.price = toNumber(price)
    if (quantity !== undefined) product.quantity = toNumber(quantity)
    if (weeklyStock !== undefined && weeklyStock !== '') product.weeklyStock = toNumber(weeklyStock)
    if (imageType !== undefined && IMAGE_TYPES.includes(imageType)) product.imageType = imageType
    if (availability !== undefined && ['AVAILABLE', 'SOLD_OUT', 'UNAVAILABLE'].includes(availability)) product.availability = availability

    // quantity decides SOLD_OUT <-> AVAILABLE unless the farmer explicitly chose UNAVAILABLE
    if (product.availability !== 'UNAVAILABLE') {
        product.availability = product.quantity > 0 ? 'AVAILABLE' : 'SOLD_OUT'
    }

    let oldImage = null
    if (req.file) {
        oldImage = product.image
        product.image = req.file.filename
    }

    await product.save()
    removeFile(oldImage) // delete the replaced image only after save succeeded

    if (wasOutOfStock && product.availability === 'AVAILABLE' && product.quantity > 0) await notifyRestock(product)

    await product.populate('category', 'name')
    res.status(200).json({ success: true, msg: 'Product updated', product })
}

const setavailability = async (req, res) => {

    const { productId, availability } = req.body

    if (!mongoose.isValidObjectId(productId) || !['AVAILABLE', 'SOLD_OUT', 'UNAVAILABLE'].includes(availability)) {
        return res.status(400).json({ success: false, msg: 'Valid productId and availability are required' })
    }

    const product = await productModel.findOne({ _id: productId, farmer: req.farmer._id, isActive: true })
    if (!product) return res.status(404).json({ success: false, msg: 'Product not found' })

    const wasAvailable = product.availability === 'AVAILABLE' && product.quantity > 0
    product.availability = availability

    // marking AVAILABLE with nothing on hand refills from the weekly template (or 1 if no template)
    if (availability === 'AVAILABLE' && product.quantity <= 0) {
        product.quantity = product.weeklyStock > 0 ? product.weeklyStock : 1
    }
    await product.save()

    if (!wasAvailable && availability === 'AVAILABLE') await notifyRestock(product)

    await product.populate('category', 'name')
    res.status(200).json({ success: true, msg: 'Product is now ' + availability, product })
}

// soft delete: old orders still point to this product
const deleteproduct = async (req, res) => {

    const { productId } = req.body
    if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ success: false, msg: 'Valid productId is required' })

    const product = await productModel.findOneAndUpdate(
        { _id: productId, farmer: req.farmer._id },
        { $set: { isActive: false } }
    )
    if (!product) return res.status(404).json({ success: false, msg: 'Product not found' })

    res.status(200).json({ success: true, msg: 'Product removed' })
}

// resets every product that has a weekly template back to its template quantity
const applyWeeklyStockFor = async (farmerId) => {
    const products = await productModel.find({ farmer: farmerId, isActive: true, weeklyStock: { $gt: 0 } })
    let count = 0
    for (const p of products) {
        const wasOut = p.quantity <= 0 || p.availability === 'SOLD_OUT'
        p.quantity = p.weeklyStock
        if (p.availability === 'SOLD_OUT') p.availability = 'AVAILABLE'
        await p.save()
        if (wasOut && p.availability === 'AVAILABLE') await notifyRestock(p)
        count++
    }
    await farmerModel.updateOne({ _id: farmerId }, { $set: { lastStockResetAt: new Date() } })
    return count
}

// POST /farmer/applyweeklystock
const applyWeeklyStock = async (req, res) => {
    const count = await applyWeeklyStockFor(req.farmer._id)
    const products = await productModel.find({ farmer: req.farmer._id, isActive: true }).populate('category', 'name').sort({ createdAt: -1 })
    res.status(200).json({ success: true, msg: count + ' product(s) reset to weekly stock', products })
}

export {
    getAllProduct, getCatalog, getProductbyID, getProductbyFarmer,
    getMyProducts, addproduct, updateproduct, setavailability, deleteproduct,
    applyWeeklyStock, applyWeeklyStockFor,
}
