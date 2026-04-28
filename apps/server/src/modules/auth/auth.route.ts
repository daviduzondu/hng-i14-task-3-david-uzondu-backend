import { validateSchema } from "@/misc/utils";
import { githubCallbackSchema } from "@/schema/auth.schema";
import { Router } from "express";
import * as authController from "@/modules/auth/auth.controller";
import pkceChallenge from "pkce-challenge";
import { v4 as uuidv4 } from "uuid";

const router: Router = Router();

router.get("/github", async (req, res, next) => {
  const pkce = await pkceChallenge();
  const state = uuidv4();
  res.redirect(
    `https://github.com/login/oauth/authorize?client_id=Ov23liXhC3Msu8ermI7j&redirect_uri=${process.env.BACKEND_URL}/auth/github/callback&state=${state}&code_challenge=${pkce.code_challenge}&code_challenge_method=${pkce.code_challenge_method}&scope=read:user,user:email`,
  );
});
router.get(
  "/github/callback",
  validateSchema(githubCallbackSchema, (req) => req.query),
  //   (req) => {validateSchema(githubCallbackSchema, req.body)},
  authController.createUser,
);
router.post("/refresh", authController.refreshToken);
router.post("/logout", authController.logout);

export default router;
