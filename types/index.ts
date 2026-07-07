export interface Domain {
  id: string
  domain: string
  isVerified?: boolean // Whether the domain is verified (only verified domains are usable)
  ownerId?: string // Domain owner ID; null indicates a public system domain
  providerId?: string // ID of the API provider this domain belongs to
  providerName?: string // Provider display name
  createdAt?: string
  updatedAt?: string
}

export interface Account {
  id: string
  address: string
  quota: number
  used: number
  isDisabled: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  // Locally stored auth info
  password?: string // Stored password used to re-obtain a token
  token?: string // Stored token for this account
  // API provider info
  providerId?: string // ID of the API provider this account belongs to; kept for backward compatibility, defaults to 'crowmail'
}

export interface Message {
  id: string
  accountId: string
  msgid: string
  from: {
    name: string
    address: string
  }
  to: {
    name: string
    address: string
  }[]
  subject: string
  intro: string
  seen: boolean
  isDeleted: boolean
  hasAttachments: boolean
  size: number
  downloadUrl: string
  createdAt: string
  updatedAt: string
}

export interface MessageDetail extends Message {
  cc?: string[]
  bcc?: string[]
  text: string
  html: string[]
  attachments?: {
    id: string
    filename: string
    contentType: string
    disposition: string
    transferEncoding: string
    related: boolean
    size: number
    downloadUrl: string
  }[]
}

export interface AuthState {
  token: string | null
  currentAccount: Account | null
  accounts: Account[]
  isAuthenticated: boolean
}

// API provider configuration
export interface ApiProvider {
  id: string
  name: string
  baseUrl: string
  mercureUrl: string
  isCustom?: boolean
}

export interface CustomApiProvider extends ApiProvider {
  isCustom: true
}
