"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Account, AuthState } from "@/types"
import { createAccount, getToken, getAccount, deleteAccount as deleteAccountApi } from "@/lib/api"

interface AuthContextType extends AuthState {
  login: (address: string, password: string) => Promise<void>
  logout: () => void
  register: (address: string, password: string, expiresIn?: number) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  switchAccount: (account: Account) => Promise<void>
  addAccount: (account: Account, token: string, password?: string) => void
  getAccountsForProvider: (providerId: string) => Account[]
  getCurrentProviderAccounts: () => Account[]
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    currentAccount: null,
    accounts: [],
    isAuthenticated: false,
  })



  // Get the provider ID from an email address
  const getProviderIdFromEmail = (email: string) => {
    if (typeof window === "undefined") return "crowmail"

    try {
      const domain = email.split("@")[1]
      if (!domain) return "crowmail"

      // Get cached domain info
      const cachedDomains = localStorage.getItem("cached-domains")
      if (cachedDomains) {
        const domains = JSON.parse(cachedDomains)
        const matchedDomain = domains.find((d: any) => d.domain === domain)
        if (matchedDomain && matchedDomain.providerId) {
          return matchedDomain.providerId
        }
      }

      return "crowmail"
    } catch (error) {
      console.error("Error getting provider from email:", error)
      return "crowmail"
    }
  }

  useEffect(() => {
    // Load auth state from local storage
    const savedAuth = localStorage.getItem("auth")
    if (savedAuth) {
      try {
        const parsedAuth = JSON.parse(savedAuth)

        // Data migration: add providerId to existing accounts (backward compatibility)
        const migratedAccounts = parsedAuth.accounts?.map((account: Account) => ({
          ...account,
          providerId: account.providerId || "crowmail" // default to crowmail
        })) || []

        const migratedCurrentAccount = parsedAuth.currentAccount ? {
          ...parsedAuth.currentAccount,
          providerId: parsedAuth.currentAccount.providerId || "crowmail"
        } : null

        setAuthState({
          ...parsedAuth,
          accounts: migratedAccounts,
          currentAccount: migratedCurrentAccount
        })
      } catch (error) {
        console.error("Failed to parse auth from localStorage:", error)
      }
    }
  }, [])

  // Listen for token refresh events and sync React state
  useEffect(() => {
    const handleTokenRefreshed = (event: CustomEvent<{ token: string }>) => {
      const newToken = event.detail.token
      console.log("🔄 [Auth] Token refreshed event received, updating React state")

      setAuthState(prev => {
        if (!prev.currentAccount) return prev

        const updatedCurrentAccount = {
          ...prev.currentAccount,
          token: newToken,
        }

        const updatedAccounts = prev.accounts.map(acc =>
          acc.address === prev.currentAccount?.address
            ? { ...acc, token: newToken }
            : acc
        )

        return {
          ...prev,
          token: newToken,
          currentAccount: updatedCurrentAccount,
          accounts: updatedAccounts,
        }
      })
    }

    window.addEventListener("token-refreshed", handleTokenRefreshed as EventListener)
    return () => {
      window.removeEventListener("token-refreshed", handleTokenRefreshed as EventListener)
    }
  }, [])

  useEffect(() => {
    // Save auth state to local storage
    // Always save state, including all account info, even when there's no active token
    if (authState.accounts.length > 0 || authState.currentAccount || authState.token) {
      localStorage.setItem("auth", JSON.stringify(authState))
    } else {
      // If there's no account info at all, clear localStorage
      localStorage.removeItem("auth")
    }
  }, [authState])

  const login = async (address: string, password: string) => {
    try {
      const { token, id } = await getToken(address, password)
      const providerId = getProviderIdFromEmail(address)
      const account = await getAccount(token, providerId)

      // Attach password, token, and providerId to the account info
      const accountWithAuth = {
        ...account,
        password,
        token,
        providerId,
      }

      // Check whether the account already exists
      const existingAccountIndex = authState.accounts.findIndex((acc) => acc.address === account.address)

      let updatedAccounts: Account[]
      if (existingAccountIndex !== -1) {
        // Update the existing account's info
        updatedAccounts = authState.accounts.map((acc, index) =>
          index === existingAccountIndex ? accountWithAuth : acc
        )
      } else {
        // Add a new account
        updatedAccounts = [...authState.accounts, accountWithAuth]
      }

      setAuthState({
        token,
        currentAccount: accountWithAuth,
        accounts: updatedAccounts,
        isAuthenticated: true,
      })
    } catch (error) {
      console.error("Login failed:", error)
      throw error
    }
  }

  const register = async (address: string, password: string, expiresIn?: number) => {
    try {
      const providerId = getProviderIdFromEmail(address)
      await createAccount(address, password, providerId, expiresIn)
      // Log in directly after successful registration
      await login(address, password)
    } catch (error) {
      console.error("Registration failed:", error)
      throw error
    }
  }

  const logout = () => {
    console.log("🚪 [Auth] Logging out current account")

    const { currentAccount, accounts } = authState

    // When there's no current account, just clear the auth state but keep the account list
    if (!currentAccount) {
      setAuthState({
        ...authState,
        token: null,
        isAuthenticated: false,
      })
      return
    }

    // Fully remove the current account from the account list (no longer kept in the dropdown or localStorage)
    const remainingAccounts = accounts.filter((account) => account.id !== currentAccount.id)

    // If there are other accounts, auto-switch to the next one to avoid returning to the home page
    if (remainingAccounts.length > 0) {
      const nextAccount = remainingAccounts[0]
      console.log(`🔁 [Auth] Other accounts exist, auto switching to: ${nextAccount.address}`)

      setAuthState({
        token: nextAccount.token || null,
        currentAccount: nextAccount,
        accounts: remainingAccounts,
        isAuthenticated: !!nextAccount.token,
      })
    } else {
      // With only one account left, truly log out and clear the account list
      setAuthState({
        token: null,
        currentAccount: null,
        accounts: [],
        isAuthenticated: false,
      })
    }
    // Don't delete localStorage; let useEffect clean up or save it based on authState
  }

  const deleteAccount = async (id: string) => {
    try {
      console.log(`🗑️ [Auth] Deleting account: ${id}`)
      const { currentAccount, accounts, token } = authState

      // Call the backend delete endpoint to ensure the account is actually deleted
      const targetAccount = accounts.find((account) => account.id === id)
      const providerId = targetAccount?.providerId || "crowmail"

      const deleteToken =
        currentAccount?.id === id
          ? token
          : targetAccount?.token

      if (!deleteToken) {
        throw new Error("Missing credentials required to delete this account. Please log in to this account first, then try deleting again.")
      }

      await deleteAccountApi(deleteToken, id, providerId)

      const remainingAccounts = accounts.filter((account) => account.id !== id)
      const isDeletingCurrent = currentAccount?.id === id

      // If we're not deleting the current account, just update the account list
      if (!isDeletingCurrent) {
        setAuthState(prev => ({
          ...prev,
          accounts: remainingAccounts,
        }))
        return
      }

      // The current account is being deleted
      if (remainingAccounts.length === 0) {
        // The last account was deleted, return to a logged-out state
        console.log("🚪 [Auth] Deleted last account, logging out")
        setAuthState({
          token: null,
          currentAccount: null,
          accounts: [],
          isAuthenticated: false,
        })
        return
      }

      // The current account is being deleted but other accounts exist:
      // 1) First clear the now-invalid current token and save the remaining accounts
      setAuthState(prev => ({
        ...prev,
        token: null,
        currentAccount: null,
        accounts: remainingAccounts,
        isAuthenticated: false,
      }))

      // 2) Prefer an account that still has credentials for auto-switching
      const candidate =
        remainingAccounts.find(account => account.token || account.password) ||
        remainingAccounts[0]

      try {
        console.log(`🔁 [Auth] Deleted current account, trying to auto switch to: ${candidate.address}`)
        await switchAccount(candidate)
      } catch (switchError) {
        // Auto-switch failed: stay logged out but keep remainingAccounts so the user can log in manually
        console.error("❌ [Auth] Auto switch after delete failed:", switchError)
      }
    } catch (error) {
      console.error("Delete account failed:", error)
      throw error
    }
  }

  const switchAccount = async (account: Account) => {
    try {
      console.log(`🔄 [Auth] Switching to account: ${account.address}`)

      const accountProviderId = account.providerId || "crowmail"

      // If there's neither a token nor a password, error out without modifying the current state
      if (!account.token && !account.password) {
        console.warn(`⚠️ [Auth] No credentials available for account: ${account.address}`)
        throw new Error("Missing login credentials, please log in again")
      }

      const applyAccountWithAuth = (accountWithAuth: Account, token: string) => {
        setAuthState(prev => {
          const updatedAccounts = prev.accounts.map((acc) =>
            acc.address === account.address ? accountWithAuth : acc
          )

          return {
            token,
            currentAccount: accountWithAuth,
            accounts: updatedAccounts,
            isAuthenticated: true,
          }
        })
      }

      if (account.token) {
        console.log(`🔍 [Auth] Validating existing token for account: ${account.address}`)
        try {
          // First try to fetch account info using the existing token
          const updatedAccount = await getAccount(account.token, accountProviderId)
          const accountWithAuth = {
            ...updatedAccount,
            password: account.password,
            token: account.token,
            providerId: accountProviderId,
          }

          console.log(`✅ [Auth] Token validated, account info updated: ${account.address}`)
          applyAccountWithAuth(accountWithAuth, account.token)
          return
        } catch (tokenError) {
          console.warn(`⚠️ [Auth] Stored token invalid for account: ${account.address}`)

          // Token is invalid; if we have a password, try obtaining a new token
          if (account.password) {
            try {
              console.log(`🔑 [Auth] Token invalid, getting fresh token for account: ${account.address}`)
              const { token } = await getToken(account.address, account.password, accountProviderId)
              const updatedAccount = await getAccount(token, accountProviderId)

              const accountWithAuth = {
                ...updatedAccount,
                password: account.password,
                token,
                providerId: accountProviderId,
              }

              console.log(`✅ [Auth] Fresh token obtained, switched to account: ${account.address}`)
              applyAccountWithAuth(accountWithAuth, token)
              return
            } catch (refreshError) {
              console.error(`❌ [Auth] Failed to refresh token for account: ${account.address}`)
              // On refresh failure, only clear this account's token; keep the current login state unchanged
              setAuthState(prev => ({
                ...prev,
                accounts: prev.accounts.map(acc =>
                  acc.address === account.address
                    ? { ...acc, token: undefined }
                    : acc
                ),
              }))
              throw new Error("Token expired and refresh failed, please log in again")
            }
          } else {
            // No password, so we can't refresh the token; just clear this account's token
            setAuthState(prev => ({
              ...prev,
              accounts: prev.accounts.map(acc =>
                acc.address === account.address
                  ? { ...acc, token: undefined }
                  : acc
              ),
            }))
            throw new Error("Token has expired, please log in again")
          }
        }
      }

      if (account.password) {
        // No token but we have a password; fetch a new token in the background
        try {
          console.log(`🔑 [Auth] Getting token for account: ${account.address}`)
          const { token } = await getToken(account.address, account.password, accountProviderId)
          const updatedAccount = await getAccount(token, accountProviderId)

          const accountWithAuth = {
            ...updatedAccount,
            password: account.password,
            token,
            providerId: accountProviderId,
          }

          console.log(`✅ [Auth] Token obtained, switched to account: ${account.address}`)
          applyAccountWithAuth(accountWithAuth, token)
          return
        } catch (error) {
          console.error(`❌ [Auth] Failed to get token for account: ${account.address}`)
          throw new Error("Failed to obtain login credentials, please log in again")
        }
      }
    } catch (error) {
      console.error("❌ [Auth] Switch account failed:", error)
      throw error
    }
  }

  const addAccount = (account: Account, token: string, password?: string) => {
    const providerId = getProviderIdFromEmail(account.address)
    const accountWithAuth = {
      ...account,
      password,
      token,
      providerId,
    }

    setAuthState({
      token,
      currentAccount: accountWithAuth,
      accounts: [...authState.accounts, accountWithAuth],
      isAuthenticated: true,
    })
  }

  // Get the accounts for a given provider
  const getAccountsForProvider = (providerId: string): Account[] => {
    return authState.accounts.filter(account =>
      (account.providerId || "crowmail") === providerId
    )
  }

  // Get all accounts for the current account's provider
  const getCurrentProviderAccounts = (): Account[] => {
    if (!authState.currentAccount) return []
    const currentProviderId = authState.currentAccount.providerId || "crowmail"
    return getAccountsForProvider(currentProviderId)
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        register,
        deleteAccount,
        switchAccount,
        addAccount,
        getAccountsForProvider,
        getCurrentProviderAccounts,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
