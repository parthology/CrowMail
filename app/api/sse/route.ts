import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  const authHeader = request.headers.get("Authorization")

  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 })
  }

  const token = authHeader.replace("Bearer ", "")
  const accountId = request.nextUrl.searchParams.get("accountId")

  if (!accountId) {
    return new Response("Account ID is required", { status: 400 })
  }

  const customReadable = new ReadableStream({
    start(controller) {
      // Send the initial connection message
      const data = `data: ${JSON.stringify({ type: "connected", message: "SSE connection established" })}\n\n`
      controller.enqueue(encoder.encode(data))

      // Send heartbeats to keep the connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeatData = `data: ${JSON.stringify({
            type: "heartbeat",
            timestamp: new Date().toISOString(),
          })}\n\n`
          controller.enqueue(encoder.encode(heartbeatData))
        } catch (error) {
          console.error("Error sending heartbeat:", error)
        }
      }, 60000) // Send a heartbeat every minute

      // Cleanup
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval)
        controller.close()
      })
    },
  })

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
