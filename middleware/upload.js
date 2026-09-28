import multer from 'multer'
import path from 'path'
import fs from 'fs'

fs.mkdirSync('uploads', { recursive: true })

const allowed = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext)
    },
})

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
