import 'dotenv/config'
import '../config/dns.js'
import mongoose from 'mongoose'
import userModel from '../model/user.model.js'
import hashPassword from '../utilities/hashpassword.js'

// run once:  npm run seedadmin
await mongoose.connect(process.env.MONGO_URI)

const email = (process.env.ADMIN_EMAIL || '').toLowerCase()
const pwd = process.env.ADMIN_PASSWORD

if (!email || !pwd) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env')
    process.exit(1)
}

const exists = await userModel.countDocuments({ email })
if (exists > 0) {
    console.log('Admin already exists')
} else {
    await userModel.create({ name: 'Admin', email, pwd: await hashPassword(pwd), role: 'ADMIN' })
    console.log('Admin created: ' + email)
}

await mongoose.disconnect()
