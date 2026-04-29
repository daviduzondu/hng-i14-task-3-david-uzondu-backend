import z from "zod";

export const githubCallbackSchema = z.object({
  code_verifier: z.string().optional(),
  code: z.string(),
  state: z.string().optional(),
});
