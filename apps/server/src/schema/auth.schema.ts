import z from "zod";

export const githubCallbackSchema = z.object({
  code_verifier: z.string(),
  code: z.string(),
});
