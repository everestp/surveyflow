import type { RequestHandler } from "express";
import type { SurveyService } from "./survey.service.js";

export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  create: RequestHandler = async (req, res) => {
    const survey = await this.surveyService.create(req.body, req.user!.id);

    res.status(201).json({
      success: true,
      message: "Survey created successfully",
      data: { survey },
    });
  };

  getAll: RequestHandler = async (req, res) => {
    const result = await this.surveyService.getAll(
      req.user!.id,
      (
        req as typeof req & {
          validatedQuery: {
            page: number;
            limit: number;
            status?: "draft" | "published" | "archived";
          };
        }
      ).validatedQuery,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getById: RequestHandler = async (req, res) => {
    const survey = await this.surveyService.getById(
      String(req.params.id!),
      req.user!.id,
    );

    res.status(200).json({
      success: true,
      data: { survey },
    });
  };

  update: RequestHandler = async (req, res) => {
    const survey = await this.surveyService.update(
      req.params.id!,
      req.user!.id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Survey updated successfully",
      data: { survey },
    });
  };

  delete: RequestHandler = async (req, res) => {
    await this.surveyService.delete(req.params.id!, req.user!.id);

    res.status(200).json({
      success: true,
      message: "Survey deleted successfully",
    });
  };

  publish: RequestHandler = async (req, res) => {
    const survey = await this.surveyService.publish(
      req.params.id!,
      req.user!.id,
    );

    res.status(200).json({
      success: true,
      message: "Survey published successfully",
      data: { survey },
    });
  };
}
