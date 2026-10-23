import { randomBytes } from "node:crypto"
import type { VercelRequest, VercelResponse } from "@vercel/node"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"

// 이 Function의 역할은 다음과 같습니다.
// 
// 1. 무작위 state 생성
// 2. state를 HTTP-only 쿠키에 저장
// 3. Google 로그인 URL 생성
// 4. Google로 리디렉션
// 5. state는 OAuth CSRF 공격 방지를 위해 반드시 필요합니다.

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