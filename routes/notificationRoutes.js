import express from 'express'
import authMiddleware from '../middleware/jwtMiddleware.js'
import { getMyNotifications, markRead, markAllRead } from '../controller/notificationController.js'

const router = express.Router()

// any logged-in role (customer, farmer or admin) reads their own notifications
router.use(authMiddleware)

router.get('/', getMyNotifications)
router.post('/markread', markRead)
router.post('/markallread', markAllRead)

export default router
