import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { authRouter } from "./auth";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "*", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── API routes ────────────────────────────────────────────────────────────────

app.use("/auth", authRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", name: "His Tracks", version: "1.0.0" });
});

// ── Static (React SPA) ────────────────────────────────────────────────────────
// 운영 환경: React 빌드 결과물(code/dist)을 Express가 직접 서빙한다.
// STATIC_DIR 환경변수로 경로를 바꿀 수 있다.

const staticDir =
  process.env.STATIC_DIR ?? path.resolve(__dirname, "../../code/dist");

app.use(express.static(staticDir));

// React Router SPA 폴백 — 알 수 없는 경로는 index.html로 보낸다.
app.get("*", (_req, res) => {
  // res.sendFile(path.join(staticDir, "index.html"));
  res.sendFile(path.join(staticDir, "../../index.html"));
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🎵  His Tracks  |  http://localhost:${PORT}`);
  console.log(`    /auth/google  →  Google 로그인 시작`);
  console.log(`    /health       →  서버 상태 확인\n`);
});