import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import connectDB from './config/db.js'
import runWeeklyReset from './utilities/weeklyReset.js'
import chatRoutes from './routes/chatRoutes.js'
import authRoutes from './routes/authRoutes.js'
import publicRoutes from './routes/publicRoutes.js'
import farmerRoutes from './routes/farmerRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import customerRoutes from './routes/customerRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import { notFound, errorHandler } from './middleware/errorMiddleware.js'

// This file is the whole API. Locally server.js imports it and calls listen();
// on Vercel (Express preset) it is loaded directly as a serverless function.
const app = express()

// CLIENT_URL may be a comma separated list, e.g. "https://marketlink-two.vercel.app,http://localhost:3000"
const stripSlash = (url) => url.trim().replace(/\/+$/, '')
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000,http://localhost:5173').split(',').map(stripSlash).filter(Boolean)
// in local development the Vite dev server can land on any port (3000 busy -> 3001, ...), so any
// localhost / 127.0.0.1 origin is accepted outside production
const isLocalOrigin = (origin) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
app.use(cors({
    origin: (origin, callback) => {
        const ok = !origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && isLocalOrigin(origin))
        callback(null, ok)
    },
}))
app.use(express.json())

app.get('/', (req, res) => res.json({ success: true, msg: 'MarketLink API. All routes are under /api, e.g. /api/health' }))
app.get('/api/health', (req, res) => res.json({ success: true, msg: 'MarketLink API running' }))

// every other request needs the database; the connection is created once and reused (see config/db.js)
app.use(async (req, res, next) => {
    try {
        await connectDB()
        next()
    } catch (err) {
        console.error('MongoDB connection failed:', err.message)
        res.status(503).json({ success: false, msg: 'Database unavailable: ' + err.message })
    }
})

// Vercel Cron (vercel.json) calls this daily; Vercel sends "Authorization: Bearer <CRON_SECRET>"
app.get('/api/cron/weekly-stock', async (req, res, next) => {
    if (!process.env.CRON_SECRET || req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
        return res.status(401).json({ success: false, msg: 'Unauthorized' })
    }
    try {
        res.json({ success: true, reset: await runWeeklyReset() })
    } catch (err) {
        next(err)
    }
})

app.use('/api', authRoutes)
app.use('/api', publicRoutes)
app.use('/api/ai', chatRoutes)
app.use('/api/farmer', farmerRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/customer', customerRoutes)
app.use('/api/notifications', notificationRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
