import { Socket } from "socket.io"
import { MLResponse, SocketChatData } from "../types/socket.types"
import { prisma } from "../config/db"

type SSEEvent = {
  event: string;
  data: any
}


async function consumeSSEStream(body: ReadableStream<Uint8Array>, onEvent?: (evt: SSEEvent) => void): Promise<SSEEvent[]> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const events: SSEEvent[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by a blank line
    let boundary
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)

      let eventName = "message"
      const dataLines: string[] = []

      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim()
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim())
        }
      }

      const rawData = dataLines.join("\n")
      if (rawData) {
        let parsed: any = rawData
        try {
          parsed = JSON.parse(rawData)
        } catch {
          // not JSON, keep raw string (e.g. keep-alive pings)
        }
        const evt = { event: eventName, data: parsed }
        events.push(evt)
        onEvent?.(evt)
      }
    }
  }

  return events
}

export const handleMessageSend = async (socket: Socket, data: SocketChatData) => {
  const { conversationId, userId, message, images } = data
  if (!images || images.length === 0) {
    socket.emit("message:error", {
      message: "Image is required backend",
    })
    return
  }

  let conversation
  if (conversationId) {
    conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    })
    if (!conversation) {
      socket.emit("message:error", { message: "Conversation not found" })
      return
    }
    if (conversation.userId !== userId) {
      socket.emit("message:error", { message: "Unauthorized conversation" })
      return
    }
  } else {
    conversation = await prisma.conversation.create({
      data: {
        userId: userId!,
        title: message?.slice(0, 30) || "New Conversation",
      },
    })
  }

  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: message || null,
      // imageUrl will be added after Cloudinary
    },
  })




  try {
    const formData = new FormData()
    formData.append("query", message || "")
    formData.append("max_retries", "3")

    if (!Array.isArray(images) || images.some((img) => typeof img !== "string")) {
      socket.emit("message:error", {
        message: "Invalid images format: expected an array of base64 strings",
      })
      return
    }

    images.forEach((imageBase64: string, index: number) => {
      const buffer = Buffer.from(imageBase64, "base64")
      const blob = new Blob([new Uint8Array(buffer)], { type: "image/png" })
      formData.append("images", blob, `optical_${index}.png`)
    })

    const mlUrl = process.env.ML_API_URL!
    const mlApiKey = process.env.ML_API_KEY

    const mlResponse = await fetch(mlUrl, {
      method: "POST",
      headers: mlApiKey ? { "X-API-Key": mlApiKey } : undefined,
      body: formData,
    })

    if (!mlResponse.ok) {
      const errorText = await mlResponse.text()
      console.error("ML API error: ", errorText)
      throw new Error(`ML API failed: ${mlResponse.status} - ${errorText}`)
    }
    if (!mlResponse.body) {
      throw new Error("ML API returned no response body")
    }
    const contentType = mlResponse.headers.get("content-type") || ""
    let result: MLResponse

    if (contentType.includes("text/event-stream")) {
      const events = await consumeSSEStream(mlResponse.body, (evt) => {
        if (evt.event === "start" || evt.event === "progress") {
          socket.emit("message:status", {
            conversationId: conversation.id,
            event: evt.event,
            data: evt.data,
          })
        }
      })
      const errorEvent = events.find((e) => e.event === "error")
      if (errorEvent) {
        console.error("ML API stream error:", errorEvent.data)
        throw new Error(
          typeof errorEvent.data === "string"
            ? errorEvent.data
            : JSON.stringify(errorEvent.data)
        )
      }

      const resultEvent = events.find((e) => e.event === "result")
      if (!resultEvent || typeof resultEvent.data !== "object") {
        throw new Error("No 'result' event found in SSE stream")
      }

      result = resultEvent.data as MLResponse
    } else {
      result = (await mlResponse.json()) as MLResponse
    }

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: result.final_answer,
        metadata: {
          confidence: result.confidence,
          current_task: result.current_task,
          temporal_mode: result.temporal_mode,
          modalities: result.modalities,
          image_count: result.image_count,
          input_valid: result.input_valid,
          validation_errors: result.validation_errors,
          retry_count: result.retry_count,

          reflection: result.reflection
            ? {
              decision: result.reflection.decision,
              required_action: result.reflection.required_action,
              reason: result.reflection.reason,
              confidence: result.reflection.confidence,
              evidence_confidence: result.reflection.evidence_confidence,
              min_confidence: result.reflection.min_confidence,
              retry_count: result.reflection.retry_count,
            }
            : null,

          evidence: result.evidence
            ? JSON.parse(JSON.stringify(result.evidence))
            : null,

          execution_trace: result.execution_trace
            ? JSON.parse(JSON.stringify(result.execution_trace))
            : null,

          duration_seconds: result.duration_seconds,

           artifacts: result.artifacts
    ? JSON.parse(JSON.stringify(result.artifacts))
    : null,
        },
      },
    })

    socket.emit("message:response", {
      conversationId: conversation.id,
      userMessage,
      assistantMessage,
    })
  } catch (error) {
    console.log("ERROR: Error in message send", error)
    socket.emit("message:error", {
      message: error instanceof Error ? error.message : "Something went wrong",
    })
    return
  }
}

