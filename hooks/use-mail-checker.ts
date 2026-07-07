"use client"

import { useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getMessages } from "@/lib/api"
import type { Message } from "@/types"

interface UseMailCheckerOptions {
  onNewMessage?: (message: Message) => void
  onMessagesUpdate?: (messages: Message[]) => void
  interval?: number // Check interval, default 2500ms (2.5s)
  enabled?: boolean // Whether automatic checking is enabled
}

export function useMailChecker({
  onNewMessage,
  onMessagesUpdate,
  interval = 1000, // Default 1 second check interval
  enabled = true,
}: UseMailCheckerOptions = {}) {
  const { token, currentAccount, isAuthenticated } = useAuth()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastMessagesRef = useRef<Message[]>([])
  const isCheckingRef = useRef(false)
  const isInitializedRef = useRef(false) // Tracks whether initialized

  // Store callbacks in refs to avoid dependency-array issues
  const onNewMessageRef = useRef(onNewMessage)
  const onMessagesUpdateRef = useRef(onMessagesUpdate)

  // Keep the ref callbacks in sync with props
  useEffect(() => {
    onNewMessageRef.current = onNewMessage
    onMessagesUpdateRef.current = onMessagesUpdate
  }, [onNewMessage, onMessagesUpdate])

  const startChecking = useCallback(() => {
    // Manual start entry point; the effect handles it automatically, reserved for future extension
  }, [])

  const stopChecking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    isCheckingRef.current = false
    isInitializedRef.current = false
  }, [])

  // Restart checking whenever dependencies change
  useEffect(() => {
    // Check function
    const checkForNewMessages = async () => {
      if (!token || !currentAccount || !isAuthenticated) {
        return
      }

      if (isCheckingRef.current) {
        return
      }

      isCheckingRef.current = true

      try {
        const providerId = currentAccount?.providerId || "crowmail"
        const { messages } = await getMessages(token, 1, providerId)
        const currentMessages = messages || []

        // On first initialization, just set the message list without firing new-message notifications
        if (!isInitializedRef.current) {
          lastMessagesRef.current = currentMessages
          isInitializedRef.current = true
          onMessagesUpdateRef.current?.(currentMessages)
          return
        }

        // Compare for new messages (only after initialization)
        const lastMessages = lastMessagesRef.current
        const newMessages = currentMessages.filter(
          (currentMsg) => !lastMessages.some((lastMsg) => lastMsg.id === currentMsg.id)
        )

        // Fire callback if there are new messages
        if (newMessages.length > 0) {
          newMessages.forEach((message) => {
            onNewMessageRef.current?.(message)
          })
        }

        // Update the message list
        if (currentMessages.length !== lastMessages.length ||
            currentMessages.some((msg, index) => msg.id !== lastMessages[index]?.id)) {
          onMessagesUpdateRef.current?.(currentMessages)
        }

        // Update the last-seen message list
        lastMessagesRef.current = currentMessages
      } catch (error) {
        console.error("❌ [MailChecker] Failed to check for new messages:", error)
        // Don't throw so the scheduled check keeps running
      } finally {
        isCheckingRef.current = false
      }
    }

    // Stop any existing check first
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (enabled && token && currentAccount && isAuthenticated) {
      // Run a check immediately
      checkForNewMessages()

      // Set up the periodic check
      intervalRef.current = setInterval(() => {
        checkForNewMessages()
      }, interval)
    } else {
      isCheckingRef.current = false
      isInitializedRef.current = false
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      isCheckingRef.current = false
      isInitializedRef.current = false
    }
  }, [enabled, token, currentAccount, isAuthenticated, interval])

  // Clean up when the component unmounts
  useEffect(() => {
    return () => {
      stopChecking()
    }
  }, [stopChecking])

  return {
    startChecking,
    stopChecking,
    isChecking: isCheckingRef.current,
  }
}
