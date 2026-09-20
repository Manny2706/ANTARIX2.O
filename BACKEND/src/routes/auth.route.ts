import { Router } from "express"
import { getMe, login, logout, register } from "../controllers/auth.controller"
import { authMiddleware } from "../middleware/auth.middleware"

const authRouter = Router()

authRouter.post("/register", register)
authRouter.post("/login", login)
authRouter.post("/logout", authMiddleware, logout)
authRouter.get("/me", authMiddleware, getMe)

export default authRouter
