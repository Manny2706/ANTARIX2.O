import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret"

interface JwtPayload {
    id?: string
    userId?: string
    email?: string
}

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string
                _id: string
                email?: string
            }
        }
    }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        let token = req.cookies?.token

        if (!token && req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1]
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: No token provided",
            })
        }

        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
        const userId = decoded.id || decoded.userId

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid token payload",
            })
        }

        req.user = {
            id: userId,
            _id: userId,
            email: decoded.email,
        }

        next()
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        })
    }
}
