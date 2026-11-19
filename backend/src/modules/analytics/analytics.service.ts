import type { IAnalyticsRepository } from "./analytics.interfaces.js";

import type {
  AnalyticsOverview,
  ResponseTrend,
  SurveyAnalytics,
} from "./analytics.types.js";

import { AppError } from "../../utils/app-error.js";
import logger from "../../services/logger.service.js";

export class AnalyticsService {
  constructor(private readonly analyticsRepository: IAnalyticsRepository) {}

  async getOverview(userId: string): Promise<AnalyticsOverview> {
    const overview = await this.analyticsRepository.getOverview(userId);

    logger.info("Analytics overview retrieved", { userId });

    return overview;
  }

  async getResponseTrend(
    userId: string,
    days: number,
  ): Promise<ResponseTrend[]> {
    if (days < 1 || days > 365) {
      throw new AppError(
        400,
        "Days must be between 1 and 365",
        "INVALID_DATE_RANGE",
      );
    }

    return this.analyticsRepository.getResponseTrend(userId, days);
  }

  async getSurveyAnalytics(
    surveyId: string,
    userId: string,
  ): Promise<SurveyAnalytics> {
    const analytics = await this.analyticsRepository.getSurveyAnalytics(
      surveyId,
      userId,
    );

    if (!analytics) {
      throw new AppError(404, "Survey not found", "SURVEY_NOT_FOUND");
    }

    return analytics;
  }
}
