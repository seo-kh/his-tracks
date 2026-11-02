import type { VercelRequest, VercelResponse } from "@vercel/node"

export default function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET")
    return response.status(405).end("Method Not Allowed")
  }

  const appOrigin = process.env.APP_ORIGIN

  if (!appOrigin) {
    return response.status(500).end("APP_ORIGIN is not configured")
  }

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

  return response.redirect(`${appOrigin}/playlist/`)
}