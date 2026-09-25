import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client"


const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    throw new Error("DATABASE_URL is not defined")
}

const adapter = new PrismaPg({
    connectionString,
})

export const prisma = new PrismaClient({
    adapter,
})

export async function connectDB() {
    try {
        await prisma.$connect()


        console.log("╔════════════════════════════════╗")
        console.log("║   ⚕️ PRISMA CONNECTED           ║")
        console.log("║   🐘 PostgreSQL is ready!      ║")
        console.log("╚════════════════════════════════╝")
    } catch (error) {
        console.error("🔴 Prisma connection failed:", error)
        process.exit(1)
    }
}