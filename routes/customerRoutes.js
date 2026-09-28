import express from 'express'
import authMiddleware from '../middleware/jwtMiddleware.js'
import allowRoles from '../middleware/roleMiddleware.js'
import { getCart, addItem, updateItem, removeItem, clearCart } from '../controller/cartController.js'
import { createOrder, getMyOrders, getOrderById, cancelOrder, modifyOrder, reorder } from '../controller/orderController.js'
import { addFavorite, removeFavorite, getMyFavorites } from '../controller/favoriteController.js'
import { addReview } from '../controller/reviewController.js'

const router = express.Router()

// everything below: logged in + role CUSTOMER
router.use(authMiddleware, allowRoles('CUSTOMER'))

router.get('/cart', getCart)
router.post('/cart/additem', addItem)
router.post('/cart/updateitem', updateItem)
router.post('/cart/removeitem', removeItem)
router.post('/cart/clear', clearCart)

router.post('/orders', createOrder)
router.get('/orders', getMyOrders)
router.get('/orders/:id', getOrderById)
router.post('/orders/cancel', cancelOrder)
router.post('/orders/modify', modifyOrder)
router.post('/orders/:id/reorder', reorder)

router.post('/favorites', addFavorite)
router.post('/favorites/remove', removeFavorite)
router.get('/favorites', getMyFavorites)

router.post('/reviews', addReview)

export default router
