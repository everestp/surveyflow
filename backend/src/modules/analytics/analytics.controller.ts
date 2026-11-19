import type { RequestHandler } from "express";

import type { AnalyticsService } from "./analytics.service.js";

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  getOverview: RequestHandler = async (req, res) => {
    const overview = await this.analyticsService.getOverview(req.user!.id);

    res.status(200).json({
      success: true,
      data: { overview },
    });
  };

  getResponseTrend: RequestHandler = async (req, res) => {
    const query = (
      req as typeof req & {
        validatedQuery: { days: number };
      }
    ).validatedQuery;

    const trend = await this.analyticsService.getResponseTrend(
      req.user!.id,
      query.days,
    );

    res.status(200).json({
      success: true,
      data: { trend },
    });
  };

  getSurveyAnalytics: RequestHandler = async (req, res) => {
    const analytics = await this.analyticsService.getSurveyAnalytics(
      req.params.surveyId!,
      req.user!.id,
    );

    res.status(200).json({
      success: true,
      data: { analytics },
    });
  };
}
