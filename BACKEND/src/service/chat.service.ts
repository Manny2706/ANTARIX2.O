import { Socket } from "socket.io"
import { HandleLocationMessage, MLResponse, SocketChatData } from "../types/socket.types"
import { prisma } from "../config/db"
import { uploadOnCloudinary } from "../config/cloudinary";

type SSEEvent = {
  event: string;
  data: any
}

async function consumeSSEStream(
  body: ReadableStream<Uint8Array>,
  onEvent?: (evt: SSEEvent) => void
): Promise<SSEEvent[]> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const events: SSEEvent[] = []

  const parseEventFromText = (text: string) => {
    let eventName = "message"
    const dataLines: string[] = []

    for (const line of text.split("\n")) {
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

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        parseEventFromText(rawEvent)
      }
    }

    // Process any trailing event remaining in buffer after stream ends
    if (buffer.trim()) {
      parseEventFromText(buffer.trim())
    }
  } catch (err: any) {
    // If buffer contains an unprocessed event before the stream terminated, process it
    if (buffer.trim()) {
      parseEventFromText(buffer.trim())
    }

    // If result event was already parsed, salvage it instead of crashing
    const hasResult = events.some((e) => e.event === "result")
    if (hasResult) {
      return events
    }

    if (err?.message === "terminated" || err?.name === "TypeError") {
      throw new Error(
        "ML stream was terminated prematurely. Possible causes: Vercel serverless execution timeout (exceeded time limit), ngrok tunnel drop, or remote ML service disconnected."
      )
    }
    throw err
  }

  return events
}


export const handleMessageSend = async (socket: Socket, data: SocketChatData) => {
  const { conversationId, userId, message, images, bbox } = data
  if (!conversationId && (!images || images.length === 0) && !bbox) {
    socket.emit("message:error", {
      message: "Either an image or a map bounding box is required to start an analysis",
    })
    return
  }

  // Resolve a valid user to prevent ForeignKeyConstraintViolation
  let effectiveUserId = userId
  let userExists = effectiveUserId ? await prisma.user.findUnique({ where: { id: effectiveUserId } }) : null

  if (!userExists) {
    const existingUser = await prisma.user.findFirst()
    if (existingUser) {
      effectiveUserId = existingUser.id
    } else {
      const createdUser = await prisma.user.create({
        data: {
          fullName: "Demo User",
          email: "demo@satquery.ai",
          password: "demouserpassword123",
        },
      })
      effectiveUserId = createdUser.id
    }
  }

  let conversation: any
  if (conversationId) {
    conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    })
    if (!conversation) {
      socket.emit("message:error", { message: "Conversation not found" })
      return
    }
    if (conversation.userId !== userId && conversation.userId !== effectiveUserId) {
      socket.emit("message:error", { message: "Unauthorized conversation" })
      return
    }
  } else {
    conversation = await prisma.conversation.create({
      data: {
        userId: effectiveUserId,
        title: message?.slice(0, 30) || (bbox ? "Satellite Region AOI" : "New Conversation"),
      },
    })
  }

  let validImageUrls: string[] = []
  if (Array.isArray(images) && images.length > 0) {
    const imageUrls = await Promise.all(
      images.map(async (image: string) => {
        const result = await uploadOnCloudinary(image);
        return result?.secure_url;
      })
    )
    validImageUrls = imageUrls.filter(
      (url): url is string => Boolean(url)
    )
  }

  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: message || (bbox ? "Analyze satellite imagery for selected region" : null),
      imageUrl: validImageUrls,
    },
  })

  try {
    const formData = new FormData()
    formData.append("query", message || (bbox ? "Analyze satellite imagery for this region" : ""))
    formData.append("max_retries", "3")
    formData.append("session_id", conversation.id)

    if (bbox) {
      formData.append(
        "bbox",
        typeof bbox === "string" ? bbox : JSON.stringify(bbox)
      )
    }

    if (Array.isArray(images) && images.length > 0) {
      if (images.some((img) => typeof img !== "string")) {
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
    }

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

    // accumulates streamed text so we still have a full answer
    // even if the final "result" event omits it
    let streamedContent = ""

    if (contentType.includes("text/event-stream")) {
      const events = await consumeSSEStream(mlResponse.body, (evt) => {
        switch (evt.event) {
          case "start":
          case "progress":
            socket.emit("message:status", {
              conversationId: conversation.id,
              event: evt.event,
              data: evt.data,
            })
            break

          // adjust this event name to whatever your ML API actually
          // sends for partial text (e.g. "chunk", "token", "delta")
          case "chunk":
          case "token": {
            const piece =
              typeof evt.data === "string"
                ? evt.data
                : evt.data?.text ?? evt.data?.content ?? ""
            streamedContent += piece
            socket.emit("message:chunk", {
              conversationId: conversation.id,
              chunk: piece,
            })
            break
          }
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
      // fall back to the streamed text if the result event has no final_answer
      if (!result.final_answer && streamedContent) {
        result.final_answer = streamedContent
      }
    } else {
      result = (await mlResponse.json()) as MLResponse
    }

    // If user provided bbox without images and gateway fetched satellite crop, upload to Cloudinary and update userMessage
    const cropB64 = result.output_image_b64 || result.artifacts?.find((a: any) => a.artifact_id === "satellite_crop" || a.kind === "optical_source")?.image_b64
    if (validImageUrls.length === 0 && cropB64) {
      try {
        const uploadRes = await uploadOnCloudinary(cropB64)
        if (uploadRes?.secure_url) {
          await prisma.message.update({
            where: { id: userMessage.id },
            data: { imageUrl: [uploadRes.secure_url] },
          })
          userMessage.imageUrl = [uploadRes.secure_url]
        }
      } catch (err) {
        console.warn("Failed to upload satellite crop to Cloudinary:", err)
      }
    }

    // stream is fully done — now persist the final assistant message
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
          stac_metadata: (result.stac_metadata as any) ?? null,
          output_image_b64: result.output_image_b64 ?? null,

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

    // signals the client that streaming is done and DB is up to date
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

export const handleMessageSendLocation = async (socket: Socket, data1: HandleLocationMessage) => {
  try {
    const { conversationId, userId, query, max_retries, bbox, session_id } = data1
    if (!query) {
      socket.emit("location:error", {
        message: "Query is required",
      })
      return
    }
    let conversation
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      })
      if (!conversation) {
        socket.emit("location:error", { message: "Conversation not found" })
        return
      }
      if (conversation.userId !== userId) {
        socket.emit("location:error", { message: "Unauthorized conversation" })
        return
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId: userId!,
          title: query?.slice(0, 30) || "New Conversation",
        },
      })
    }
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: query || null,
        // imageUrl will be added after Cloudinary
      },
    })
    const mlUrl = process.env.ML_API_URL!;

    const formData = new FormData()

    formData.append("query", query)
    formData.append("max_retries", String(max_retries || 3))
    formData.append("session_id", conversation.id)

    if (bbox) {
      formData.append("bbox", JSON.stringify(bbox))
    }

    const mlResponse = await fetch(mlUrl, {
      method: "POST",
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

    // accumulates streamed text so we still have a full answer
    // even if the final "result" event omits it
    let streamedContent = ""

    if (contentType.includes("text/event-stream")) {
      const events = await consumeSSEStream(mlResponse.body, (evt) => {
        switch (evt.event) {
          case "start":
          case "progress":
            socket.emit("message:status", {
              conversationId: conversation.id,
              event: evt.event,
              data: evt.data,
            })
            break

          // adjust this event name to whatever your ML API actually
          // sends for partial text (e.g. "chunk", "token", "delta")
          case "chunk":
          case "token": {
            const piece =
              typeof evt.data === "string"
                ? evt.data
                : evt.data?.text ?? evt.data?.content ?? ""
            streamedContent += piece
            socket.emit("message:chunk", {
              conversationId: conversation.id,
              chunk: piece,
            })
            break
          }
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
      // fall back to the streamed text if the result event has no final_answer
      if (!result.final_answer && streamedContent) {
        result.final_answer = streamedContent
      }
    } else {
      result = (await mlResponse.json()) as MLResponse
    }

    // db save 
    // const assistantMessage = await prisma.message.create({
    //   data: {
    //     conversationId: conversation.id,
    //     role: "ASSISTANT",
    //     content: result.final_answer,
    //     metadata: {
    //       confidence: result.confidence,
    //       current_task: result.current_task,
    //       temporal_mode: result.temporal_mode,
    //       modalities: result.modalities,
    //       image_count: result.image_count,
    //       input_valid: result.input_valid,
    //       validation_errors: result.validation_errors,
    //       retry_count: result.retry_count,

    //       reflection: result.reflection
    //         ? {
    //           decision: result.reflection.decision,
    //           required_action: result.reflection.required_action,
    //           reason: result.reflection.reason,
    //           confidence: result.reflection.confidence,
    //           evidence_confidence: result.reflection.evidence_confidence,
    //           min_confidence: result.reflection.min_confidence,
    //           retry_count: result.reflection.retry_count,
    //         }
    //         : null,

    //       evidence: result.evidence
    //         ? JSON.parse(JSON.stringify(result.evidence))
    //         : null,

    //       execution_trace: result.execution_trace
    //         ? JSON.parse(JSON.stringify(result.execution_trace))
    //         : null,

    //       duration_seconds: result.duration_seconds,

    //       artifacts: result.artifacts
    //         ? JSON.parse(JSON.stringify(result.artifacts))
    //         : null,
    //     },
    //   },
    // })

    //socket 
    socket.emit("location:response", {
      conversationId: conversation.id,
      session_id: session_id,
      assistantMessage: result,
    })


  } catch (error) {
    console.log("ERROR: Error in message send", error)
    socket.emit("location:error", {
      message: error instanceof Error ? error.message : "Something went wrong",
    })
    return
  }
}


