"use client"

import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { ApiProvider, CustomApiProvider } from "@/types"

// Preset API providers
export const PRESET_PROVIDERS: ApiProvider[] = [
  {
    id: "crowmail",
    name: "CrowMail",
    baseUrl: "https://api.crowmail.sbs",
    mercureUrl: "https://mercure.crowmail.sbs/.well-known/mercure",
    isCustom: false,
  },
  {
    id: "mailtm",
    name: "Mail.tm",
    baseUrl: "https://api.mail.tm",
    mercureUrl: "https://mercure.mail.tm/.well-known/mercure",
    isCustom: false,
  },
]

interface ApiProviderContextType {
  providers: ApiProvider[]
  enabledProviders: ApiProvider[]
  disabledProviderIds: string[]
  addCustomProvider: (provider: CustomApiProvider) => void
  removeCustomProvider: (providerId: string) => void
  updateCustomProvider: (provider: CustomApiProvider) => void
  toggleProviderEnabled: (providerId: string) => void
  isProviderEnabled: (providerId: string) => boolean
  getProviderById: (providerId: string) => ApiProvider | undefined
  apiKey: string
  setApiKey: (apiKey: string) => void
}

const ApiProviderContext = createContext<ApiProviderContextType | undefined>(undefined)

interface ApiProviderProviderProps {
  children: ReactNode
}

export function ApiProviderProvider({ children }: ApiProviderProviderProps) {
  const [customProviders, setCustomProviders] = useState<CustomApiProvider[]>([])
  // Disable mail.tm by default; users can enable it manually in settings
  const [disabledProviderIds, setDisabledProviderIds] = useState<string[]>(["mailtm"])
  const [apiKey, setApiKeyState] = useState<string>("")

  // All providers (preset + custom)
  const providers = [...PRESET_PROVIDERS, ...customProviders]

  // Enabled providers
  const enabledProviders = providers.filter(provider =>
    !disabledProviderIds.includes(provider.id)
  )

  // Load settings from localStorage
  useEffect(() => {
    console.log(`🔑 [Context] Loading settings from localStorage...`)
    try {
      const savedCustomProviders = localStorage.getItem("custom-api-providers")
      const savedDisabledProviders = localStorage.getItem("disabled-api-providers")
      const savedApiKey = localStorage.getItem("api-key")
      console.log(`🔑 [Context] Raw API Key from localStorage: ${savedApiKey}`)

      if (savedCustomProviders) {
        const parsed = JSON.parse(savedCustomProviders)
        if (Array.isArray(parsed)) {
          setCustomProviders(parsed)
        }
      }

      if (savedDisabledProviders) {
        const parsed = JSON.parse(savedDisabledProviders)
        if (Array.isArray(parsed)) {
          setDisabledProviderIds(parsed)
        }
      }

      if (savedApiKey) {
        console.log(`🔑 [Context] Loading API Key from localStorage: ${savedApiKey.substring(0, 10)}...`)
        setApiKeyState(savedApiKey)
      } else {
        console.log(`🔑 [Context] No API Key found in localStorage`)
      }
    } catch (error) {
      console.error("Error loading API provider settings:", error)
    }
  }, [])



  // Add a custom provider
  const addCustomProvider = (provider: CustomApiProvider) => {
    const newCustomProviders = [...customProviders, provider]
    setCustomProviders(newCustomProviders)
    localStorage.setItem("custom-api-providers", JSON.stringify(newCustomProviders))
  }

  // Remove a custom provider
  const removeCustomProvider = (providerId: string) => {
    const newCustomProviders = customProviders.filter(p => p.id !== providerId)
    setCustomProviders(newCustomProviders)
    localStorage.setItem("custom-api-providers", JSON.stringify(newCustomProviders))
  }

  // Update a custom provider
  const updateCustomProvider = (provider: CustomApiProvider) => {
    const newCustomProviders = customProviders.map(p =>
      p.id === provider.id ? provider : p
    )
    setCustomProviders(newCustomProviders)
    localStorage.setItem("custom-api-providers", JSON.stringify(newCustomProviders))
  }

  // Toggle a provider's enabled state
  const toggleProviderEnabled = (providerId: string) => {
    const newDisabledIds = disabledProviderIds.includes(providerId)
      ? disabledProviderIds.filter(id => id !== providerId)
      : [...disabledProviderIds, providerId]

    setDisabledProviderIds(newDisabledIds)
    localStorage.setItem("disabled-api-providers", JSON.stringify(newDisabledIds))
  }

  // Check if a provider is enabled
  const isProviderEnabled = (providerId: string) => {
    return !disabledProviderIds.includes(providerId)
  }

  // Get a provider by ID
  const getProviderById = (providerId: string) => {
    return providers.find(p => p.id === providerId)
  }

  // Set the API key
  const setApiKey = (newApiKey: string) => {
    console.log(`🔑 [Context] Setting API Key: ${newApiKey ? `${newApiKey.substring(0, 10)}...` : 'null'}`)
    setApiKeyState(newApiKey)
    localStorage.setItem("api-key", newApiKey)
  }

  const value: ApiProviderContextType = {
    providers,
    enabledProviders,
    disabledProviderIds,
    addCustomProvider,
    removeCustomProvider,
    updateCustomProvider,
    toggleProviderEnabled,
    isProviderEnabled,
    getProviderById,
    apiKey,
    setApiKey,
  }

  return (
    <ApiProviderContext.Provider value={value}>
      {children}
    </ApiProviderContext.Provider>
  )
}

export function useApiProvider() {
  const context = useContext(ApiProviderContext)
  if (context === undefined) {
    throw new Error("useApiProvider must be used within an ApiProviderProvider")
  }
  return context
}
