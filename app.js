import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import chatRoutes from './routes/chatRoutes.js'
import authRoutes from './routes/authRoutes.js'
import publicRoutes from './routes/publicRoutes.js'
import farmerRoutes from './routes/farmerRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import customerRoutes from './routes/customerRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import { notFound, errorHandler } from './middleware/errorMiddleware.js'

const app = express()

// CLIENT_URL may be a comma separated list, e.g. "http://localhost:3000,http://localhost:5173"
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000,http://localhost:5173').split(',').map((o) => o.trim())
app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ success: true, msg: 'MarketLink API running' }))

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
