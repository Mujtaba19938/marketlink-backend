import multer from 'multer'
import path from 'path'

const allowed = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
}

// files are kept in memory and then saved to MongoDB GridFS (utilities/imageStore.js),
// because serverless hosts like Vercel cannot write to the local disk
const storage = multer.memoryStorage()

// checks MIME type AND extension
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const okExt = allowed[file.mimetype]
    if (okExt && okExt.includes(ext)) return cb(null, true)
    const err = new Error('Only jpg, png or webp images are allowed')
    err.status = 400
    cb(err)
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } })

export default upload
