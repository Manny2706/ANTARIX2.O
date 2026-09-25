import { Server as HttpServer } from "http"
import { Server, Socket } from "socket.io"
import { handleMessageSend ,handleMessageSendLocation} from "../service/chat.service"
import { SocketSendMessage, SocketLocationSend } from "../types/socket.types"

export let io: Server
const initiateSocketConnection = async (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        maxHttpBufferSize: 1e7,
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        }
    })
    io.on("connection", async (socket: Socket) => {
        console.log(`user connected with ${socket.id}`)

        //Message Event
        socket.on("message:send", async (data: SocketSendMessage) => {

            try {
                const { key, conversationId, userId, message, images, bbox } = data
                if (!key) {
                    return socket.emit("message:error", { message: "Unauthorized: Missing key" })
                }
                if (key !== process.env.SOCKET_KEY) {
                    socket.emit("message:error", {
                        message: "Unauthorized",
                    });
                    return
                }

                // Only require image or bbox if starting a brand new conversation
                if (!conversationId && (!images || images.length === 0) && !bbox) {
                    socket.emit("message:error", {
                        message: "Either an image or a map bounding box is required to start an analysis.",
                    })
                    return
                }

                if (!message && (!images || images.length === 0) && !bbox) {
                    socket.emit("message:error", {
                        message: "Please enter a message, upload an image, or select a region.",
                    })
                    return
                }

                const queryText = (message && message.trim()) || (bbox ? "Analyze satellite imagery for this region" : (images && images.length > 0 ? "Analyze uploaded satellite image" : ""))

                console.log(" Key verified")
                console.log(`the message is : ${queryText}, bbox: ${JSON.stringify(bbox)}, images: ${images?.length || 0}`)

                await handleMessageSend(socket, {
                    conversationId,
                    userId,
                    message: queryText,
                    images: images || [],
                    bbox,
                })
            } catch (error) {
                console.log("ERROR: Error in message send", error)
                socket.emit("message:error", {
                    message: "Something went wrong",
                })
            }
        })
        //location cord
        socket.on("location:send",async (data:SocketLocationSend)=>{
            try {
                const { key, conversationId, userId,  query, max_retries,  bbox, session_id} = data
                if (!key || !query ||  !bbox || !session_id) {
                    return socket.emit("location:error", "Invalid Message data")
                }
                if (key !== process.env.SOCKET_KEY) {
                    socket.emit("location:error", {
                        message: "Unauthorized",
                    });
                    return
                }

                console.log(" Key verified")
                console.log(`the message is : ${query} and the key is ${key}`)

                await handleMessageSendLocation(socket, {
                    conversationId,
                    userId,
                    query,
                    max_retries,
                    bbox,
                    session_id
                })
            } catch (error) {
                console.log("ERROR: Error in Location Query", error)
                socket.emit("location:error", {
                    message: "Something went wrong while Location Query",
                })
            }
        })

        socket.on("disconnect", () => {
            console.log(`user disconnected ${socket.id}`)
        })
    })
    return io
}

export default initiateSocketConnection