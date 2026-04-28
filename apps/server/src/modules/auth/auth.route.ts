import { validateSchema } from "@/misc/utils";
import { githubCallbackSchema } from "@/schema/auth.schema";
import { Router } from "express";
import * as authController from "@/modules/auth/auth.controller";

const router: Router = Router();

// router.get("/github", () => {});
router.post(
  "/github/callback",
  validateSchema(githubCallbackSchema, (req) => req.body),
  //   (req) => {validateSchema(githubCallbackSchema, req.body)},
  authController.createUser,
);
// router.post("/refresh");
// router.post("/logout");

export default router;
