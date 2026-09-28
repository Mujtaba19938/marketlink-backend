// usage: allowRoles('ADMIN')  or  allowRoles('CUSTOMER','FARMER')
const allowRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, msg: 'You are not allowed to do this' })
        }
        next()
    }
}

export default allowRoles
