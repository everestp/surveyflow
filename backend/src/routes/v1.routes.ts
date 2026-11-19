import { Router } from "express";
import { authRoutes } from "../container.js";

export const v1Routes = Router();

v1Routes.use("/auth", authRoutes);
