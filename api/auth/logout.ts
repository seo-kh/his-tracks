import type { VercelRequest, VercelResponse } from "@vercel/node"

// 서버는 브라우저의 sessionStorage를 직접 삭제할 수 없습니다.
// 
// 따라서 src/services/cloud/googleDrive.ts의 signOutViaServer()는 서버로 이동하기 전에 clearToken()을 호출하는 것이 좋습니다.

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