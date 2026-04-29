import "@/scripts/seed-db";
import { env } from "@hng-i14-task-0-david-uzondu/env/server";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import type { ErrorResponse } from "@/misc/types";
import profileRoutes from "@/modules/profile/profile.route";
import authRoutes from "@/modules/auth/auth.route";
import { AppError } from "@/errors/app.error";
import cookieParser from "cookie-parser";
import { authenticate, isActive } from "@/modules/auth/auth.middleware";
import { requireApiVersion } from "@/modules/profile/profile.middleware";
import { rateLimit } from "express-rate-limit";
import { StatusCodes } from "http-status-codes";
import { getUserDetails } from "@/modules/auth/auth.controller";

const authRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 10,
  ipv6Subnet: 52,
  handler: (_req, _res, _next) => {
    throw new AppError({
      message: "[A] You've been doing that a lot! Take a break!",
      code: StatusCodes.TOO_MANY_REQUESTS,
    });
  },
});

const otherRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 60,
  ipv6Subnet: 52,
  handler: (_req, _res, _next) => {
    throw new AppError({
      message: "You've been doing that a lot! Take a break!",
      code: StatusCodes.TOO_MANY_REQUESTS,
    });
  },
});

const app: Express = express();
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (curl, bots, server-to-server)
    callback(null, origin || "*");
  },
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).send("OK world");
});

app.get("/api/users/me", authenticate, getUserDetails);
app.use(
  "/api/profiles",
  otherRateLimit,
  requireApiVersion,
  authenticate,
  isActive,
  profileRoutes,
);
app.use("/auth", authRateLimit, authRoutes);

app.use(
  (
    err: Error,
    _req: Request,
    res: Response<ErrorResponse>,
    _next: NextFunction,
  ) => {
    if (err instanceof AppError) {
      return res.status(err.code).json({
        status: "error",
        message: err.message,
      });
    }
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({
        status: "error",
        message: err.message,
      });
    } else {
      console.error(err);
      return res.status(500).json({
        status: "error",
        message: "Internal server error",
      });
    }
  },
);

export default app;
