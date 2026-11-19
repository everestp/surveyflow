import { Router } from "express";

import {
  authRoutes,
  surveyRoutes,
  responseRoutes,
  analyticsRoutes,
} from "../container.js";

const v1Routes = Router();

// API v1 modules
v1Routes.use("/auth", authRoutes);
v1Routes.use("/surveys", surveyRoutes);
v1Routes.use("/responses", responseRoutes);
v1Routes.use("/analytics", analyticsRoutes);

export { v1Routes };
