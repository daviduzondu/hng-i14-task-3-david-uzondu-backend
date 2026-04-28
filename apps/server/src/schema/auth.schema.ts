import z from "zod";

export const githubCallbackSchema = z.object({
  codeVerifier: z.string(),
  code: z.string(),
});
