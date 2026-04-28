import type { Request, Response } from "express";
import * as authService from "@/modules/auth/auth.service";
import type z from "zod";
import type { githubCallbackSchema } from "@/schema/auth.schema";
import { StatusCodes } from "http-status-codes";

export async function createUser(
  req: Request<unknown, unknown, z.infer<typeof githubCallbackSchema>>,
  res: Response,
) {
  const result = await authService.createUser({
    code: req.body.code,
    codeVerifier: req.body.codeVerifier,
  });
  if (result.body.status === "success") {
    res.cookie("refreshToken", result.body.data.refreshToken, {
      maxAge: new Date(result.body.data.expiresAt).getTime(),
      sameSite: "strict",
      httpOnly: true,
      path: "/auth/refresh",
      secure: process.env.NODE_ENV === "production",
    });
    res.status(result.statusCode).json({
      status: "success",
      data: {
        accessToken: result.body.data.accessToken,
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
