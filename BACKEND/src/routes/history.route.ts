import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware';
import { getConversations,getMessages } from '../controllers/history.controller';

const router = Router()

router.get("/conversations", getConversations)
router.get("/messages/:conversationId", getMessages)

export default router
