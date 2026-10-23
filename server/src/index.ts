import "dotenv/config";
import path from "node:path";
import express from "express";
import { app } from "./app";

const PORT = Number(process.env.PORT ?? 3000);

async function startServer() {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      // Vite dev middleware를 Express에 마운트하여 프론트엔드 HMR 및 SPA 라우팅 제공
      app.use(vite.middlewares);
      console.log("⚡ Vite development middleware loaded.");
    } catch (err) {
      console.warn("⚠️ Vite middleware load failed, falling back to static dist:", err);
      mountStatic(app);
    }
  } else {
    // 프로덕션: 빌드된 React 정적 파일(dist/) 서빙
    mountStatic(app);
  }

  app.listen(PORT, () => {
    console.log(`\n🎵  His Tracks Server running at: http://localhost:${PORT}`);
    console.log(`    - React App   : http://localhost:${PORT}`);
    console.log(`    - API Health  : http://localhost:${PORT}/health`);
    console.log(`    - Google Auth : http://localhost:${PORT}/auth/google\n`);
  });
}

function mountStatic(serverApp: express.Express) {
  const staticDir = process.env.STATIC_DIR ?? path.resolve(process.cwd(), "dist");
  serverApp.use(express.static(staticDir));

  // SPA fallback: 정적 파일이나 API에 매칭되지 않은 요청은 index.html 서빙 (Express v4/v5 호환)
  serverApp.use((_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});