import bcrypt from "bcryptjs"
import { prisma } from "../config/db"
import { ApiError } from "../utils/ApiError"
import { AuthResult, LoginInput, RegisterInput, UserResponse } from "../types/auth.type"
import { generateToken } from "../utils/Token"


export const registerUser = async (data: RegisterInput): Promise<AuthResult> => {
    const normalizedEmail = data.email.toLowerCase().trim()

    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    })

    if (existingUser) {
        throw new ApiError("User with this email already exists", 409)
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
        data: {
            fullName: data.fullName.trim(),
            email: normalizedEmail,
            password: hashedPassword,
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    const token = generateToken({ id: user.id, email: user.email })

    return { user, token }
}

export const loginUser = async (data: LoginInput): Promise<AuthResult> => {
    const normalizedEmail = data.email.toLowerCase().trim()

    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    })
    if (!user) {
        throw new ApiError("Invalid Email", 401)
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password)
    if (!isPasswordValid) {
        throw new ApiError("Invalid password", 401)
    }

    const safeUser: UserResponse = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }

    const token = generateToken({
        id: user.id,
        email: user.email,
    })

    return { user: safeUser, token }
}
export const getCurrentUser = async (userId: string): Promise<UserResponse | null> => {
    if (!userId) {
        throw new ApiError("User ID is required", 400)
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true,
            updatedAt: true,
        },
    })
    return user
}
