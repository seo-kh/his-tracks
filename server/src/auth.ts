import { Router, Request, Response } from "express";
import axios from "axios";

export const authRouter = Router();

// ── 환경변수 ──────────────────────────────────────────────────────────────────

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL ?? "";
const CLIENT_REDIRECT = process.env.CLIENT_REDIRECT_URL ?? "/";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const SCOPES = [
  "openid",
  "profile",
  "email",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function assertConfig(): void {
  const missing = (
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL"] as const
  ).filter((k) => !process.env[k]);

  if (missing.length) {
    throw new Error(`환경변수 누락: ${missing.join(", ")}`);
  }
}

// ── Step 1: Google 동의 화면으로 리다이렉트 ──────────────────────────────────

authRouter.get("/google", (_req: Request, res: Response) => {
  try {
    assertConfig();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
    return;
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });

  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

// ── Step 2: Google 콜백 — code → token 교환 ──────────────────────────────────

authRouter.get("/google/callback", async (req: Request, res: Response) => {
  const { code, error } = req.query as Record<string, string | undefined>;

  if (error || !code) {
    const reason = encodeURIComponent(error ?? "access_denied");
    res.redirect(`${CLIENT_REDIRECT}#auth_error=${reason}`);
    return;
  }

  try {
    const tokenRes = await axios.post<{
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      scope: string;
      token_type: string;
    }>(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: CALLBACK_URL,
        grant_type: "authorization_code",
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, expires_in } = tokenRes.data;

    // URL 해시(#)에 토큰을 담아 SPA로 리다이렉트
    // React 앱의 initFromHash()가 마운트 시 이 값을 읽어 sessionStorage에 저장
    const fragment = new URLSearchParams({
      access_token,
      expires_in: String(expires_in),
    });

    res.redirect(`${CLIENT_REDIRECT}#${fragment.toString()}`);
  } catch (err) {
    console.error("[auth] token exchange 실패:", err);
    res.redirect(`${CLIENT_REDIRECT}#auth_error=token_exchange_failed`);
  }
});

// ── refresh_token → 새 access_token ──────────────────────────────────────────

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const { refresh_token } = req.body as { refresh_token?: string };

  if (!refresh_token) {
    res.status(400).json({ error: "refresh_token이 필요합니다." });
    return;
  }

  try {
    const tokenRes = await axios.post<{
      access_token: string;
      expires_in: number;
    }>(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token,
        grant_type: "refresh_token",
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, expires_in } = tokenRes.data;
    res.json({ access_token, expires_in });
  } catch (err) {
    console.error("[auth] refresh 실패:", err);
    res.status(401).json({ error: "token_refresh_failed" });
  }
});

// ── 로그아웃 ──────────────────────────────────────────────────────────────────

authRouter.get("/logout", (_req: Request, res: Response) => {
  // 서버는 stateless — SPA에 #logout=1 신호를 보내 sessionStorage를 비우게 함
  res.redirect(`${CLIENT_REDIRECT}#logout=1`);
});
