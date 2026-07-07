import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, setRequestLocale } from "next-intl/server"
import { routing } from "@/i18n/routing"
import { notFound } from "next/navigation"
import "../globals.css"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"] })

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  const title = "CrowMail — Secure, Instant, Fast Temporary Email"
  const description =
    "Free disposable temporary email service. No signup, instant inbox, protect your real address from spam, bots, and phishing. Open source and self-hosted."
  const url = `https://crowmail.sbs/${locale}`

  return {
    metadataBase: new URL("https://crowmail.sbs"),
    title,
    description,
    keywords: [
      "temp mail", "temporary email", "disposable email", "fake email",
      "throwaway email", "anonymous email", "crowmail", "temp inbox",
      "email verification", "hindi temp mail",
    ],
    authors: [{ name: "parthology", url: "https://github.com/parthology" }],
    creator: "parthology",
    icons: {
      icon: "/logo.png",
      shortcut: "/logo.png",
      apple: "/logo.png",
    },
    alternates: {
      canonical: url,
      languages: {
        en: "https://crowmail.sbs/en",
        hi: "https://crowmail.sbs/hi",
      },
    },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "CrowMail",
      locale: locale === "hi" ? "hi_IN" : "en_US",
      images: [{ url: "/logo.png", width: 1024, height: 1024, alt: "CrowMail" }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/logo.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    verification: {
      google: "l680gSJLYKqthDwKSzEOEWCUUCXO8wSeckteoF3w1GI",
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Validate the locale
  if (!routing.locales.includes(locale as any)) {
    notFound()
  }

  // Enable static rendering
  setRequestLocale(locale)

  // Load translation messages
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
