import { randomBytes } from "node:crypto"
import type { VercelRequest, VercelResponse } from "@vercel/node"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"

export default function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET")
    return response.status(405).end("Method Not Allowed")
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return response.status(500).end("OAuth environment is not configured")
  }

  const state = randomBytes(32).toString("hex")

  response.setHeader(
    "Set-Cookie",
    [
      `oauth_state=${encodeURIComponent(state)}`,
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=600",
    ].join("; "),
  )

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    state,
    access_type: "online",
    prompt: "select_account",
  })

  return response.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
}