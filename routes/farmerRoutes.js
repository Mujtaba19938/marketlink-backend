import express from 'express'
import authMiddleware from '../middleware/jwtMiddleware.js'
import allowRoles from '../middleware/roleMiddleware.js'
import { loadFarmer, farmerApproved } from '../middleware/farmerMiddleware.js'
import upload from '../middleware/upload.js'

import { getFarmerProfile, updateFarmerProfile, getMyReviews, getInsights } from '../controller/farmerController.js'
import { getMyProducts, addproduct, updateproduct, setavailability, deleteproduct, applyWeeklyStock } from '../controller/productController.js'
import { assignMarket, updateAssignment, getMyMarkets } from '../controller/farmerMarketController.js'
import { addSlot, updateSlot, deleteSlot, getMySlots } from '../controller/pickupSlotController.js'
import { getFarmerOrders, acceptOrder, declineOrder, readyOrder, completeOrder, cancelByFarmer, verifyPickup } from '../controller/orderController.js'
import { respondReview } from '../controller/reviewController.js'

const router = express.Router()

// everything below: logged in + role FARMER + farmer profile loaded
router.use(authMiddleware, allowRoles('FARMER'), loadFarmer)

router.get('/getprofile', getFarmerProfile)
router.post('/updateprofile', upload.single('image'), updateFarmerProfile)

router.get('/getMyProducts', getMyProducts)
// only APPROVED farmers can publish / change products
router.post('/addproduct', farmerApproved, upload.single('image'), addproduct)
router.post('/updateproduct', farmerApproved, upload.single('image'), updateproduct)
router.post('/setavailability', farmerApproved, setavailability)
router.post('/deleteproduct', farmerApproved, deleteproduct)
router.post('/applyweeklystock', farmerApproved, applyWeeklyStock)

// market assignment + pickup slots (also require APPROVED)
router.post('/assignmarket', farmerApproved, assignMarket)
router.post('/updateassignment', farmerApproved, updateAssignment)
router.get('/getMyMarkets', getMyMarkets)

router.post('/addslot', farmerApproved, addSlot)
router.post('/updateslot', farmerApproved, updateSlot)
router.post('/deleteslot', farmerApproved, deleteSlot)
router.get('/getMySlots', getMySlots)

// orders
router.get('/orders/:status', getFarmerOrders)
router.post('/orders/accept', acceptOrder)
router.post('/orders/decline', declineOrder)
router.post('/orders/ready', readyOrder)
router.post('/orders/verifypickup', verifyPickup)
router.post('/orders/complete', completeOrder)
router.post('/orders/cancel', cancelByFarmer)

router.get('/reviews', getMyReviews)
router.post('/reviews/respond', respondReview)

router.get('/insights', getInsights)

export default router
