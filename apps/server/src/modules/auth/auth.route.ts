import { validateSchema } from "@/misc/utils";
import { githubCallbackSchema } from "@/schema/auth.schema";
import { Router } from "express";
import * as authController from "@/modules/auth/auth.controller";
import pkceChallenge from "pkce-challenge";
import { v4 as uuidv4 } from "uuid";
import { authenticate } from "@/modules/auth/auth.middleware";

const router: Router = Router();

router.get("/github", async (req, res) => {
  const pkce = await pkceChallenge();
  const state = uuidv4();
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_OAUTH_BROWSER_CLIENT_ID}&redirect_uri=${process.env.FRONTEND_URL}/auth/github/callback&state=${state}&code_challenge=${pkce.code_challenge}&code_challenge_method=${pkce.code_challenge_method}&scope=read:user,user:email`;

  res.cookie("oauth_code_verifier", pkce.code_verifier, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/auth/github/callback",
  });

  res.cookie("oauth_state", state, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/auth/github/callback",
  });

  res.redirect(githubUrl);
});

router.get(
  "/github/callback",
  validateSchema(githubCallbackSchema, (req) => req.query),
  authController.loginUser,
);
router.get("/me", authenticate, authController.getUserDetails);
router.post("/refresh", authController.refreshToken);
router.post("/logout", authController.logout);

export default router;
