import './dns.js'
import mongoose from 'mongoose'

// One shared connection. On Vercel every request can land on a fresh or a reused
// serverless instance, so the connection (or the in-flight connect) is cached on globalThis
// and reused instead of opening a new one per request.
const cache = globalThis.__mongoose || (globalThis.__mongoose = { promise: null })

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) return mongoose.connection

    if (!process.env.MONGO_URI) {
        throw Object.assign(new Error('MONGO_URI is not set. Add it to .env (local) or the Vercel project environment variables.'), { status: 500 })
    }

    if (!cache.promise) {
        cache.promise = mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
            .then((m) => {
                console.log('MongoDB connected')
                return m.connection
            })
            .catch((err) => {
                cache.promise = null // allow the next request to retry
                throw err
            })
    }
    return cache.promise
}

export default connectDB
