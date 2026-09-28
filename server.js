import 'dotenv/config'
import app from './app.js'
import connectDB from './config/db.js'
import farmerModel from './model/farmer.model.js'
import { applyWeeklyStockFor } from './controller/productController.js'

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error('Please set MONGO_URI and JWT_SECRET in .env')
    process.exit(1)
}

await connectDB()

const port = process.env.PORT || 5000
app.listen(port, () => console.log('Server running on port ' + port))

// weekly stock template: farmers who switched on auto-reset get their stock refilled once every 7 days
const WEEK = 7 * 24 * 60 * 60 * 1000
const runWeeklyReset = async () => {
    try {
        const due = await farmerModel.find({
            autoResetWeeklyStock: true,
            approvalStatus: 'APPROVED',
            $or: [{ lastStockResetAt: null }, { lastStockResetAt: { $lt: new Date(Date.now() - WEEK) } }],
        }).select('_id stallName')
        for (const f of due) {
            const count = await applyWeeklyStockFor(f._id)
            console.log('Weekly stock reset for ' + f.stallName + ': ' + count + ' product(s)')
        }
    } catch (err) {
        console.error('weekly stock reset failed:', err.message)
    }
}
runWeeklyReset()
setInterval(runWeeklyReset, 60 * 60 * 1000) // check hourly
