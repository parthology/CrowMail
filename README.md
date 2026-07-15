<div align="center">
  <img src="./public/logo.png" alt="CrowMail Logo" width="120" height="120">

  # CrowMail — Temporary Email Service

  **Secure, Instant, Fast Temporary Email**

  A self-hosted temporary email service built with Next.js. Modern UI, real-time inbox, multi-language.

  **🌐 [Try it live at crowmail.sbs](https://crowmail.sbs)**

  Backend repository: [crowmail-backend](https://github.com/parthology/crowmail-backend)
</div>

## ✨ Features

- 🔒 **Secure & Reliable** — Self-hosted Rust backend, MySQL-persisted
- ⚡ **Instant Access** — Anonymous inbox in one click, no signup
- 🌐 **Multi-language** — English + हिन्दी (Hindi) out of the box, easy to add more
- 🎨 **Modern UI** — HeroUI + Tailwind, light + dark themes; email HTML rendered in a sandboxed iframe with links opening in new tabs
- 🔄 **Real-time Updates** — Mercure SSE push
- 📧 **Multi-account** — Manage several inboxes in the browser, switch between them from the header dropdown
- 🔐 **Self-service password change** — users can rotate their inbox password from the account menu
- 🔧 **Multi-API Provider** — Switch between your CrowMail backend and Mail.tm
- 🔑 **API Key Support** — Optional key for private domains
- 🔗 **Open Source** — MIT

## 🚀 Deploy

The included `Dockerfile` builds cleanly on Node 22 with pnpm 9.15.
See the [full deployment scaffold](https://github.com/parthology/crowmail-backend) — MySQL, backend, nginx, TLS all wired via `docker compose`.

Local dev:

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Production:

```bash
docker build -t crowmail-frontend .
docker run -p 3000:3000 crowmail-frontend
```

## 📧 API Documentation

Two forms shipped in the frontend:

- Interactive: `/api-docs` — grouped endpoint list with try-it-out
- Plain text (LLM-friendly): `/llm-api-docs.txt` — paste to any AI assistant for integration help

## 🌍 Adding a language

1. Copy `messages/en.json` to `messages/<locale>.json` and translate values.
2. Add `<locale>` to `i18n/routing.ts` `locales` array.

## 📄 License

MIT — see `LICENSE`.
