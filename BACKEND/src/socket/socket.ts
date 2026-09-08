import { Server as HttpServer } from "http"
import { Server, Socket } from "socket.io"
import { handleMessageSend } from "../service/chat.service"
import { SocketSendMessage } from "../types/socket.types"

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
                const { key, conversationId, userId, message, images } = data
                if (!key || !message) {
                    return socket.emit("error", "Invalid message data")
                }
                if (key !== process.env.SOCKET_KEY) {
                    socket.emit("message:error", {
                        message: "Unauthorized",
                    });
                    return
                }

                console.log(" Key verified")
                console.log(`the message is : ${message} and the key is ${key}`)

                await handleMessageSend(socket, {
                    conversationId,
                    userId,
                    message,
                    images,
                })
            } catch (error) {
                console.log("ERROR: Error in message send", error)
                socket.emit("message:error", {
                    message: "Something went wrong",
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