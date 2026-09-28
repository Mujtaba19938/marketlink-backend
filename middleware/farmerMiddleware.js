import farmerModel from '../model/farmer.model.js'

// attaches the logged-in farmer's profile to req.farmer
const loadFarmer = async (req, res, next) => {
    const farmer = await farmerModel.findOne({ user: req.user._id })
    if (!farmer) return res.status(404).json({ success: false, msg: 'Farmer profile not found' })
    req.farmer = farmer
    next()
}

// restricted operations (publish products, receive orders) need APPROVED
const farmerApproved = (req, res, next) => {
    if (req.farmer.approvalStatus !== 'APPROVED') {
        return res.status(403).json({
            success: false,
            msg: 'Your farmer account is ' + req.farmer.approvalStatus + '. Only APPROVED farmers can do this',
        })
    }
    next()
}

export { loadFarmer, farmerApproved }
