import productModel from '../model/product.model.js'
import favoriteModel from '../model/favorite.model.js'
import notificationModel from '../model/notification.model.js'

// tells every customer who favorited this product that it is back in stock (best-effort)
const notifyRestock = async (product) => {
    try {
        const favs = await favoriteModel.find({ targetType: 'PRODUCT', target: product._id }).select('customer')
        if (favs.length === 0) return
        await notificationModel.insertMany(favs.map((f) => ({
            user: f.customer,
            title: product.name + ' is back in stock',
            message: product.quantity + ' ' + product.unit + ' available now. Pre-order before it sells out.',
            type: 'SYSTEM',
        })))
    } catch (err) {
        console.error('restock notification failed:', err.message)
    }
}

// keeps availability in line with quantity:
//   quantity 0            -> SOLD_OUT
//   quantity > 0 and was SOLD_OUT -> AVAILABLE (+ restock alert)
// UNAVAILABLE is a manual farmer choice and is never changed here
const syncAvailability = async (productId) => {
    const product = await productModel.findById(productId)
    if (!product) return null

    if (product.quantity <= 0 && product.availability === 'AVAILABLE') {
        product.availability = 'SOLD_OUT'
        await product.save()
    } else if (product.quantity > 0 && product.availability === 'SOLD_OUT') {
        product.availability = 'AVAILABLE'
        await product.save()
        await notifyRestock(product)
    }
    return product
}

// puts quantities back (cancelled / declined order, failed checkout) and fixes availability
const restoreStock = async (items) => {
    for (const it of items) {
        await productModel.updateOne({ _id: it.productId }, { $inc: { quantity: it.qty } })
        await syncAvailability(it.productId)
    }
}

// takes quantity from a product only if enough is left (atomic, safe for two customers racing)
const takeStock = async (productId, qty) => {
    const updated = await productModel.findOneAndUpdate(
        { _id: productId, isActive: true, isBlocked: false, availability: 'AVAILABLE', quantity: { $gte: qty } },
        { $inc: { quantity: -qty } },
        { returnDocument: 'after' }
    )
    if (updated && updated.quantity === 0) await syncAvailability(updated._id)
    return updated
}

export { notifyRestock, syncAvailability, restoreStock, takeStock }
