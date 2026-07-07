"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { useMercureSSE } from "./use-mercure-sse"
import { useMailChecker } from "./use-mail-checker"
import { getMessages } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import type { Message } from "@/types"

interface UseSmartMailCheckerOptions {
  onNewMessage?: (message: Message) => void
  onMessagesUpdate?: (messages: Message[]) => void
  enabled?: boolean
}

export function useSmartMailChecker({
  onNewMessage,
  onMessagesUpdate,
  enabled = true, // This flag only controls the polling strategy; it does not affect Mercure
}: UseSmartMailCheckerOptions = {}) {
  const { token, currentAccount } = useAuth()
  const lastUsedRef = useRef<number>(0)
  const isRefreshingRef = useRef(false)
  const [mercureConnected, setMercureConnected] = useState(false)
  const [mercureAttempted, setMercureAttempted] = useState(false)

  // Refresh the message list when Mercure signals an update
  const handleAccountUpdate = useCallback(async (accountData: any) => {
    if (!token || isRefreshingRef.current) return

    console.log(`📧 [SmartChecker] Mercure update detected, refreshing messages...`)

    isRefreshingRef.current = true
    try {
      // Fetch the latest message list
      const providerId = currentAccount?.providerId || "crowmail"
      const { messages } = await getMessages(token, 1, providerId)
      const currentMessages = messages || []

      // Update the message list
      onMessagesUpdate?.(currentMessages)

      console.log(`✅ [SmartChecker] Refreshed messages, found ${currentMessages.length} total`)
    } catch (error) {
      console.error("❌ [SmartChecker] Failed to refresh messages:", error)
    } finally {
      isRefreshingRef.current = false
    }
  }, [token, onMessagesUpdate])

  // Handle new messages received directly
  const handleNewMessage = useCallback((message: any) => {
    console.log(`📧 [SmartChecker] New message received directly:`, message.subject)
    onNewMessage?.(message)
    // Also trigger a message list refresh
    handleAccountUpdate({ used: Date.now() })
  }, [onNewMessage, handleAccountUpdate])

  // Try to use Mercure SSE — always attempt to connect, regardless of the enabled flag
  const mercureResult = useMercureSSE({
    onNewMessage: handleNewMessage,
    onAccountUpdate: handleAccountUpdate,
    enabled: true, // Mercure always attempts to connect
  })

  // Track Mercure connection state changes with stable state updates
  useEffect(() => {
    const isConnected = mercureResult.isConnected

    if (isConnected !== mercureConnected) {
      setMercureConnected(isConnected)
      setMercureAttempted(true)

      if (isConnected) {
        console.log("🚀 [SmartChecker] Mercure connected - using real-time updates")
      } else if (mercureAttempted) {
        console.log("🔄 [SmartChecker] Mercure disconnected - falling back to polling")
      }
    }
  }, [mercureResult.isConnected, mercureConnected, mercureAttempted])

  // Fallback polling strategy:
  // 1. Only considered when the Mercure connection fails
  // 2. The user controls polling via the enabled flag
  const shouldUsePolling = enabled && mercureAttempted && !mercureConnected

  const pollingResult = useMailChecker({
    onNewMessage,
    onMessagesUpdate,
    interval: 30000, // 30-second fallback polling, lower frequency
    enabled: shouldUsePolling,
  })

  return {
    isUsingMercure: mercureConnected,
    isUsingPolling: shouldUsePolling,
    mercureAttempted,
    mercureConnect: mercureResult.connect,
    mercureDisconnect: mercureResult.disconnect,
  }
}
