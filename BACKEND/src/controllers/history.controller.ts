import { getConversationsByUserId, getMessagesByConversationId } from "../service/history.service"
import { Request, Response } from 'express'


const getConversations = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id || req.user?._id
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            })
        }
        const conversations = await getConversationsByUserId(userId)
        return res.status(200).json({
            success: true,
            message: "Conversations fetched successfully",
            data: conversations
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const getMessages = async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params
        if (!conversationId || typeof conversationId !== "string") {
            return res.status(400).json({
                success: false,
                message: "Valid conversationId is required",
            })
        }

        const messages = await getMessagesByConversationId(conversationId)
        return res.status(200).json({
            success: true,
            message: "Messages fetched successfully",
            data: messages,
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        })
    }
}

export { getConversations, getMessages }
