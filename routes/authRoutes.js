import express from 'express'
import { addcustomer, addfarmer, authlogin, getme, updateprofile, changepwd } from '../controller/authController.js'
import authMiddleware from '../middleware/jwtMiddleware.js'

const router = express.Router()

router.post('/addcustomer', addcustomer)
router.post('/addfarmer', addfarmer)
router.post('/authlogin', authlogin)

router.get('/getme', authMiddleware, getme)
router.post('/updateprofile', authMiddleware, updateprofile)
router.post('/changepwd', authMiddleware, changepwd)

export default router
