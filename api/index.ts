import "dotenv/config";
import { app } from "../server/src/app";

// Vercel Serverless Function entry point
// Vercel Node runtime automatically wraps the exported Express app
export default app;
