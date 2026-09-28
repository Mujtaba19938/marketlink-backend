import multer from 'multer'
import removeFile from '../utilities/removefile.js'

const notFound = (req, res) => {
    res.status(404).json({ success: false, msg: 'Route not found' })
}

// every error thrown inside a controller ends up here
const errorHandler = (err, req, res, next) => {
    if (req.file) removeFile(req.file.filename) // request failed -> do not keep the uploaded image

    let status = err.status || 500
    let msg = err.message

    if (err instanceof multer.MulterError) {
        status = 400
        msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 2MB' : err.message
    } else if (err.name === 'ValidationError') {
        status = 400
        msg = Object.values(err.errors).map((e) => e.message).join(', ')
    } else if (err.name === 'CastError') {
        status = 400
        msg = 'Invalid value for ' + err.path
    } else if (err.code === 11000) {
        status = 409
        msg = 'Duplicate value not allowed'
    } else if (status === 500) {
        console.error(err)
        msg = 'Server error'
    }

    res.status(status).json({ success: false, msg })
}

export { notFound, errorHandler }
