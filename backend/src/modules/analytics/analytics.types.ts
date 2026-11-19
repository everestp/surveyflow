export interface AnalyticsOverview {
  totalSurveys: number;
  publishedSurveys: number;
  draftSurveys: number;
  archivedSurveys: number;
  totalResponses: number;
  averageResponsesPerSurvey: number;
}

export interface ResponseTrend {
  date: string;
  count: number;
}

export interface QuestionAnalytics {
  questionId: string;
  questionTitle: string;
  questionType: string;
  totalAnswers: number;
  distribution: {
    value: string;
    count: number;
    percentage: number;
  }[];
}

export interface SurveyAnalytics {
  surveyId: string;
  surveyTitle: string;
  totalResponses: number;
  responseTrend: ResponseTrend[];
  questions: QuestionAnalytics[];
}
