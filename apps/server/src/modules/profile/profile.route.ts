import { Router } from "express";
import { validateCreateProfile, validateProfilesFilter, validateSearchQuery } from "@/modules/profile/profile.middleware";
import { createProfile, deleteProfile, getProfileById, getProfiles, searchProfiles } from "@/modules/profile/profile.controller";

const router: Router = Router();

router.get('/', validateProfilesFilter, getProfiles);
router.get("/search", validateSearchQuery, searchProfiles);
router.get('/:id', getProfileById);
router.delete('/:id', deleteProfile);
router.post("/", validateCreateProfile, createProfile);

export default router;

