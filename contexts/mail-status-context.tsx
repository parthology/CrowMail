"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface MailStatusContextType {
  isEnabled: boolean
  setIsEnabled: (enabled: boolean) => void
  lastCheckTime: Date | null
  setLastCheckTime: (time: Date | null) => void
  newMessageCount: number
  setNewMessageCount: (count: number) => void
}

const MailStatusContext = createContext<MailStatusContextType | undefined>(undefined)

export function MailStatusProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(true) // Mail checking enabled by default
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null)
  const [newMessageCount, setNewMessageCount] = useState(0)

  return (
    <MailStatusContext.Provider
      value={{
        isEnabled,
        setIsEnabled,
        lastCheckTime,
        setLastCheckTime,
        newMessageCount,
        setNewMessageCount,
      }}
    >
      {children}
    </MailStatusContext.Provider>
  )
}

export function useMailStatus() {
  const context = useContext(MailStatusContext)
  if (context === undefined) {
    throw new Error("useMailStatus must be used within a MailStatusProvider")
  }
  return context
}
