import farmerModel from '../model/farmer.model.js'
import { applyWeeklyStockFor } from '../controller/productController.js'

const WEEK = 7 * 24 * 60 * 60 * 1000

// weekly stock template: farmers who switched on auto-reset get their stock refilled once every 7 days.
// Runs hourly from server.js locally, and daily from Vercel Cron (GET /api/cron/weekly-stock) in production.
const runWeeklyReset = async () => {
    const due = await farmerModel.find({
        autoResetWeeklyStock: true,
        approvalStatus: 'APPROVED',
        $or: [{ lastStockResetAt: null }, { lastStockResetAt: { $lt: new Date(Date.now() - WEEK) } }],
    }).select('_id stallName')

    const results = []
    for (const f of due) {
        const count = await applyWeeklyStockFor(f._id)
        console.log('Weekly stock reset for ' + f.stallName + ': ' + count + ' product(s)')
        results.push({ stallName: f.stallName, products: count })
    }
    return results
}

export default runWeeklyReset
