import type { RequestHandler } from "express";
import type { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register: RequestHandler = async (req, res) => {
    const result = await this.authService.register(
      req.body.email,
      req.body.password,
    );

    res.status(201).json({
      success: true,
      message: "Administrator registered successfully",
      data: result,
    });
  };

  login: RequestHandler = async (req, res) => {
    const result = await this.authService.login({
      email: req.body.email,
      password: req.body.password,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  };

  me: RequestHandler = async (req, res) => {
    const user = await this.authService.getCurrentUser(req.user!.id);

    res.status(200).json({
      success: true,
      data: { user },
    });
  };
}
