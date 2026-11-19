import type { RequestHandler } from "express";
import type { SurveyService } from "./survey.service.js";
import { AppError } from "../../utils/api-error.js";

type ValidatedListQuery = {
  page: number;
  limit: number;
  status?: "draft" | "published" | "archived";
};

function getValidatedQuery(
  req: Parameters<RequestHandler>[0],
): ValidatedListQuery {
  return (req as typeof req & { validatedQuery: ValidatedListQuery })
    .validatedQuery;
}

function getIdParam(param: string | string[] | undefined): string {
  const id = Array.isArray(param) ? param[0] : param;
  if (!id || id.trim().length === 0) {
    throw new AppError(400, "Invalid survey ID", "INVALID_ID");
  }
  return id;
}

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
    const result = await this.surveyService.getAll(getValidatedQuery(req));

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getAllByUserId: RequestHandler = async (req, res) => {
    const result = await this.surveyService.getAllByUserId(
      req.user!.id,
      getValidatedQuery(req),
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getById: RequestHandler = async (req, res) => {
    const survey = await this.surveyService.getById(
      getIdParam(req.params.id),
      req.user?.id,
    );

    res.status(200).json({
      success: true,
      data: { survey },
    });
  };

  update: RequestHandler = async (req, res) => {
    const survey = await this.surveyService.update(
      getIdParam(req.params.id),
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
    await this.surveyService.delete(getIdParam(req.params.id), req.user!.id);

    res.status(200).json({
      success: true,
      message: "Survey deleted successfully",
    });
  };

  publish: RequestHandler = async (req, res) => {
    const survey = await this.surveyService.publish(
      getIdParam(req.params.id),
      req.user!.id,
    );

    res.status(200).json({
      success: true,
      message: "Survey published successfully",
      data: { survey },
    });
  };
}
