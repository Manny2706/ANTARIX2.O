import dotenv from "dotenv"
dotenv.config()
import app from "./app"
import { connectDB } from "./config/db"
import http from 'http'
import initiateSocketConnection from './socket/socket'

const httpServer = http.createServer(app)
initiateSocketConnection(httpServer)


connectDB().then(() => {
    httpServer.listen(process.env.PORT, () => {
        console.log(
            `Server is running on port ${process.env.PORT}`
        )
    })
})