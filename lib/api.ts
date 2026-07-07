import type { Account, Domain, Message, MessageDetail } from "@/types"

// Points directly to the CrowMail API service (default provider)
const API_BASE_URL = "https://api.crowmail.sbs"

// Get the default API provider config (for backward compatibility)
function getDefaultProviderConfig() {
  return {
    id: "crowmail",
    name: "CrowMail",
    baseUrl: API_BASE_URL,
    mercureUrl: "https://mercure.crowmail.sbs/.well-known/mercure",
  }
}

// Get the actual API base URL to use based on providerId
function getApiBaseUrlForProvider(providerId?: string): string {
  if (typeof window === "undefined") return API_BASE_URL

  if (!providerId) {
    const provider = getDefaultProviderConfig()
    return provider.baseUrl || API_BASE_URL
  }

  const provider = getProviderConfig(providerId)
  if (provider && provider.baseUrl) {
    return provider.baseUrl
  }

  // Fall back to the default provider
  const fallbackProvider = getDefaultProviderConfig()
  return fallbackProvider.baseUrl || API_BASE_URL
}

// Create request headers with provider info (no authentication)
function createBaseHeaders(providerId?: string): Record<string, string> {
  const provider = providerId ? getProviderConfig(providerId) : getDefaultProviderConfig()
  const headers: Record<string, string> = {}

  if (provider) {
    headers["X-API-Provider-Base-URL"] = provider.baseUrl
  }

  return headers
}

// Create request headers with API Key authentication (only used by fetchDomains and createAccount)
function createHeadersWithApiKey(additionalHeaders: Record<string, string> = {}, providerId?: string): HeadersInit {
  const headers = {
    ...createBaseHeaders(providerId),
    ...additionalHeaders,
  }

  const apiKey = getApiKey()
  if (apiKey && apiKey.trim()) {
    const trimmedApiKey = apiKey.trim()
    console.log(`🔑 [API] Using API Key for domain/account operation: ${trimmedApiKey.substring(0, 10)}...`)

    if (trimmedApiKey.startsWith('Bearer ')) {
      headers["Authorization"] = trimmedApiKey
    } else if (trimmedApiKey.startsWith('dk_')) {
      headers["Authorization"] = `Bearer ${trimmedApiKey}`
    } else {
      headers["Authorization"] = `Bearer ${trimmedApiKey}`
    }
  }

  return headers
}

// Create request headers with JWT Token authentication (used for all other authenticated operations)
function createHeadersWithToken(token: string, additionalHeaders: Record<string, string> = {}, providerId?: string): HeadersInit {
  const headers = {
    ...createBaseHeaders(providerId),
    ...additionalHeaders,
    Authorization: `Bearer ${token}`,
  }

  return headers
}

// Get the currently stored API Key
function getApiKey(): string {
  if (typeof window === "undefined") return ""
  const apiKey = localStorage.getItem("api-key") || ""
  console.log(`🔑 [API] getApiKey called, found: ${apiKey ? `${apiKey.substring(0, 10)}...` : 'null'}`)
  return apiKey
}

// Infer the provider ID from an email address
function inferProviderFromEmail(email: string): string {
  if (typeof window === "undefined") return "crowmail"

  try {
    const domain = email.split("@")[1]
    if (!domain) return "crowmail"

    // First check known domain patterns
    const knownDomainPatterns: Record<string, string> =   {
      "1secmail.com": "mailtm"
    }

    // Check if this is a known domain
    if (knownDomainPatterns[domain]) {
      console.log(`📍 [API] Domain ${domain} mapped to provider: ${knownDomainPatterns[domain]}`)
      return knownDomainPatterns[domain]
    }

    // Get all domain info (from localStorage cache to avoid API calls)
    const cachedDomains = localStorage.getItem("cached-domains")
    if (cachedDomains) {
      const domains = JSON.parse(cachedDomains)
      const matchedDomain = domains.find((d: any) => d.domain === domain)
      if (matchedDomain && matchedDomain.providerId) {
        console.log(`📍 [API] Domain ${domain} found in cache, provider: ${matchedDomain.providerId}`)
        return matchedDomain.providerId
      }
    }

    // If no matching domain was found, return the default provider
    console.log(`⚠️ [API] Domain ${domain} not found, using default provider: crowmail`)
    return "crowmail"
  } catch (error) {
    console.error("Error inferring provider from email:", error)
    return "crowmail"
  }
}

// Get the provider config for a given providerId
function getProviderConfig(providerId: string) {
  if (typeof window === "undefined") return null

  try {
    // Preset providers
    const presetProviders = [
      {
        id: "crowmail",
        name: "CrowMail",
        baseUrl: "https://api.crowmail.sbs",
        mercureUrl: "https://mercure.crowmail.sbs/.well-known/mercure",
      },
      {
        id: "mailtm",
        name: "Mail.tm",
        baseUrl: "https://api.mail.tm",
        mercureUrl: "https://mercure.mail.tm/.well-known/mercure",
      },
    ]

    // Look up in preset providers
    let provider = presetProviders.find(p => p.id === providerId)

    // If not found, look up in custom providers
    if (!provider) {
      const customProviders = localStorage.getItem("custom-api-providers")
      if (customProviders) {
        const parsed = JSON.parse(customProviders)
        provider = parsed.find((p: any) => p.id === providerId)
      }
    }

    return provider || presetProviders[0] // Default to the first preset provider
  } catch (error) {
    console.error("Error getting provider config:", error)
    return {
      id: "crowmail",
      name: "CrowMail",
      baseUrl: "https://api.crowmail.sbs",
      mercureUrl: "https://mercure.crowmail.sbs/.well-known/mercure",
    }
  }
}

// Convert a backend endpoint path to a local proxy URL (works around CORS, client-side only)
function buildProxyUrl(endpoint: string): string {
  return `/api/mail?endpoint=${encodeURIComponent(endpoint)}`
}

// Improved error handling based on the API docs
function getErrorMessage(status: number, errorData: any): string {
  // Prefix with the HTTP status code so retryFetch can detect it
  const prefix = `HTTP ${status}: `

  switch (status) {
    case 400:
      return prefix + "Bad request: invalid or missing parameters"
    case 401:
      return prefix + "Authentication failed, please check your login status"
    case 404:
      return prefix + "The requested resource does not exist"
    case 405:
      return prefix + "Request method not allowed"
    case 418:
      return prefix + "Server temporarily unavailable"
    case 422:
      // Handle specific 422 error info
      if (errorData?.violations && Array.isArray(errorData.violations)) {
        const violation = errorData.violations[0]
        if (violation?.propertyPath === "address" && violation?.message?.includes("already used")) {
          return prefix + "This email address is already in use, please try a different username"
        }
        return prefix + (violation?.message || "Invalid request data format")
      }

      // Handle error message formats from different API providers
      const errorMessage = errorData?.detail || errorData?.message || ""

      // Unified handling for "email already exists" errors
      if (errorMessage.includes("Email address already exists") ||
          errorMessage.includes("already used") ||
          errorMessage.includes("already exists")) {
        return prefix + "This email address is already in use, please try a different username"
      }

      return prefix + (errorMessage || "Invalid request data format, please check the username length or domain format")
    case 429:
      return prefix + "Too many requests, please try again later"
    default:
      return prefix + (errorData?.message || errorData?.details || errorData?.error || `Request failed`)
  }
}

// Check whether an error should be retried
function shouldRetry(status: number): boolean {
  // Status codes that should not be retried (401 is handled by the auto-refresh mechanism)
  const noRetryStatuses = [400, 401, 403, 404, 405, 422, 429]
  return !noRetryStatuses.includes(status)
}

// Get the current account info from localStorage
function getCurrentAccountFromStorage(): { address: string; password: string; token: string; providerId: string } | null {
  if (typeof window === "undefined") return null

  try {
    const authData = localStorage.getItem("auth")
    if (!authData) return null

    const parsed = JSON.parse(authData)
    const currentAccount = parsed.currentAccount
    if (!currentAccount) return null

    return {
      address: currentAccount.address,
      password: currentAccount.password,
      token: currentAccount.token || parsed.token,
      providerId: currentAccount.providerId || "crowmail"
    }
  } catch (error) {
    console.error("[API] Failed to get current account from storage:", error)
    return null
  }
}

// Update the token in localStorage and notify auth-context to sync
function updateTokenInStorage(newToken: string): void {
  if (typeof window === "undefined") return

  try {
    const authData = localStorage.getItem("auth")
    if (!authData) return

    const parsed = JSON.parse(authData)
    if (parsed.currentAccount) {
      parsed.currentAccount.token = newToken
      // Also update the token on the matching account in the accounts array
      if (parsed.accounts && Array.isArray(parsed.accounts)) {
        parsed.accounts = parsed.accounts.map((acc: any) =>
          acc.address === parsed.currentAccount.address
            ? { ...acc, token: newToken }
            : acc
        )
      }
    }
    parsed.token = newToken

    localStorage.setItem("auth", JSON.stringify(parsed))
    console.log("🔄 [API] Token refreshed and saved to storage")

    // Dispatch a custom event to notify auth-context to update React state
    window.dispatchEvent(new CustomEvent("token-refreshed", { detail: { token: newToken } }))
  } catch (error) {
    console.error("[API] Failed to update token in storage:", error)
  }
}

// Global variable used to prevent concurrent token refreshes
let refreshTokenPromise: Promise<string | null> | null = null

// Attempt to refresh the token (called when a 401 is received) - with race protection
async function tryRefreshToken(): Promise<string | null> {
  // If a refresh request is already in progress, wait for it to complete
  if (refreshTokenPromise) {
    console.log("⏳ [API] Token refresh already in progress, waiting...")
    return refreshTokenPromise
  }

  const account = getCurrentAccountFromStorage()
  if (!account || !account.password) {
    console.log("⚠️ [API] Cannot refresh token: no password stored")
    return null
  }

  // Create and store the refresh Promise to prevent concurrent refreshes
  refreshTokenPromise = (async () => {
    try {
      console.log("🔄 [API] Attempting to refresh token for:", account.address)
      const baseUrl = getApiBaseUrlForProvider(account.providerId)
      const headers = {
        ...createBaseHeaders(account.providerId),
        "Content-Type": "application/json",
      }

      const res = await fetch(buildProxyUrl('/token'), {
        method: "POST",
        headers,
        body: JSON.stringify({ address: account.address, password: account.password }),
      })

      if (!res.ok) {
        console.log("❌ [API] Token refresh failed:", res.status)
        return null
      }

      const data = await res.json()
      const newToken = data.token

      // Update the token in storage
      updateTokenInStorage(newToken)

      console.log("✅ [API] Token refreshed successfully")
      return newToken
    } catch (error) {
      console.error("❌ [API] Token refresh error:", error)
      return null
    } finally {
      // Clear the Promise after refresh completes to allow the next refresh
      refreshTokenPromise = null
    }
  })()

  return refreshTokenPromise
}

// fetch function with automatic token refresh
async function fetchWithTokenRefresh(
  url: string,
  options: RequestInit,
  providerId?: string,
  retried = false
): Promise<Response> {
  const response = await fetch(url, options)

  // If we receive a 401 and haven't retried yet, try to refresh the token
  if (response.status === 401 && !retried) {
    console.log("⚠️ [API] Received 401, attempting token refresh...")
    const newToken = await tryRefreshToken()

    if (newToken) {
      // Retry the request with the new token
      const newHeaders = {
        ...Object.fromEntries(new Headers(options.headers as HeadersInit).entries()),
        Authorization: `Bearer ${newToken}`,
      }

      console.log("🔄 [API] Retrying request with new token...")
      return fetchWithTokenRefresh(url, { ...options, headers: newHeaders }, providerId, true)
    }
  }

  return response
}

// Retry helper with improved error handling
async function retryFetch(fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> {
  try {
    const response = await fn()
    return response
  } catch (error: any) {
    // If the error contains status code info, check whether it should be retried
    if (error.message && typeof error.message === 'string') {
      // Extract the status code from the error message
      const statusMatch = error.message.match(/HTTP (\d+)/)
      if (statusMatch) {
        const status = parseInt(statusMatch[1])
        if (!shouldRetry(status)) {
          console.log(`Status ${status} should not be retried, throwing error immediately`)
          throw error
        }
      }
    }

    // For other errors, retry if attempts remain
    if (retries > 0) {
      console.log(`Retrying... ${retries} attempts left`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return retryFetch(fn, retries - 1, delay * 2)
    }
    throw error
  }
}

// Fetch domains from a single provider (requires an API Key to fetch private domains)
export async function fetchDomainsFromProvider(providerId: string): Promise<Domain[]> {
  try {
    const baseUrl = getApiBaseUrlForProvider(providerId)
    // Use API Key authentication so that user-private domains are returned
    const headers = createHeadersWithApiKey({ "Cache-Control": "no-cache" }, providerId)

    console.log(`📤 [API] fetchDomainsFromProvider baseUrl=${baseUrl}`)

    const response = await retryFetch(async () => {
      const res = await fetch(buildProxyUrl('/domains'), { headers })

      console.log(`📥 [API] Response status: ${res.status}`)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      return res
    })

    const data = await response.json()

    if (data && data["hydra:member"] && Array.isArray(data["hydra:member"])) {
      // Only filter domains for the CrowMail provider; other providers return all domains as-is
      let availableDomains = data["hydra:member"]

      if (providerId === "crowmail") {
        // CrowMail provider: filter available domains, only showing verified ones
        availableDomains = data["hydra:member"].filter((domain: any) => {
          // Must be verified to be usable
          if (!domain.isVerified) {
            console.log(`🚫 [API] [CrowMail] Filtering out unverified domain: ${domain.domain}`)
            return false
          }

          console.log(`✅ [API] [CrowMail] Including available domain: ${domain.domain} (verified: ${domain.isVerified})`)
          return true
        })
      } else {
        // Other providers: no filtering, use all domains as-is
        console.log(`✅ [API] [${providerId}] Using all domains without filtering (${availableDomains.length} domains)`)
      }

      // Attach provider info to each domain
      return availableDomains.map((domain: any) => ({
        ...domain,
        providerId, // add the provider ID
      }))
    } else {
      console.error("Invalid domains data format:", data)
      return []
    }
  } catch (error) {
    console.error(`Error fetching domains from provider ${providerId}:`, error)
    return [] // Return an empty array instead of throwing so other providers keep working
  }
}

// Fetch domains from all enabled providers
export async function fetchAllDomains(): Promise<Domain[]> {
  if (typeof window === "undefined") return []

  try {
    // Get the list of enabled providers
    // mail.tm is disabled by default; users can enable it manually in settings
    const disabledProviders = JSON.parse(localStorage.getItem("disabled-api-providers") || '["mailtm"]')
    const presetProviders = [
      { id: "crowmail", name: "CrowMail" },
      { id: "mailtm", name: "Mail.tm" },
    ]
    const customProviders = JSON.parse(localStorage.getItem("custom-api-providers") || "[]")

    const allProviders = [...presetProviders, ...customProviders]
    const enabledProviders = allProviders.filter(p => !disabledProviders.includes(p.id))

    // Fetch domains from all enabled providers in parallel
    const domainPromises = enabledProviders.map(provider =>
      fetchDomainsFromProvider(provider.id)
    )

    const domainResults = await Promise.all(domainPromises)

    // Merge all domains and attach the provider name
    const allDomains: Domain[] = []
    domainResults.forEach((domains, index) => {
      const provider = enabledProviders[index]
      domains.forEach(domain => {
        allDomains.push({
          ...domain,
          providerId: provider.id,
          providerName: provider.name, // provider name used for display
        })
      })
    })

    return allDomains
  } catch (error) {
    console.error("Error fetching domains from all providers:", error)
    throw error
  }
}

// Kept for backward compatibility
export async function fetchDomains(): Promise<Domain[]> {
  return fetchAllDomains()
}

// Create an account (requires an API Key to create accounts under private domains)
// expiresIn: account lifetime in seconds. 0 or -1 = never expires, undefined = server default (24h), positive number = custom seconds
export async function createAccount(address: string, password: string, providerId?: string, expiresIn?: number): Promise<Account> {
  // If no providerId is specified, try to infer it from the email address
  if (!providerId) {
    providerId = inferProviderFromEmail(address)
  }

  const baseUrl = getApiBaseUrlForProvider(providerId)
  console.log(`🔧 [API] Creating account ${address} with provider: ${providerId}`)

  // Use API Key authentication so accounts can be created under private domains
  const headers = createHeadersWithApiKey({ "Content-Type": "application/json" }, providerId)

  // Build the request body; only include expiresIn when it's specified
  const requestBody: Record<string, any> = { address, password }
  if (expiresIn !== undefined) {
    requestBody.expiresIn = expiresIn
  }

  const res = await fetch(buildProxyUrl('/accounts'), {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    const errorMessage = getErrorMessage(res.status, error)
    throw new Error(errorMessage)
  }

  return res.json()
}

// Log in to obtain a JWT Token (no API Key required)
export async function getToken(address: string, password: string, providerId?: string): Promise<{ token: string; id: string }> {
  // If no providerId is specified, try to infer it from the email address
  if (!providerId) {
    providerId = inferProviderFromEmail(address)
  }

  const baseUrl = getApiBaseUrlForProvider(providerId)
  const headers = {
    ...createBaseHeaders(providerId),
    "Content-Type": "application/json",
  }

  const res = await fetch(buildProxyUrl('/token'), {
    method: "POST",
    headers,
    body: JSON.stringify({ address, password }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(getErrorMessage(res.status, error))
  }

  return res.json()
}
export async function getMercureToken(token: string, providerId?: string): Promise<{ token: string }> {
  // Mercure is deprecated; kept for compatibility but throws directly
  throw new Error("Mercure is no longer supported. Please use polling on /messages instead.")
}

// Get account info (JWT Token only) - with automatic token refresh
export async function getAccount(token: string, providerId?: string): Promise<Account> {
  const baseUrl = getApiBaseUrlForProvider(providerId)
  let currentToken = token

  const response = await retryFetch(async () => {
    const headers = createHeadersWithToken(currentToken, {}, providerId)
    const res = await fetchWithTokenRefresh(buildProxyUrl('/me'), { headers }, providerId)

    if (!res.ok) {
      if (res.status === 401) {
        const account = getCurrentAccountFromStorage()
        if (account && account.token && account.token !== currentToken) {
          currentToken = account.token
          const retryHeaders = createHeadersWithToken(currentToken, {}, providerId)
          const retryRes = await fetch(buildProxyUrl('/me'), { headers: retryHeaders })
          if (retryRes.ok) return retryRes
        }
      }
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    return res
  })

  return response.json()
}

// Get the message list (JWT Token only) - with automatic token refresh
export async function getMessages(token: string, page = 1, providerId?: string): Promise<{ messages: Message[]; total: number; hasMore: boolean }> {
  const baseUrl = getApiBaseUrlForProvider(providerId)
  let currentToken = token

  const response = await retryFetch(async () => {
    const headers = createHeadersWithToken(currentToken, {}, providerId)
    const res = await fetchWithTokenRefresh(buildProxyUrl(`/messages?page=${page}`), { headers }, providerId)

    if (!res.ok) {
      // If it still fails after refresh, check whether the token needs updating
      if (res.status === 401) {
        // Try to read the latest token from storage (it may have been refreshed)
        const account = getCurrentAccountFromStorage()
        if (account && account.token && account.token !== currentToken) {
          currentToken = account.token
          // Retry once with the new token
          const retryHeaders = createHeadersWithToken(currentToken, {}, providerId)
          const retryRes = await fetch(buildProxyUrl(`/messages?page=${page}`), { headers: retryHeaders })
          if (retryRes.ok) return retryRes
        }
      }
      const error = await res.json().catch(() => ({}))
      console.log(`❌ [API] getMessages failed - Status: ${res.status}`)
      throw new Error(getErrorMessage(res.status, error))
    }

    return res
  })

  const data = await response.json()
  const messages = data["hydra:member"] || []
  const total = data["hydra:totalItems"] || 0

  // Per the API docs, each page contains at most 30 messages
  const hasMore = messages.length === 30 && (page * 30) < total

  return {
    messages,
    total,
    hasMore,
  }
}

// Get details for a single message (JWT Token only) - with automatic token refresh
export async function getMessage(token: string, id: string, providerId?: string): Promise<MessageDetail> {
  const baseUrl = getApiBaseUrlForProvider(providerId)
  let currentToken = token

  const response = await retryFetch(async () => {
    const headers = createHeadersWithToken(currentToken, {}, providerId)
    const res = await fetchWithTokenRefresh(buildProxyUrl(`/messages/${id}`), { headers }, providerId)

    if (!res.ok) {
      if (res.status === 401) {
        const account = getCurrentAccountFromStorage()
        if (account && account.token && account.token !== currentToken) {
          currentToken = account.token
          const retryHeaders = createHeadersWithToken(currentToken, {}, providerId)
          const retryRes = await fetch(buildProxyUrl(`/messages/${id}`), { headers: retryHeaders })
          if (retryRes.ok) return retryRes
        }
      }
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    return res
  })

  return response.json()
}

// Mark a message as read (JWT Token only) - with automatic token refresh
export async function markMessageAsRead(token: string, id: string, providerId?: string): Promise<{ seen: boolean }> {
  const baseUrl = getApiBaseUrlForProvider(providerId)
  let currentToken = token

  const response = await retryFetch(async () => {
    const headers = createHeadersWithToken(currentToken, { "Content-Type": "application/merge-patch+json" }, providerId)
    const res = await fetchWithTokenRefresh(buildProxyUrl(`/messages/${id}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify({ seen: true }),
    }, providerId)

    if (!res.ok) {
      if (res.status === 401) {
        const account = getCurrentAccountFromStorage()
        if (account && account.token && account.token !== currentToken) {
          currentToken = account.token
          const retryHeaders = createHeadersWithToken(currentToken, { "Content-Type": "application/merge-patch+json" }, providerId)
          const retryRes = await fetch(buildProxyUrl(`/messages/${id}`), { method: "PATCH", headers: retryHeaders, body: JSON.stringify({ seen: true }) })
          if (retryRes.ok) {
            if (retryRes.headers.get("content-type")?.includes("application/json")) {
              return retryRes.json()
            }
            return { seen: true }
          }
        }
      }
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    if (res.headers.get("content-type")?.includes("application/json")) {
      return res.json()
    }
    return { seen: true }
  })

  return response
}

// Delete a message (JWT Token only) - with automatic token refresh
export async function deleteMessage(token: string, id: string, providerId?: string): Promise<void> {
  const baseUrl = getApiBaseUrlForProvider(providerId)
  let currentToken = token

  await retryFetch(async () => {
    const headers = createHeadersWithToken(currentToken, {}, providerId)
    const res = await fetchWithTokenRefresh(buildProxyUrl(`/messages/${id}`), {
      method: "DELETE",
      headers,
    }, providerId)

    if (!res.ok) {
      if (res.status === 401) {
        const account = getCurrentAccountFromStorage()
        if (account && account.token && account.token !== currentToken) {
          currentToken = account.token
          const retryHeaders = createHeadersWithToken(currentToken, {}, providerId)
          const retryRes = await fetch(buildProxyUrl(`/messages/${id}`), { method: "DELETE", headers: retryHeaders })
          if (retryRes.ok) return retryRes
        }
      }
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    return res
  })
}

// Delete an account (JWT Token only) - with automatic token refresh
export async function deleteAccount(token: string, id: string, providerId?: string): Promise<void> {
  const baseUrl = getApiBaseUrlForProvider(providerId)
  let currentToken = token

  await retryFetch(async () => {
    const headers = createHeadersWithToken(currentToken, {}, providerId)
    const res = await fetchWithTokenRefresh(buildProxyUrl(`/accounts/${id}`), {
      method: "DELETE",
      headers,
    }, providerId)

    if (!res.ok) {
      if (res.status === 401) {
        const account = getCurrentAccountFromStorage()
        if (account && account.token && account.token !== currentToken) {
          currentToken = account.token
          const retryHeaders = createHeadersWithToken(currentToken, {}, providerId)
          const retryRes = await fetch(buildProxyUrl(`/accounts/${id}`), { method: "DELETE", headers: retryHeaders })
          if (retryRes.ok) return retryRes
        }
      }
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    return res
  })
}
