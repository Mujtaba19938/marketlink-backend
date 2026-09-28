import fs from 'fs'
import path from 'path'

// deletes an uploaded image from /uploads (safe if filename is empty or missing)
const removeFile = (filename) => {
    if (!filename) return
    const filePath = path.resolve('uploads', path.basename(filename))
    fs.unlink(filePath, () => {})
}

export default removeFile
