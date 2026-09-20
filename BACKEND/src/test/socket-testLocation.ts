import { io } from "socket.io-client"
import dotenv from "dotenv"
import path from "path"

dotenv.config({
    path: path.join(__dirname, "../../.env"),
})

const SOCKET_URL = "https://sat-query-ai-ten.vercel.app"

const socket = io(SOCKET_URL)

socket.on("connect", () => {
    console.log("🟢 Connected:", socket.id)

    socket.emit("location:send", {
        key: process.env.SOCKET_KEY,
        conversationId: "",
        userId: "70fa21d1-c6c0-4766-a264-9c2d418352c2",

        query: "how much forest in this?",
        max_retries: 3,
        bbox: [22.45, 74.45, 24.3, 76.54],
        session_id: "abc112",
    })

    console.log("📤 Location request sent")
})


// ML start/progress events
socket.on("message:status", (data) => {
    console.log("📡 STATUS:", data)
})


// ML streamed chunks
socket.on("message:chunk", (data) => {
    console.log("🧩 CHUNK:", data)
})


// Final response + DB conversation ID
socket.on("location:response", (data) => {
    console.log("✅ LOCATION RESPONSE:")
    console.dir(data, { depth: null })

    console.log("Conversation ID:", data.conversationId)
    console.log("Session ID:", data.session_id)
    console.log("Assistant:", data.assistantMessage)
})


// Backend error
socket.on("location:error", (data) => {
    console.log("❌ LOCATION ERROR:", data)
})


socket.on("disconnect", () => {
    console.log("🔴 Disconnected")
})


socket.on("connect_error", (error) => {
    console.log("❌ Connection error:", error.message)
})