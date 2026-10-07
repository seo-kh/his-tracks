import { Router, Request, Response } from "express"
import axios from "axios"

export const authRouter = Router()

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

const SCOPES = [
  "openid",
  "profile",
  "email",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ")

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? ""
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ""
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL ?? ""
  const clientRedirect = process.env.CLIENT_REDIRECT_URL ?? "/"

  const missing = ([
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
  ] as const).filter((k) => !process.env[k])

  return { clientId, clientSecret, callbackUrl, clientRedirect, missing }
}

// ── Step 1: Google 동의 화면으로 리다이렉트 ──────────────────────────────────
authRouter.get("/google", (req: Request, res: Response) => {
  const { clientId, callbackUrl, missing } = getConfig()

  if (missing.length > 0) {
    res.status(500).json({ error: `환경변수 누락: ${missing.join(", ")}` })
    return
  }

  const returnTo =
    typeof req.query.returnTo === "string" ? req.query.returnTo : ""
  const queryParams: Record<string, string> = {
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  }
  if (returnTo) {
    queryParams.state = returnTo
  }

  const params = new URLSearchParams(queryParams)

  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
})

// ── Step 2: Google 콜백 — code → token 교환 ──────────────────────────────────
authRouter.get("/auth/google/callback", async (req: Request, res: Response) => {
  const { clientId, clientSecret, callbackUrl, clientRedirect } = getConfig()
  const { code, error, state } = req.query as Record<string, string | undefined>

  const targetPath = state && state.startsWith("/") ? state : ""
  const baseUrl =
    clientRedirect.endsWith("/") && targetPath.startsWith("/")
      ? clientRedirect.slice(0, -1)
      : clientRedirect

  if (error || !code) {
    const reason = encodeURIComponent(error ?? "access_denied")
    res.redirect(`${baseUrl}${targetPath}#auth_error=${reason}`)
    return
  }

  try {
    const tokenRes = await axios.post<{
      access_token: string
      expires_in: number
      refresh_token?: string
      scope: string
      token_type: string
    }>(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    )

    const { access_token, expires_in } = tokenRes.data

    // URL 해시(#)에 토큰을 담아 SPA로 리다이렉트
    const fragment = new URLSearchParams({
      access_token,
      expires_in: String(expires_in),
    })

    res.redirect(`${baseUrl}${targetPath}#${fragment.toString()}`)
  } catch (err) {
    console.error("[auth] token exchange 실패:", err)
    res.redirect(`${baseUrl}${targetPath}#auth_error=token_exchange_failed`)
  }
})

// ── refresh_token → 새 access_token ──────────────────────────────────────────
authRouter.post("/refresh", async (req: Request, res: Response) => {
  const { clientId, clientSecret } = getConfig()
  const { refresh_token } = req.body as { refresh_token?: string }

  if (!refresh_token) {
    res.status(400).json({ error: "refresh_token이 필요합니다." })
    return
  }

  try {
    const tokenRes = await axios.post<{
      access_token: string
      expires_in: number
    }>(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token,
        grant_type: "refresh_token",
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    )

    const { access_token, expires_in } = tokenRes.data
    res.json({ access_token, expires_in })
  } catch (err) {
    console.error("[auth] refresh 실패:", err)
    res.status(401).json({ error: "token_refresh_failed" })
  }
})

// ── 로그아웃 ──────────────────────────────────────────────────────────────────
authRouter.get("/logout", (_req: Request, res: Response) => {
  const { clientRedirect } = getConfig()
  res.redirect(`${clientRedirect}#logout=1`)
})
