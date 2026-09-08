import { getConversationsByUserId,getMessagesByConversationId } from "../service/history.service"
import {Request,Response} from 'express'


const getConversations = async (req:Request,res:Response)=>{
    try {
        const conversations = await getConversationsByUserId("70fa21d1-c6c0-4766-a264-9c2d418352c2")
        return res.status(200).json({
            success:true,
            message:"Conversations fetched successfully",
            data:conversations
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success:false,
            message:"Internal server error"
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
