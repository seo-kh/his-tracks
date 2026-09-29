import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
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

// OAuth popup callback page handler
app.get(["/oauth/callback", "/oauth/callback.html"], (_req, res) => {
  const publicPath = path.resolve(process.cwd(), "public/oauth/callback.html");
  const distPath = path.resolve(process.cwd(), "dist/oauth/callback.html");
  if (fs.existsSync(publicPath)) {
    res.sendFile(publicPath);
  } else if (fs.existsSync(distPath)) {
    res.sendFile(distPath);
  } else {
    res.status(404).send("Callback page not found");
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    name: "His Tracks",
    version: "1.0.0",
    env: process.env.NODE_ENV ?? "development",
  });
});

export default app;
