import 'dotenv/config'
import '../config/dns.js'
import 'dotenv/config'
import mongoose from 'mongoose'
import userModel from '../model/user.model.js'
import farmerModel from '../model/farmer.model.js'
import marketModel from '../model/market.model.js'
import categoryModel from '../model/category.model.js'
import farmerMarketModel from '../model/farmerMarket.model.js'
import pickupSlotModel from '../model/pickupSlot.model.js'
import productModel from '../model/product.model.js'
import orderModel from '../model/order.model.js'
import orderItemModel from '../model/orderItem.model.js'
import reviewModel from '../model/review.model.js'
import hashPassword from '../utilities/hashpassword.js'
import path from 'path'
import { saveImageFromDisk } from '../utilities/imageStore.js'

// Run once (or as many times as you want, it's idempotent):
//   npm run seeddemodata
// Fills categories, markets, 2 approved farmers + 1 pending farmer,
// their market assignments, pickup slots, products, one test customer, the admin account
// and one completed order with a review -
// enough linked data for the frontend AND for the chatbot to answer from.

await mongoose.connect(process.env.MONGO_URI)
console.log('Connected. Seeding demo data...')

// ---------- admin (same as npm run seedadmin) ----------
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@marketlink.com').toLowerCase()
const adminPwd = process.env.ADMIN_PASSWORD || 'Admin@12345'
if (!(await userModel.exists({ email: adminEmail }))) {
    await userModel.create({ name: 'Admin', email: adminEmail, pwd: await hashPassword(adminPwd), role: 'ADMIN' })
}
console.log('Admin ready:', adminEmail)

// ---------- categories ----------
const categoryNames = ['Vegetables', 'Fruits', 'Dairy', 'Grains', 'Baked Goods']
const categories = {}
for (const name of categoryNames) {
    categories[name] = await categoryModel.findOneAndUpdate(
        { name }, { $setOnInsert: { name, description: name + ' from local farmers', isActive: true } },
        { upsert: true, returnDocument: 'after' }
    )
}
console.log('Categories ready:', Object.keys(categories).join(', '))

// ---------- markets ----------
const marketDefs = [
    {
        name: 'Saddar Sunday Market', description: 'Weekend farmers market in Saddar',
        address: 'Zaibunnisa Street, Saddar', city: 'Karachi',
        latitude: 24.8608, longitude: 67.0104, operatingDays: ['FRI', 'SAT', 'SUN'], timings: '08:00 - 14:00',
    },
    {
        name: 'Clifton Farmers Market', description: 'Fresh produce market near Clifton beach',
        address: 'Block 2, Clifton', city: 'Karachi',
        latitude: 24.8138, longitude: 67.0300, operatingDays: ['SAT', 'SUN'], timings: '07:30 - 13:00',
    },
    {
        name: 'DHA Phase 6 Sunday Bazaar', description: 'Weekly organic and fresh produce bazaar in DHA',
        address: 'Khayaban-e-Bukhari, DHA Phase 6', city: 'Karachi',
        latitude: 24.7968, longitude: 67.0655, operatingDays: ['SUN'], timings: '07:00 - 13:00',
    },
    {
        name: 'Gulshan-e-Iqbal Weekly Bazaar', description: 'Large weekly vegetable and fruit bazaar near Maskan Chowrangi',
        address: 'Block 13-D, Gulshan-e-Iqbal', city: 'Karachi',
        latitude: 24.9183, longitude: 67.0971, operatingDays: ['TUE', 'SAT'], timings: '08:00 - 20:00',
    },
    {
        name: 'North Nazimabad Friday Bazaar', description: 'Friday bazaar near Hyderi Market',
        address: 'Block H, North Nazimabad', city: 'Karachi',
        latitude: 24.9357, longitude: 67.0402, operatingDays: ['FRI'], timings: '09:00 - 21:00',
    },
    {
        name: 'PECHS Tariq Road Market', description: 'Neighbourhood fresh market off Tariq Road',
        address: 'Block 2, PECHS', city: 'Karachi',
        latitude: 24.8722, longitude: 67.0614, operatingDays: ['THU', 'SUN'], timings: '08:00 - 18:00',
    },
    {
        name: 'Federal B Area Monday Bazaar', description: 'Monday bazaar near Ayesha Manzil',
        address: 'Block 7, Federal B Area', city: 'Karachi',
        latitude: 24.9268, longitude: 67.0652, operatingDays: ['MON'], timings: '10:00 - 22:00',
    },
    {
        name: 'Gulistan-e-Jauhar Weekly Market', description: 'Mid-week produce market for Jauhar and nearby blocks',
        address: 'Block 7, Gulistan-e-Jauhar', city: 'Karachi',
        latitude: 24.9121, longitude: 67.1327, operatingDays: ['WED'], timings: '09:00 - 21:00',
    },
    {
        name: 'Malir Cantt Bachat Bazaar', description: 'Farm-gate prices from growers in Malir',
        address: 'Malir Cantonment', city: 'Karachi',
        latitude: 24.9415, longitude: 67.2031, operatingDays: ['WED', 'SAT'], timings: '07:00 - 14:00',
    },
    {
        name: 'Korangi Sunday Bazaar', description: 'Sunday bazaar serving Korangi and Landhi',
        address: 'Sector 5, Korangi', city: 'Karachi',
        latitude: 24.8305, longitude: 67.1352, operatingDays: ['SUN'], timings: '08:00 - 16:00',
    },
]
const markets = {}
for (const m of marketDefs) {
    markets[m.name] = await marketModel.findOneAndUpdate(
        { name: m.name }, { $setOnInsert: { ...m, isActive: true } },
        { upsert: true, returnDocument: 'after' }
    )
}
console.log('Markets ready:', Object.keys(markets).join(', '))

// ---------- farmers (user + farmer profile) ----------
const farmerDefs = [
    {
        email: 'ali.farm@marketlink.com', pwd: 'Farmer123!', name: 'Ali Hassan',
        stallName: 'Ali Farm', description: 'Organic vegetables and seasonal fruit',
        address: 'Malir, Karachi', city: 'Karachi', latitude: 24.8918, longitude: 67.1922,
        approvalStatus: 'APPROVED',
    },
    {
        email: 'sabzighar@marketlink.com', pwd: 'Farmer123!', name: 'Bilal Sabzighar',
        stallName: 'Sabzi Ghar', description: 'Daily vegetables, dairy and grains',
        address: 'Gadap Town, Karachi', city: 'Karachi', latitude: 25.0170, longitude: 67.2570,
        approvalStatus: 'APPROVED',
    },
    {
        email: 'freshroots@marketlink.com', pwd: 'Farmer123!', name: 'Sana Roots',
        stallName: 'Fresh Roots', description: 'New stall, awaiting admin approval',
        address: 'Gulshan, Karachi', city: 'Karachi', latitude: 24.9200, longitude: 67.0822,
        approvalStatus: 'PENDING', // kept pending on purpose to test the approval flow
    },
]

const farmers = {}
for (const f of farmerDefs) {
    let user = await userModel.findOne({ email: f.email })
    if (!user) {
        user = await userModel.create({
            name: f.name, email: f.email, pwd: await hashPassword(f.pwd),
            role: 'FARMER', status: 'ACTIVE', phone: '0300-0000000', address: f.address, city: f.city,
        })
    }

    let farmer = await farmerModel.findOne({ user: user._id })
    if (!farmer) {
        farmer = await farmerModel.create({
            user: user._id, stallName: f.stallName, description: f.description,
            address: f.address, city: f.city, latitude: f.latitude, longitude: f.longitude,
            approvalStatus: f.approvalStatus,
        })
    } else if (farmer.approvalStatus !== f.approvalStatus) {
        farmer.approvalStatus = f.approvalStatus
        await farmer.save()
    }

    farmers[f.stallName] = farmer
}
console.log('Farmers ready:', Object.keys(farmers).join(', '))

// ---------- farmerMarket assignments ----------
const assignmentDefs = [
    { stallName: 'Ali Farm', marketName: 'Saddar Sunday Market', operatingDays: ['FRI', 'SAT'], pickupStart: '10:00', pickupEnd: '13:00', cutoffHours: 2, stallNumber: 'Stall #14', latitude: 24.8611, longitude: 67.0101 },
    { stallName: 'Ali Farm', marketName: 'Clifton Farmers Market', operatingDays: ['SAT'], pickupStart: '09:00', pickupEnd: '12:00', cutoffHours: 3, stallNumber: 'Stall #3', latitude: 24.8141, longitude: 67.0296 },
    { stallName: 'Sabzi Ghar', marketName: 'Saddar Sunday Market', operatingDays: ['SAT', 'SUN'], pickupStart: '11:00', pickupEnd: '14:00', cutoffHours: 4, stallNumber: 'Stall #22', latitude: 24.8605, longitude: 67.0109 },
    { stallName: 'Ali Farm', marketName: 'DHA Phase 6 Sunday Bazaar', operatingDays: ['SUN'], pickupStart: '08:00', pickupEnd: '12:00', cutoffHours: 12, stallNumber: 'Stall #7', latitude: 24.7971, longitude: 67.0651 },
    { stallName: 'Ali Farm', marketName: 'Gulshan-e-Iqbal Weekly Bazaar', operatingDays: ['TUE'], pickupStart: '16:00', pickupEnd: '19:00', cutoffHours: 6, stallNumber: 'Stall #31', latitude: 24.9186, longitude: 67.0968 },
    { stallName: 'Ali Farm', marketName: 'Malir Cantt Bachat Bazaar', operatingDays: ['WED', 'SAT'], pickupStart: '08:00', pickupEnd: '12:00', cutoffHours: 12, stallNumber: 'Stall #2', latitude: 24.9418, longitude: 67.2027 },
    { stallName: 'Sabzi Ghar', marketName: 'North Nazimabad Friday Bazaar', operatingDays: ['FRI'], pickupStart: '17:00', pickupEnd: '20:00', cutoffHours: 6, stallNumber: 'Stall #18', latitude: 24.9360, longitude: 67.0398 },
    { stallName: 'Sabzi Ghar', marketName: 'PECHS Tariq Road Market', operatingDays: ['THU', 'SUN'], pickupStart: '10:00', pickupEnd: '14:00', cutoffHours: 8, stallNumber: 'Stall #9', latitude: 24.8725, longitude: 67.0611 },
    { stallName: 'Sabzi Ghar', marketName: 'Federal B Area Monday Bazaar', operatingDays: ['MON'], pickupStart: '17:00', pickupEnd: '21:00', cutoffHours: 6, stallNumber: 'Stall #12', latitude: 24.9271, longitude: 67.0649 },
    { stallName: 'Sabzi Ghar', marketName: 'Gulistan-e-Jauhar Weekly Market', operatingDays: ['WED'], pickupStart: '16:00', pickupEnd: '20:00', cutoffHours: 6, stallNumber: 'Stall #5', latitude: 24.9124, longitude: 67.1323 },
    { stallName: 'Sabzi Ghar', marketName: 'Korangi Sunday Bazaar', operatingDays: ['SUN'], pickupStart: '09:00', pickupEnd: '13:00', cutoffHours: 12, stallNumber: 'Stall #26', latitude: 24.8308, longitude: 67.1348 },
]

const assignments = {}
for (const a of assignmentDefs) {
    const key = a.stallName + '@' + a.marketName
    let fm = await farmerMarketModel.findOne({ farmer: farmers[a.stallName]._id, market: markets[a.marketName]._id })
    if (!fm) {
        fm = await farmerMarketModel.create({
            farmer: farmers[a.stallName]._id, market: markets[a.marketName]._id,
            operatingDays: a.operatingDays, pickupStart: a.pickupStart, pickupEnd: a.pickupEnd,
            cutoffHours: a.cutoffHours, stallNumber: a.stallNumber, latitude: a.latitude, longitude: a.longitude, isActive: true,
        })
    }
    assignments[key] = fm
}
console.log('Farmer-market assignments ready:', Object.keys(assignments).join(', '))

// ---------- pickup slots ----------
const slotDefs = [
    { key: 'Ali Farm@Saddar Sunday Market', dayOfWeek: 'FRI', startTime: '10:00', endTime: '11:00', capacity: 10 },
    { key: 'Ali Farm@Saddar Sunday Market', dayOfWeek: 'SAT', startTime: '10:00', endTime: '11:00', capacity: 8 },
    { key: 'Ali Farm@Clifton Farmers Market', dayOfWeek: 'SAT', startTime: '09:00', endTime: '10:00', capacity: 5 },
    { key: 'Sabzi Ghar@Saddar Sunday Market', dayOfWeek: 'SAT', startTime: '11:00', endTime: '12:00', capacity: 6 },
    { key: 'Sabzi Ghar@Saddar Sunday Market', dayOfWeek: 'SUN', startTime: '11:00', endTime: '12:00', capacity: 6 },
    { key: 'Ali Farm@DHA Phase 6 Sunday Bazaar', dayOfWeek: 'SUN', startTime: '08:00', endTime: '10:00', capacity: 10 },
    { key: 'Ali Farm@DHA Phase 6 Sunday Bazaar', dayOfWeek: 'SUN', startTime: '10:00', endTime: '12:00', capacity: 10 },
    { key: 'Ali Farm@Gulshan-e-Iqbal Weekly Bazaar', dayOfWeek: 'TUE', startTime: '16:00', endTime: '19:00', capacity: 12 },
    { key: 'Ali Farm@Malir Cantt Bachat Bazaar', dayOfWeek: 'WED', startTime: '08:00', endTime: '12:00', capacity: 8 },
    { key: 'Ali Farm@Malir Cantt Bachat Bazaar', dayOfWeek: 'SAT', startTime: '08:00', endTime: '12:00', capacity: 8 },
    { key: 'Sabzi Ghar@North Nazimabad Friday Bazaar', dayOfWeek: 'FRI', startTime: '17:00', endTime: '20:00', capacity: 12 },
    { key: 'Sabzi Ghar@PECHS Tariq Road Market', dayOfWeek: 'THU', startTime: '10:00', endTime: '14:00', capacity: 8 },
    { key: 'Sabzi Ghar@PECHS Tariq Road Market', dayOfWeek: 'SUN', startTime: '10:00', endTime: '14:00', capacity: 8 },
    { key: 'Sabzi Ghar@Federal B Area Monday Bazaar', dayOfWeek: 'MON', startTime: '17:00', endTime: '21:00', capacity: 10 },
    { key: 'Sabzi Ghar@Gulistan-e-Jauhar Weekly Market', dayOfWeek: 'WED', startTime: '16:00', endTime: '20:00', capacity: 10 },
    { key: 'Sabzi Ghar@Korangi Sunday Bazaar', dayOfWeek: 'SUN', startTime: '09:00', endTime: '13:00', capacity: 10 },
]

for (const s of slotDefs) {
    const fm = assignments[s.key]
    const exists = await pickupSlotModel.findOne({ farmerMarket: fm._id, dayOfWeek: s.dayOfWeek, startTime: s.startTime })
    if (!exists) {
        await pickupSlotModel.create({
            farmerMarket: fm._id, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime,
            capacity: s.capacity, isActive: true,
        })
    }
}
console.log('Pickup slots ready')

// ---------- products ----------
const productDefs = [
    { stallName: 'Ali Farm', category: 'Vegetables', name: 'Fresh Tomatoes', description: 'Vine-ripened red tomatoes', price: 120, unit: 'kg', quantity: 50, weeklyStock: 50, imageType: 'tomato', photo: 'tomatoes.jpg', availability: 'AVAILABLE' },
    { stallName: 'Ali Farm', category: 'Vegetables', name: 'Spinach', description: 'Leafy green spinach bunches', price: 60, unit: 'bunch', quantity: 0, weeklyStock: 30, imageType: 'kale', photo: 'spinach.jpg', availability: 'SOLD_OUT' },
    { stallName: 'Ali Farm', category: 'Vegetables', name: 'Capsicum', description: 'Crisp green, yellow and red bell peppers', price: 200, unit: 'kg', quantity: 30, weeklyStock: 30, imageType: 'pepper', photo: 'capsicum.jpg', availability: 'AVAILABLE' },
    { stallName: 'Ali Farm', category: 'Vegetables', name: 'Carrots', description: 'Crunchy red carrots from Malir', price: 90, unit: 'kg', quantity: 40, weeklyStock: 40, imageType: 'carrot', photo: 'carrots.jpg', availability: 'AVAILABLE' },
    { stallName: 'Ali Farm', category: 'Vegetables', name: 'Green Chillies', description: 'Spicy green chillies picked this morning', price: 210, unit: 'kg', quantity: 15, weeklyStock: 15, imageType: 'pepper', photo: 'green-chillies.jpg', availability: 'AVAILABLE' },
    { stallName: 'Sabzi Ghar', category: 'Vegetables', name: 'Potatoes', description: 'Everyday cooking potatoes', price: 80, unit: 'kg', quantity: 100, weeklyStock: 100, imageType: 'mushroom', photo: 'potatoes.jpg', availability: 'AVAILABLE' },
    { stallName: 'Sabzi Ghar', category: 'Vegetables', name: 'Cabbage', description: 'Firm green cabbage heads', price: 70, unit: 'piece', quantity: 25, weeklyStock: 25, imageType: 'cabbage', photo: 'cabbage.jpg', availability: 'AVAILABLE' },
    { stallName: 'Sabzi Ghar', category: 'Vegetables', name: 'Eggplant (Baingan)', description: 'Glossy purple eggplants, ideal for bharta', price: 100, unit: 'kg', quantity: 40, weeklyStock: 40, imageType: 'broccoli', photo: 'eggplant.jpg', availability: 'AVAILABLE' },
]

// product photos live in seed/images and are uploaded into MongoDB GridFS (served by GET /api/images/:name)
const seedPhoto = (file) => saveImageFromDisk(path.resolve('seed', 'images', file), 'seed-' + file)

for (const p of productDefs) {
    const image = await seedPhoto(p.photo)
    const exists = await productModel.findOne({ farmer: farmers[p.stallName]._id, name: p.name })
    if (!exists) {
        await productModel.create({
            farmer: farmers[p.stallName]._id, category: categories[p.category]._id,
            name: p.name, description: p.description, price: p.price, unit: p.unit,
            quantity: p.quantity, weeklyStock: p.weeklyStock, imageType: p.imageType, availability: p.availability,
            image, isActive: true,
        })
    } else if (!exists.image) {
        exists.image = image // re-running the seed adds photos to older demo products
        await exists.save()
    }
}
console.log('Products ready')

// ---------- one test customer ----------
const customerEmail = 'customer@marketlink.com'
let customer = await userModel.findOne({ email: customerEmail })
if (!customer) {
    customer = await userModel.create({
        name: 'Test Customer', email: customerEmail, pwd: await hashPassword('Customer123!'),
        role: 'CUSTOMER', status: 'ACTIVE', phone: '0300-1111111', address: 'DHA Phase 5', city: 'Karachi',
    })
}
console.log('Test customer ready')

// ---------- one completed past order + review (so reviews, insights and reports have data) ----------
if (!(await orderModel.exists({ customer: customer._id }))) {
    const fm = assignments['Ali Farm@Saddar Sunday Market']
    const slot = await pickupSlotModel.findOne({ farmerMarket: fm._id, dayOfWeek: 'SAT' })
    const tomatoes = await productModel.findOne({ farmer: farmers['Ali Farm']._id, name: 'Fresh Tomatoes' })
    const capsicum = await productModel.findOne({ farmer: farmers['Ali Farm']._id, name: 'Capsicum' })

    // last Saturday
    const pickup = new Date()
    pickup.setDate(pickup.getDate() - (((pickup.getDay() + 1) % 7) || 7))
    pickup.setHours(0, 0, 0, 0)

    const lines = [
        { product: tomatoes, quantity: 2 },
        { product: capsicum, quantity: 1 },
    ]
    const total = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0)

    const order = await orderModel.create({
        customer: customer._id, farmer: farmers['Ali Farm']._id, market: markets['Saddar Sunday Market']._id,
        pickupSlot: slot._id, pickupDate: pickup, pickupStart: slot.startTime, pickupEnd: slot.endTime,
        cutoffAt: new Date(pickup.getTime() + 8 * 60 * 60 * 1000), status: 'COMPLETED', paymentStatus: 'PAID',
        totalAmount: total,
    })
    const items = await orderItemModel.insertMany(lines.map((l) => ({
        order: order._id, product: l.product._id, productName: l.product.name, unit: l.product.unit,
        price: l.product.price, quantity: l.quantity, lineTotal: l.product.price * l.quantity,
    })))
    await reviewModel.create({
        customer: customer._id, product: tomatoes._id, farmer: farmers['Ali Farm']._id, order: order._id,
        orderItem: items[0]._id, rating: 5, comment: 'Very fresh tomatoes and pickup was quick.',
    })
    console.log('Sample completed order + review ready')
}

console.log('\n=== LOGIN CREDENTIALS ===')
console.log('Admin      : ' + adminEmail.padEnd(30) + ' / ' + adminPwd)
console.log('Farmer 1   : ali.farm@marketlink.com       / Farmer123!   (APPROVED)')
console.log('Farmer 2   : sabzighar@marketlink.com      / Farmer123!   (APPROVED)')
console.log('Farmer 3   : freshroots@marketlink.com     / Farmer123!   (PENDING - test approval flow)')
console.log('Customer   : customer@marketlink.com       / Customer123!')
console.log('==========================\n')

await mongoose.disconnect()
console.log('Done.')
