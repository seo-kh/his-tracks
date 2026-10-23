import type { VercelRequest, VercelResponse } from "@vercel/node"

// 중요한 점:
//  
// 1. Client Secret은 callback Function에서만 사용합니다.
// 2. Client Secret이나 Access Token을 로그로 출력하지 않습니다.
// 3. state가 일치하지 않으면 토큰 요청을 실행하지 않습니다.
// 4. 성공하면 Access Token을 URL hash로 전달합니다.
// 5. 앱의 initFromHash()가 hash를 읽고 sessionStorage에 저장합니다.

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

function readCookie(
  request: VercelRequest,
  name: string,
): string | undefined {
  const cookieHeader = request.headers.cookie
  if (!cookieHeader) return undefined

  for (const item of cookieHeader.split(";")) {
    const [key, ...valueParts] = item.trim().split("=")
    if (key === name) {
      return decodeURIComponent(valueParts.join("="))
    }
  }

  return undefined
}

function clearOAuthStateCookie(response: VercelResponse) {
  response.setHeader(
    "Set-Cookie",
    [
      "oauth_state=",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=0",
    ].join("; "),
  )
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET")
    return response.status(405).end("Method Not Allowed")
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  const appOrigin = process.env.APP_ORIGIN

  if (!clientId || !clientSecret || !redirectUri || !appOrigin) {
    return response.status(500).end("OAuth environment is not configured")
  }

  const code =
    typeof request.query.code === "string"
      ? request.query.code
      : undefined

  const state =
    typeof request.query.state === "string"
      ? request.query.state
      : undefined

  const error =
    typeof request.query.error === "string"
      ? request.query.error
      : undefined

  const storedState = readCookie(request, "oauth_state")

  clearOAuthStateCookie(response)

  if (error) {
    const fragment = new URLSearchParams({
      auth_error: error,
    })

    return response.redirect(`${appOrigin}/#${fragment.toString()}`)
  }

  if (!code || !state || !storedState || state !== storedState) {
    const fragment = new URLSearchParams({
      auth_error: "invalid_oauth_state",
    })

    return response.redirect(`${appOrigin}/#${fragment.toString()}`)
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const token = (await tokenResponse.json()) as {
      access_token?: string
      expires_in?: number
      error?: string
      error_description?: string
    }

    if (!tokenResponse.ok || !token.access_token) {
      console.error("Google token exchange failed", {
        status: tokenResponse.status,
        error: token.error,
      })

      const fragment = new URLSearchParams({
        auth_error: "token_exchange_failed",
      })

      return response.redirect(`${appOrigin}/#${fragment.toString()}`)
    }

    const fragment = new URLSearchParams({
      access_token: token.access_token,
      expires_in: String(token.expires_in ?? 3600),
    })

    const returnTo = readCookie(request, "oauth_return_to") ?? "/playlist/"
    const target = new URL(returnTo, appOrigin)
    target.hash = fragment.toString()

    // Delete Cookies.
    response.setHeader("Set-Cookie", [
        [
            "oauth_state=",
            "HttpOnly",
            "Secure",
            "SameSite=Lax",
            "Path=/",
            "Max-Age=0",
        ].join("; "),
        [
            "oauth_return_to=",
            "HttpOnly",
            "Secure",
            "SameSite=Lax",
            "Path=/",
            "Max-Age=0",
        ].join("; "),
    ])

    return response.redirect(target.toString())
  } catch {
    const fragment = new URLSearchParams({
      auth_error: "oauth_request_failed",
    })

    return response.redirect(`${appOrigin}/#${fragment.toString()}`)
  }
}