import type { Request, Response } from "express";
import * as authService from "@/modules/auth/auth.service";
import type z from "zod";
import type { githubCallbackSchema } from "@/schema/auth.schema";
import { StatusCodes } from "http-status-codes";

export async function createUser(
  req: Request<unknown, unknown, unknown, z.infer<typeof githubCallbackSchema>>,
  res: Response,
) {
  const result = await authService.createUser({
    code: req.query.code,
    code_verifier: req.query.code_verifier,
  });
  if (result.body.status === "success") {
    res.cookie("refreshToken", result.body.data.refresh_token, {
      maxAge: new Date(result.body.data.expiresAt).getTime(),
      sameSite: "strict",
      httpOnly: true,
      path: "/auth/refresh",
      secure: process.env.NODE_ENV === "production",
    });
    res.status(result.statusCode).json({
      status: "success",
      message: "Login Successful",
      data: {
        access_token: result.body.data.access_token,
        username: result.body.data.username,
        role: result.body.data.role,
      },
    });
  } else {
    res.status(result.statusCode).json({
      ...result.body,
    });
  }
}

export async function refreshToken(req: Request, res: Response) {
  const token = req.body.refresh_token;
  if (!token)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ status: "error", message: "No refresh token" });

  const result = await authService.refreshToken(token);
  if (result.body.status === "success") {
    res.cookie("refreshToken", result.body.data.refresh_token, {
      maxAge: new Date(result.body.data.expiresAt).getTime(),
      sameSite: "strict",
      httpOnly: true,
      path: "/auth/refresh",
      secure: process.env.NODE_ENV === "production",
    });
    res.status(result.statusCode).json({
      status: "success",
      message: "Token refreshed successfully",
      data: {
        access_token: result.body.data.access_token,
        refresh_token: result.body.data.refresh_token
      },
    });
  } else {
    res.status(result.statusCode).json({
      ...result.body,
    });
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.refreshToken;
  if (token) {
    await authService.logout(token);
  }
  res.clearCookie("refreshToken", { path: "/auth/refresh" });
  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Log out successful",
  });
}
