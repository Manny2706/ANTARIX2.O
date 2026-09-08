import { prisma } from "../config/db";

async function getConversationsByUserId(userId: string) {
    const conversations = await prisma.conversation.findMany({
        where: {
            userId: userId,
        },

        select: {
            id: true,
            title: true,

            messages: {
                take: 10,
                orderBy: {
                    createdAt: "desc",
                },
            },
        },
    })

    return conversations;
}
async function getMessagesByConversationId(conversationId: string) {
    const messages = await prisma.message.findMany({
        where: {
            conversationId: conversationId
        },
        orderBy: {
            createdAt: "asc"
        },
    })
    return messages;
}

export { getConversationsByUserId, getMessagesByConversationId }