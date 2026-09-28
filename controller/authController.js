import userModel from '../model/user.model.js'
import farmerModel from '../model/farmer.model.js'
import hashPassword from '../utilities/hashpassword.js'
import comparePassword from '../utilities/comppassword.js'
import pick from '../utilities/pick.js'
import jwt from 'jsonwebtoken'

const emailOk = (email) => typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email)

const makeToken = (user) => {
    return jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' })
}

// never send the password hash back
const cleanUser = (user) => {
    const u = user.toObject()
    delete u.pwd
    return u
}

const checkRegisterData = (body) => {
    const { name, email, pwd } = body
    if (typeof name !== 'string' || !name.trim()) return 'Name is required'
    if (!emailOk(email)) return 'Valid email is required'
    if (typeof pwd !== 'string' || pwd.length < 8) return 'Password must be at least 8 characters'
    return null
}

const addcustomer = async (req, res) => {

    const error = checkRegisterData(req.body)
    if (error) return res.status(400).json({ success: false, msg: error })

    const { name, email, pwd, phone, address, city } = req.body

    const noofrec = await userModel.countDocuments({ email: email.toLowerCase() })
    if (noofrec > 0) {
        return res.status(409).json({ success: false, msg: "email id already exist please choose different" })
    }

    const hashpwd = await hashPassword(pwd)

    // role is fixed here, never taken from the request
    const user = await userModel.create({ name, email, pwd: hashpwd, phone, address, city, role: 'CUSTOMER' })

    res.status(201).json({
        success: true,
        msg: "Your registration has been completed",
        user: cleanUser(user)
    })
}

const addfarmer = async (req, res) => {

    const error = checkRegisterData(req.body)
    if (error) return res.status(400).json({ success: false, msg: error })

    const { name, email, pwd, phone, address, city, stallName, description, latitude, longitude } = req.body

    if (typeof stallName !== 'string' || !stallName.trim()) {
        return res.status(400).json({ success: false, msg: 'Stall name is required' })
    }

    const noofrec = await userModel.countDocuments({ email: email.toLowerCase() })
    if (noofrec > 0) {
        return res.status(409).json({ success: false, msg: "email id already exist please choose different" })
    }

    const hashpwd = await hashPassword(pwd)
    const user = await userModel.create({ name, email, pwd: hashpwd, phone, address, city, role: 'FARMER' })

    try {
        // approvalStatus defaults to PENDING
        await farmerModel.create({ user: user._id, stallName, description, address, city, latitude, longitude })
    } catch (err) {
        await userModel.deleteOne({ _id: user._id }) // no half-created farmer
        throw err
    }

    res.status(201).json({
        success: true,
        msg: "Registration completed. Please wait for admin approval",
        user: cleanUser(user)
    })
}

const authlogin = async (req, res) => {

    const { email, pwd } = req.body

    // must be strings, otherwise {"email":{"$ne":null}} would be a NoSQL injection
    if (typeof email !== 'string' || typeof pwd !== 'string') {
        return res.status(400).json({ success: false, msg: 'Email and password are required' })
    }

    const user = await userModel.findOne({ email: email.toLowerCase() })
    if (!user) return res.status(401).json({ success: false, msg: 'Invalid email or password' })

    const result = await comparePassword(pwd, user.pwd)
    if (!result) return res.status(401).json({ success: false, msg: 'Invalid email or password' })

    if (user.status !== 'ACTIVE') {
        return res.status(403).json({ success: false, msg: 'Your account is inactive' })
    }

    let farmer = null
    if (user.role === 'FARMER') farmer = await farmerModel.findOne({ user: user._id })

    res.status(200).json({
        success: true,
        msg: "Login successful",
        token: makeToken(user),
        user: cleanUser(user),
        farmer: farmer
    })
}

const getme = async (req, res) => {

    let farmer = null
    if (req.user.role === 'FARMER') farmer = await farmerModel.findOne({ user: req.user._id })

    res.status(200).json({ success: true, user: req.user, farmer: farmer })
}

const updateprofile = async (req, res) => {

    const updates = pick(req.body, ['name', 'phone', 'address', 'city'])

    if (updates.name !== undefined && (typeof updates.name !== 'string' || !updates.name.trim())) {
        return res.status(400).json({ success: false, msg: 'Name cannot be empty' })
    }

    // id comes from the token, not from the request body
    const user = await userModel.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
    ).select('-pwd')

    res.status(200).json({ success: true, msg: "Your Profile has been updated", user: user })
}

const changepwd = async (req, res) => {

    const { oldPwd, newPwd } = req.body

    if (typeof oldPwd !== 'string' || typeof newPwd !== 'string' || newPwd.length < 8) {
        return res.status(400).json({ success: false, msg: 'Old password and a new password (min 8 characters) are required' })
    }

    const user = await userModel.findById(req.user._id)
    const result = await comparePassword(oldPwd, user.pwd)
    if (!result) return res.status(400).json({ success: false, msg: 'Old password is wrong' })

    user.pwd = await hashPassword(newPwd)
    await user.save()

    res.status(200).json({ success: true, msg: "Your Password has been updated" })
}

export { addcustomer, addfarmer, authlogin, getme, updateprofile, changepwd }
