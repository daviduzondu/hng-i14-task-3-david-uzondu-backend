/**
 * DB-backed sliding-window rate limiter.
 *
 * express-rate-limit's default in-memory store doesn't survive across Vercel
 * serverless invocations, so the limits were effectively unenforced.
 * This module uses a PostgreSQL table (rate_limit_buckets) so the counter is
 * shared across all instances.
 */
import { db } from "@/db/db";
import { sql } from "kysely";
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@/misc/utils";

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        key VARCHAR PRIMARY KEY,
        window_start BIGINT NOT NULL,
        count INTEGER NOT NULL
      )
    `.execute(db);
    tableReady = true;
  } catch {
    // Will retry on next request
  }
}

function getIdentity(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(auth.slice(7));
      if (payload?.userId) return `user:${payload.userId}`;
    } catch {}
  }
  const cookieToken = (req as any).cookies?.access_token;
  if (cookieToken) {
    try {
      const payload = verifyAccessToken(cookieToken);
      if (payload?.userId) return `user:${payload.userId}`;
    } catch {}
  }
  const fwd = req.headers["x-forwarded-for"];
  const ip = Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0];
  return `ip:${ip?.trim() || req.ip || "unknown"}`;
}

async function checkLimit(
  key: string,
  limit: number,
  windowSeconds = 60,
): Promise<{ limited: boolean; retryAfter: number }> {
  await ensureTable();
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;

  try {
    const result = await sql<{ count: number }>`
      INSERT INTO rate_limit_buckets (key, window_start, count)
      VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limit_buckets.window_start = EXCLUDED.window_start
          THEN rate_limit_buckets.count + 1
          ELSE 1
        END,
        window_start = EXCLUDED.window_start
      RETURNING count
    `.execute(db);

    const count = result.rows[0]?.count ?? 1;
    if (count >= limit) {
      const retryAfter = Math.max(1, windowSeconds - (now - windowStart));
      return { limited: true, retryAfter };
    }
  } catch {
    // Fail open — if DB is unavailable, don't block traffic
  }
  return { limited: false, retryAfter: 0 };
}

export function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const ident = getIdentity(req);
  const route = req.path.replace(/\/$/, "") || "/";
  checkLimit(`auth:${route}:${ident}`, 10)
    .then(({ limited, retryAfter }) => {
      if (limited) {
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({
          status: "error",
          message: "Rate limit exceeded. Please try again later.",
        });
      }
      next();
    })
    .catch(() => next());
}

export function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const ident = getIdentity(req);
  checkLimit(`api:${ident}`, 60)
    .then(({ limited, retryAfter }) => {
      if (limited) {
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({
          status: "error",
          message: "Rate limit exceeded. Please try again later.",
        });
      }
      next();
    })
    .catch(() => next());
}
