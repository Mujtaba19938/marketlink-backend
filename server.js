import 'dotenv/config'
import app from './app.js'
import connectDB from './config/db.js'
import runWeeklyReset from './utilities/weeklyReset.js'

// Local / always-on server entry (npm start). On Vercel, app.js is used directly instead.
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error('Please set MONGO_URI and JWT_SECRET in .env')
    process.exit(1)
}

await connectDB()

const port = process.env.PORT || 5000
app.listen(port, () => console.log('Server running on port ' + port))

// weekly stock template auto-reset, checked hourly while the server runs
const safeReset = () => runWeeklyReset().catch((err) => console.error('weekly stock reset failed:', err.message))
safeReset()
setInterval(safeReset, 60 * 60 * 1000)
