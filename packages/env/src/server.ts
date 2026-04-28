import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    CORS_ORIGIN: z.url().or(z.literal("*")),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number(),
    DATABASE_URL: z.string(),
    GITHUB_OAUTH_CLIENT_ID: z.string(),
    GITHUB_OAUTH_CLIENT_SECRET: z.string(),
  },
  clientPrefix: "PUBLIC_",
  client: {},
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
