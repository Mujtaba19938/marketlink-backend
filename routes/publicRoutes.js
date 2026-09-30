import express from 'express'
import { sendImage } from '../utilities/imageStore.js'
import { getAllMarket, getNearbyMarkets, getMarketbyID } from '../controller/marketController.js'
import { getAllCategory } from '../controller/categoryController.js'
import { getAllFarmer, getFarmerDirectory, getFarmerbyID } from '../controller/farmerController.js'
import { getAllProduct, getCatalog, getProductbyID, getProductbyFarmer } from '../controller/productController.js'
import { getFarmerMarkets } from '../controller/farmerMarketController.js'
import { getAvailableSlots } from '../controller/pickupSlotController.js'
import { getProductReviews } from '../controller/reviewController.js'
import { getActiveAnnouncements, submitContact } from '../controller/publicController.js'

const router = express.Router()

router.get('/getAllMarket', getAllMarket)
router.get('/getNearbyMarkets', getNearbyMarkets)
router.get('/getMarketbyID/:id', getMarketbyID)

router.get('/getAllCategory', getAllCategory)

router.get('/getAllFarmer/:page/:pagesize', getAllFarmer)
router.get('/getFarmerDirectory', getFarmerDirectory)
router.get('/getFarmerbyID/:id', getFarmerbyID)
router.get('/getFarmerMarkets/:farmerId', getFarmerMarkets)

router.get('/getAllProduct/:page/:pagesize/:sortby/:cat', getAllProduct)
router.get('/getCatalog', getCatalog)
router.get('/getProductbyID/:id', getProductbyID)
router.get('/getProductbyFarmer/:farmerId', getProductbyFarmer)
router.get('/getProductReviews/:productId', getProductReviews)

router.get('/getPickupSlots/:farmerMarketId', getAvailableSlots)

router.get('/getAnnouncements', getActiveAnnouncements)
router.post('/contact', submitContact)

// photos are stored in MongoDB GridFS (see utilities/imageStore.js)
router.get('/images/:imageName', (req, res) => sendImage(req.params.imageName, res))

export default router
