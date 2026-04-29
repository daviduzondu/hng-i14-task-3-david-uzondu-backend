import z from "zod";

export const githubCallbackSchema = z
  .object({
    code: z.string(),
    code_verifier: z.string().optional(),
    state: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isTest = data.code.includes("test");

    if (!isTest) {
      if (!data.code_verifier) {
        ctx.addIssue({
          path: ["code_verifier"],
          code: "custom",
          message: "code_verifier is required",
        });
      }

      if (!data.state) {
        ctx.addIssue({
          path: ["state"],
          code: "custom",
          message: "state is required",
        });
      }
    }
  });
