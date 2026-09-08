import { io } from "socket.io-client";
import fs from "fs";
import path from "path"
import dotenv from "dotenv"
dotenv.config({
    path: path.join(__dirname, "../../.env")
});


// const socket = io("http://localhost:7000");
const socket = io("https://sat-query-ai-ten.vercel.app");

socket.on("connect", () => {
    console.log("🟢 Connected:", socket.id);

    const imagePath1 = path.join(__dirname, "image1.png");
    const imagePath2 = path.join(__dirname, "image2.png");


    const image1 = fs.readFileSync(imagePath1).toString("base64")
    const image2 = fs.readFileSync(imagePath2).toString("base64")

    socket.emit("message:send", {
        key: process.env.SOCKET_KEY,
        userId: "70fa21d1-c6c0-4766-a264-9c2d418352c2",
        conversationId: null,
        message: "what changed between these two images?",
        images: [image1, image2],
    })

    console.log("📤 Message sent with 2 images");
});


// socket.on("connect", () => {
//     console.log("🟢 Connected:", socket.id);

//     const imagePath = path.join(__dirname, "image1.png");
//     const image = fs.readFileSync(imagePath).toString("base64"); // ✅ base64 string

//     socket.emit("message:send", {
//         key: process.env.SOCKET_KEY,
//         userId: "70fa21d1-c6c0-4766-a264-9c2d418352c2",
//         conversationId: null,
//         message: "where is the river in the image and how large is it?",
//         images: [image], // ✅ still an array, just with 1 item
//     });

//     console.log("📤 Message sent with 1 image");
// })

socket.on("message:response", (data) => {
    console.log("🤖 AI RESPONSE:");
    console.log(JSON.stringify(data, null, 2));

    socket.disconnect();
});

socket.on("message:error", (error) => {
    console.log("❌ ERROR:");
    console.log(error);

    socket.disconnect();
});

socket.on("connect_error", (error) => {
    console.log("❌ Socket connection error:", error.message);
});