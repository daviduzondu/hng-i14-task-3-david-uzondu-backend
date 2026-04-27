import type { Request, Response } from "express";
import * as profileService from "@/modules/profile/profile.service";
import type { SuccessResponse, ErrorResponse } from "@/misc/types";
import type { profileQuerySchema, profileSearchSchema } from "@/schema/profile-query.schema";
import type z from "zod";

export const createProfile = async (req: Request<{}, {}, { name: string }, {}>, res: Response<SuccessResponse | ErrorResponse>) => {
 const result = await profileService.createProfile(req.body.name);
 return res.status(result.statusCode).json(result.body);
};

export const searchProfiles = async (req: Request<{}, {}, {}, z.infer<typeof profileSearchSchema>>, res: Response<SuccessResponse | ErrorResponse>) => {
 const result = await profileService.searchProfiles(req.query);
 return res.status(result.statusCode).json(result.body);
};

export const getProfileById = async (req: Request<{ id: string }, {}, {}, {}>, res: Response<SuccessResponse | ErrorResponse>) => {
 const result = await profileService.getProfileById(req.params.id);
 return res.status(result.statusCode).json(result.body);
};

export const getProfiles = async (req: Request<{}, {}, {}, z.infer<typeof profileQuerySchema>>, res: Response<SuccessResponse | ErrorResponse>) => {
 const result = await profileService.getProfiles(req.query);
 return res.status(result.statusCode).json(result.body);
};

export const deleteProfile = async (req: Request<{ id: string }, {}, {}, {}>, res: Response) => {
 const result = await profileService.deleteProfile(req.params.id);
 return res.status(result.statusCode).json();
};