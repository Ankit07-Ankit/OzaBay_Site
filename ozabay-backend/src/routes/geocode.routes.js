import { Router } from "express";
import { geocodeLocation } from "../controllers/geocode.controller.js";

const geocodeRouter = Router();

geocodeRouter.post("/", geocodeLocation);

export default geocodeRouter;