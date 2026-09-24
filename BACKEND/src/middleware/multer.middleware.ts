import multer from 'multer'
import path from 'path'


const storage = multer.memoryStorage()

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5
    },
    fileFilter: (req, file, cb) => {
        const filetypes = ["image/jpeg", "image/png", "image/jpg"]
        const mimetype = filetypes.includes(file.mimetype)
        const extname = filetypes.includes(path.extname(file.originalname).toLowerCase())
        if (mimetype && extname) {
            return cb(null, true)
        }
        cb(
            new Error("Invalid file type")
        )
    }
})

export default upload