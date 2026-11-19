import type {
  AnalyticsOverview,
  ResponseTrend,
  SurveyAnalytics,
} from "./analytics.types.js";

export interface IAnalyticsRepository {
  getOverview(userId: string): Promise<AnalyticsOverview>;

  getResponseTrend(userId: string, days: number): Promise<ResponseTrend[]>;

  getSurveyAnalytics(
    surveyId: string,
    userId: string,
  ): Promise<SurveyAnalytics | null>;
}
