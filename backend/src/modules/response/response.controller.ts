import type { RequestHandler } from "express";
import type { ResponseService } from "./response.service.js";

export class ResponseController {
  constructor(private readonly responseService: ResponseService) {}

  submit: RequestHandler = async (req, res) => {
    const response = await this.responseService.submit(
      String(req.params.surveyId!),
      req.body,
    );

    res.status(201).json({
      success: true,
      message: "Response submitted successfully",
      data: { response },
    });
  };

  getBySurvey: RequestHandler = async (req, res) => {
    const query = (
      req as typeof req & {
        validatedQuery: {
          page: number;
          limit: number;
        };
      }
    ).validatedQuery;

    const result = await this.responseService.getBySurvey(
      String(req.params.surveyId!),
      req.user!.id,
      query,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
