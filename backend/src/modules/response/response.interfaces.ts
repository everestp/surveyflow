import type {
  ResponseListQuery,
  SubmitResponseInput,
  SurveyResponse,
} from "./response.types.js";

export interface IResponseRepository {
  create(surveyId: string, input: SubmitResponseInput): Promise<SurveyResponse>;

  findBySurvey(
    surveyId: string,
    query: ResponseListQuery,
  ): Promise<{
    responses: SurveyResponse[];
    total: number;
  }>;
}

export interface ISurveyLookupRepository {
  findById(id: string): Promise<{
    id: string;
    title: string;
    status: "draft" | "published" | "archived";
    questions: import("../survey/survey.types.js").SurveyQuestion[];
    createdBy: string;
  } | null>;
}
