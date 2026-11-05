import type { VercelRequest, VercelResponse } from "@vercel/node"

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

    return response.redirect(`${appOrigin}/#${fragment.toString()}`)
  } catch {
    const fragment = new URLSearchParams({
      auth_error: "oauth_request_failed",
    })

    return response.redirect(`${appOrigin}/#${fragment.toString()}`)
  }
}