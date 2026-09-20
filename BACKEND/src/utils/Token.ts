import jwt, { SignOptions } from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret"
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"]

export const generateToken = (payload: { id: string; email: string }): string => {
    return jwt.sign(
        {
            id: payload.id,
            userId: payload.id,
            email: payload.email,
        },
        JWT_SECRET,
        {
            expiresIn: JWT_EXPIRES_IN,
        }
    )
}