import express from 'express'
import authMiddleware from '../middleware/jwtMiddleware.js'
import allowRoles from '../middleware/roleMiddleware.js'
import {
    getAllUser, updateuserstatus, getCustomers, getFarmers, approvefarmer, rejectfarmer, suspendfarmer,
    getModerationQueue, dismissModeration, removeModeration,
    getAnnouncements, addAnnouncement, toggleAnnouncement,
    getContactMessages, markContactRead, getOverview,
} from '../controller/adminController.js'
import { addmarket, updatemarket, deletemarket } from '../controller/marketController.js'
import { getAdminCategories, addcategory, updatecategory, deletecategory } from '../controller/categoryController.js'
import { ordersSummary, revenueSummary, topFarmers, topProducts } from '../controller/reportController.js'
import { moderateReview } from '../controller/reviewController.js'

const router = express.Router()

// everything below: logged in + role ADMIN
router.use(authMiddleware, allowRoles('ADMIN'))

router.get('/overview', getOverview)

router.get('/getAllUser/:page/:pagesize', getAllUser)
router.post('/updateuserstatus', updateuserstatus)
router.get('/customers', getCustomers)

router.get('/getFarmers/:status', getFarmers)
router.post('/approvefarmer', approvefarmer)
router.post('/rejectfarmer', rejectfarmer)
router.post('/suspendfarmer', suspendfarmer)

router.post('/addmarket', addmarket)
router.post('/updatemarket', updatemarket)
router.post('/deletemarket', deletemarket)

router.get('/categories', getAdminCategories)
router.post('/addcategory', addcategory)
router.post('/updatecategory', updatecategory)
router.post('/deletecategory', deletecategory)

router.get('/reports/orderssummary', ordersSummary)
router.get('/reports/revenuesummary', revenueSummary)
router.get('/reports/topfarmers', topFarmers)
router.get('/reports/topproducts', topProducts)

router.get('/moderation', getModerationQueue)
router.post('/moderation/dismiss', dismissModeration)
router.post('/moderation/remove', removeModeration)
router.post('/moderatereview', moderateReview)

router.get('/announcements', getAnnouncements)
router.post('/addannouncement', addAnnouncement)
router.post('/toggleannouncement', toggleAnnouncement)

router.get('/contactmessages', getContactMessages)
router.post('/contactmessages/read', markContactRead)

export default router
