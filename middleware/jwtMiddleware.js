import jwt from 'jsonwebtoken'
import userModel from '../model/user.model.js'

// checks token, loads the user from DB (so INACTIVE users are blocked immediately)
const authMiddleware = async (req, res, next) => {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: 'Token missing' })
    }

    let decoded
    try {
        decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET)
    } catch (err) {
        return res.status(401).json({ success: false, msg: 'Invalid or expired token' })
    }

    const user = await userModel.findById(decoded._id).select('-pwd')
    if (!user) return res.status(401).json({ success: false, msg: 'User not found' })
    if (user.status !== 'ACTIVE') return res.status(403).json({ success: false, msg: 'Your account is inactive' })

    req.user = user
    next()
}

export default authMiddleware
