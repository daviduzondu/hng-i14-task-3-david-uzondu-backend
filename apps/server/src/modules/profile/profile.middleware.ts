import { profileQuerySchema, profileSearchSchema } from "@/schema/profile-query.schema";
import type { ErrorResponse, SuccessResponse } from "@/misc/types";
import { type NextFunction, type Request, type Response } from "express";
import { StatusCodes } from "http-status-codes";
import type z from "zod";

export const validateCreateProfile = (req: Request, _res: Response, next: NextFunction) => {
 if (!req.body || req.body.name === undefined) {
  return _res.status(400).json({
   status: "error",
   message: "'name' is required in request body"
  });
 }

 if (req.body.name === "") {
  return _res.status(400).json({
   status: "error",
   message: "'name' cannot be empty"
  });
 }

 if (isNaN(Number(req.body.name)) === false) {
  return _res.status(422).json({
   status: "error",
   message: "'name' must not be a number"
  });
 }
 return next();
}

export const validateSearchQuery = async (req: Request<{}, {}, {}, z.infer<typeof profileSearchSchema>>, res: Response<SuccessResponse | ErrorResponse>, next: NextFunction) => {
 const { error } = profileSearchSchema.safeParse(req.query);
 if (error) return res.status(StatusCodes.BAD_REQUEST).json({
  status: 'error',
  message: error.issues[0].message
 })

 return next();
}

export const validateProfilesFilter = async (req: Request<{}, {}, {}, z.infer<typeof profileQuerySchema>>, res: Response<SuccessResponse | ErrorResponse>, next: NextFunction) => {
 const { error } = profileQuerySchema.safeParse(req.query);
 if (error) return res.status(StatusCodes.BAD_REQUEST).json({
  status: 'error',
  message: error.issues[0].message
 })

 return next();
}