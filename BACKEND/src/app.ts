import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import authRouter from "./routes/auth.route"
import historyRouter from "./routes/history.route"
const app = express()


const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || []

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
)
app.use(express.json({
    limit: "16kb"
}))
app.use(express.urlencoded({
    extended: true,
    limit: "16kb"
}))
app.use(cookieParser())


app.get("/health", (req, res) => {
    res.send({
        status: "ok",
        message: "server is Healthy"
    })
})

// Authentication Routes
app.use("/api/auth", authRouter)
// History Routes
app.use("/api/history", historyRouter)


export default app
