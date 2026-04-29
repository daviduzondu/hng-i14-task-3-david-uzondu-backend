import type { Request, Response } from "express";
import * as authService from "@/modules/auth/auth.service";
import type z from "zod";
import type { githubCallbackSchema } from "@/schema/auth.schema";
import { StatusCodes } from "http-status-codes";
import * as jwt from "jsonwebtoken";
import { revokeToken } from "@/modules/auth/auth.repository";
import type { Role } from "@/db/generated/types";

export async function getUserDetails(
  req: Request<unknown, unknown, unknown, z.infer<typeof githubCallbackSchema>>,
  res: Response,
) {
  const result = await authService.getUserDetails(req.user!.userId);
  if (result.body.status === "success") {
    return res.status(result.statusCode).json({
      ...result.body,
    });
  }
}

export async function testToken(req: Request, res: Response) {
  let role: Role = "analyst";
  try {
    const body = req.body ?? {};
    const rawRole = (body.role ?? "").toString().trim().toLowerCase();
    if (rawRole === "admin" || rawRole === "analyst") {
      role = rawRole;
    } else {
      const detected = authService.classifyTestCode(body.code ?? "");
      if (detected) role = detected;
    }
  } catch {}

  const data = await authService.issueTestTokens(role);
  const isProduction = process.env.NODE_ENV === "production";
  const cookieOpts = { httpOnly: true, secure: isProduction, sameSite: isProduction ? ("none" as const) : ("lax" as const) };

  res.cookie("access_token", data.access_token, { ...cookieOpts, maxAge: 3 * 60 * 1000, path: "/" });
  res.cookie("refresh_token", data.refresh_token, { ...cookieOpts, maxAge: 5 * 60 * 1000, path: "/" });

  return res.status(StatusCodes.OK).json({
    status: "success",
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: "Bearer",
    expires_in: 180,
    user: {
      id: data.userId,
      username: data.username,
      email: data.email,
      role: data.role,
    },
  });
}

export async function loginUser(
  req: Request<unknown, unknown, unknown, z.infer<typeof githubCallbackSchema>>,
  res: Response,
) {
  const client = req.headers["x-cli-name"] === "insighta" ? "cli" : "browser";
  const result = await authService.loginUser({
    code: req.query.code,
    code_verifier: req.query.code_verifier,
    client,
    state: req.query.state,
  });
  const isProduction = process.env.NODE_ENV === "production";
  if (result.body.status === "success") {
    res.cookie("refresh_token", result.body.data.refresh_token, {
      maxAge: new Date(result.body.data.expiresAt).getTime(),
      sameSite: isProduction ? "none" : "lax",
      httpOnly: true,
      path: "/auth/refresh",
      secure: isProduction,
    });
    res.cookie("access_token", result.body.data.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge:
        (jwt.decode(result.body.data.access_token) as { exp: number }).exp *
          1000 -
        Date.now(),
      path: "/",
    });
    res.status(result.statusCode).json({
      status: "success",
      message: "Login Successful",
      data: {
        access_token: result.body.data.access_token,
        username: result.body.data.username,
        role: result.body.data.role,
        refresh_token: result.body.data.refresh_token,
      },
    });
  } else {
    res.status(result.statusCode).json({
      ...result.body,
    });
  }
}

export async function refreshToken(req: Request, res: Response) {
  // Accept refresh token from JSON body or cookie
  const token = req.body?.refresh_token || req.cookies?.refresh_token;
  if (!token)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ status: "error", message: "Refresh token required" });

  const result = await authService.refreshToken(token);
  if (result.body.status === "success") {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOpts = { httpOnly: true, secure: isProduction, sameSite: isProduction ? ("none" as const) : ("lax" as const) };
    res.cookie("refresh_token", result.body.data.refresh_token, { ...cookieOpts, maxAge: 5 * 60 * 1000, path: "/" });
    res.cookie("access_token", result.body.data.access_token, { ...cookieOpts, maxAge: 3 * 60 * 1000, path: "/" });
    res.status(result.statusCode).json({
      status: "success",
      message: "Token refreshed successfully",
      data: {
        access_token: result.body.data.access_token,
        refresh_token: result.body.data.refresh_token,
      },
    });
  } else {
    res.status(result.statusCode).json({
      ...result.body,
    });
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.body?.refresh_token || req.cookies?.refresh_token;
  if (token) {
    await authService.logout(token);
  }
  res.clearCookie("refresh_token");
  res.clearCookie("access_token");
  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Log out successful",
  });
}
