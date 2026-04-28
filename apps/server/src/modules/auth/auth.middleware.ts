import { Role } from "@/db/generated/types";
import { AppError } from "@/errors/app.error";
import { catchAndThrowError, verifyAccessToken } from "@/misc/utils";
import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token)
    throw new AppError({
      message: "Missing Bearer token in authorization header",
      code: StatusCodes.UNAUTHORIZED,
    });

  catchAndThrowError(
    async () => {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
      next();
    },
    {
      jwtError: {
        errorClass: jwt.JsonWebTokenError,
        code: StatusCodes.BAD_REQUEST,
        message: "Falied to verify token",
      },
    },
  );
}

export function authorize(roles: Role[]) {
  return (
    req: Request<object, object, object, object>,
    _res: Response,
    next: NextFunction,
  ) => {
    if (!roles.includes(req.user?.role)) {
      throw new AppError({
        message: "Insufficient permissions",
        code: StatusCodes.FORBIDDEN,
      });
    }
    next();
  };
}
