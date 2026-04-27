import '@/scripts/seed-db';
import { env } from "@hng-i14-task-0-david-uzondu/env/server";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import type { ErrorResponse } from "@/misc/types";
import profileRoutes from '@/modules/profile/profile.route';
import { AppError } from "@/errors/app.error";

const app: Express = express();
app.use(
 cors({
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "OPTIONS"],
 }),
);

app.use(express.json());

app.get("/", (_req, res) => {
 res.status(200).send("OK world");
});

app.use("/api/profiles", profileRoutes);

app.use((err: Error, _req: Request, res: Response<ErrorResponse>, _next: NextFunction) => {
 console.error(err)
 if (err instanceof AppError) {
  return res.status(err.code).json({
   status: 'error',
   message: err.message
  })
 }
 if (err instanceof SyntaxError && 'body' in err) {
  return res.status(400).json({
   status: "error",
   message: err.message
  });
 } else {
  return res.status(500).json({
   status: "error",
   message: "Internal server error"
  })
 }
})

export default app;