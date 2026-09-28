import mongoose from 'mongoose'
import categoryModel from '../model/category.model.js'
import productModel from '../model/product.model.js'
import pick from '../utilities/pick.js'

const categoryFields = ['name', 'description', 'isActive', 'badgeColor', 'iconName']

// active product count per category
const productCounts = async () => {
    const rows = await productModel.aggregate([
        { $match: { isActive: true, isBlocked: false } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
    ])
    const map = {}
    rows.forEach((r) => { map[String(r._id)] = r.count })
    return map
}

const withCounts = (cats, counts) => cats.map((c) => ({ ...c.toObject(), itemCount: counts[String(c._id)] || 0 }))

// ---------- public ----------
const getAllCategory = async (req, res) => {
    const [categories, counts] = await Promise.all([categoryModel.find({ isActive: true }).sort({ name: 1 }), productCounts()])
    res.status(200).json({ success: true, categories: withCounts(categories, counts) })
}

// ---------- admin ----------
const getAdminCategories = async (req, res) => {
    const [categories, counts] = await Promise.all([categoryModel.find().sort({ name: 1 }), productCounts()])
    res.status(200).json({ success: true, categories: withCounts(categories, counts) })
}

const addcategory = async (req, res) => {
    const category = await categoryModel.create(pick(req.body, categoryFields))
    res.status(201).json({ success: true, msg: 'Category added', category: { ...category.toObject(), itemCount: 0 } })
}

const updatecategory = async (req, res) => {
    const { categoryId } = req.body
    if (!mongoose.isValidObjectId(categoryId)) return res.status(400).json({ success: false, msg: 'Valid categoryId is required' })

    const category = await categoryModel.findById(categoryId)
    if (!category) return res.status(404).json({ success: false, msg: 'Category not found' })

    Object.assign(category, pick(req.body, categoryFields))
    await category.save()

    const counts = await productCounts()
    res.status(200).json({ success: true, msg: 'Category updated', category: withCounts([category], counts)[0] })
}

// cannot delete if products still use it (deactivate instead)
const deletecategory = async (req, res) => {
    const { categoryId } = req.body
    if (!mongoose.isValidObjectId(categoryId)) return res.status(400).json({ success: false, msg: 'Valid categoryId is required' })

    const used = await productModel.countDocuments({ category: categoryId })
    if (used > 0) {
        return res.status(409).json({ success: false, msg: 'Category is used by ' + used + ' product(s). Deactivate it instead' })
    }

    const result = await categoryModel.deleteOne({ _id: categoryId })
    if (result.deletedCount === 0) return res.status(404).json({ success: false, msg: 'Category not found' })

    res.status(200).json({ success: true, msg: 'Category deleted' })
}

export { getAllCategory, getAdminCategories, addcategory, updatecategory, deletecategory }
