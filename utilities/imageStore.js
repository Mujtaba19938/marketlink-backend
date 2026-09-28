import mongoose from 'mongoose'
import path from 'path'
import fs from 'fs'

// Product / stall photos are stored in MongoDB itself (GridFS bucket "images"), not on disk.
// Serverless hosts like Vercel have a read-only, temporary file system, so files written to
// an uploads/ folder would disappear. GridFS keeps photos next to the rest of the data in Atlas.

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'images' })

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

const uniqueName = (originalname) =>
    Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(originalname).toLowerCase()

// write a buffer into GridFS under the given file name
const writeBuffer = (filename, buffer, contentType) =>
    new Promise((resolve, reject) => {
        const stream = bucket().openUploadStream(filename, { metadata: { contentType } })
        stream.on('error', reject)
        stream.on('finish', () => resolve(filename))
        stream.end(buffer)
    })

// saves a multer (memory storage) file and returns the stored file name
const saveImage = async (file) => {
    if (!file) return null
    return writeBuffer(uniqueName(file.originalname), file.buffer, file.mimetype)
}

// saves an image from disk under a fixed name, only if it is not stored yet (used by the seed)
const saveImageFromDisk = async (filePath, filename) => {
    const existing = await bucket().find({ filename }).limit(1).toArray()
    if (existing.length) return filename
    const type = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    return writeBuffer(filename, fs.readFileSync(filePath), type)
}

// deletes every stored copy of a file name (safe if it does not exist)
const deleteImage = async (filename) => {
    if (!filename) return
    try {
        const files = await bucket().find({ filename: path.basename(filename) }).toArray()
        for (const f of files) await bucket().delete(f._id)
    } catch (err) {
        console.error('image delete failed:', err.message)
    }
}

// streams an image to the response; images saved in uploads/ before GridFS still work locally
const sendImage = async (filename, res) => {
    const name = path.basename(filename)
    const [file] = await bucket().find({ filename: name }).sort({ uploadDate: -1 }).limit(1).toArray()

    if (file) {
        res.set('Content-Type', file.metadata?.contentType || TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream')
        res.set('Cache-Control', 'public, max-age=604800, immutable') // file names are unique, safe to cache
        bucket().openDownloadStream(file._id).on('error', () => res.end()).pipe(res)
        return
    }

    const legacy = path.resolve('uploads', name)
    if (fs.existsSync(legacy)) return res.sendFile(legacy)

    res.status(404).json({ success: false, msg: 'Image not found' })
}

export { saveImage, saveImageFromDisk, deleteImage, sendImage }
