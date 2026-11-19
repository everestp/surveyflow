export interface ResponseAnswer {
  questionId: string;
  value: string | number | boolean | string[];
}

export interface SubmitResponseInput {
  answers: ResponseAnswer[];
  respondentEmail?: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  answers: ResponseAnswer[];
  respondentEmail: string | null;
  submittedAt: Date;
}

export interface ResponseListQuery {
  page: number;
  limit: number;
}
