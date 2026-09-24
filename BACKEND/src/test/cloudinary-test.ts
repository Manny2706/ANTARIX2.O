import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: "dpcdncnka",
  api_key: "615749341597165",
  api_secret: "PBevMd9d0uDqefhmZraygQ6AInk",
});

const test = async () => {
  try {
    const result = await cloudinary.uploader.upload(
      "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      {
        folder: "satquery/test",
      }
    );

    console.log("✅ CLOUDINARY WORKING");
    console.log("URL:", result.secure_url);
  } catch (error) {
    console.error("❌ CLOUDINARY FAILED");
    console.error(error);
  }
};

test();