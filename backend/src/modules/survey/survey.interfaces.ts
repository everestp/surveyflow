import type {
  CreateSurveyInput,
  PaginatedSurveys,
  Survey,
  SurveyListQuery,
  UpdateSurveyInput,
} from "./survey.types.js";

export interface ISurveyRepository {
  create(input: CreateSurveyInput, userId: string): Promise<Survey>;
  findById(id: string): Promise<Survey | null>;
  findAll(query: SurveyListQuery): Promise<PaginatedSurveys>;
  findAllByUserId(
    userId: string,
    query: SurveyListQuery,
  ): Promise<PaginatedSurveys>;
  update(
    id: string,
    userId: string,
    input: UpdateSurveyInput,
  ): Promise<Survey | null>;
  delete(id: string, userId: string): Promise<boolean>;
  publish(id: string, userId: string): Promise<Survey | null>;
}
