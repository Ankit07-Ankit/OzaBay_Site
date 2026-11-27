import { Router } from "express";
import { geocodeLocation } from "../controllers/geocode.controller.js";
import requireAuth from "../middleware/auth.middleware.js";

const geocodeRouter = Router();

geocodeRouter.post("/", requireAuth, geocodeLocation);

export default geocodeRouter;
