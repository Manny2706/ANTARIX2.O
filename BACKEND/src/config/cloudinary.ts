import { v2 as cloudinary } from "cloudinary"
import dotenv from 'dotenv'
dotenv.config()


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uploadOnCloudinary = async (image: string): Promise<any> => {
  try {
    if (!image) {
      console.log("Image not provided");
      return null;
    }

    const imageData = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;

    const response = await cloudinary.uploader.upload(imageData, {
      folder: "satquery/images",
      resource_type: "image",
    })

    console.log("File uploaded successfully", response.secure_url)
    return response

  } catch (error) {
    console.log("Error uploading file", error)
    return null
  }
}


export {
  uploadOnCloudinary
}