import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./auth";

export const app = express();

// ── Middlewares ─────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── API Routes ──────────────────────────────────────────────────────────────
app.use("/auth", authRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    name: "His Tracks",
    version: "1.0.0",
    env: process.env.NODE_ENV ?? "development",
  });
});

export default app;
