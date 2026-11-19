export type SurveyStatus = "draft" | "published" | "archived";

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "single_choice"
  | "multiple_choice"
  | "rating"
  | "date"
  | "yes_no";

export type ConditionOperator = "equals" | "not_equals" | "contains";

export interface QuestionCondition {
  questionId: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface SurveyQuestion {
  id: string;
  title: string;
  description?: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  order: number;
  condition?: QuestionCondition;
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  questions: SurveyQuestion[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  responseCount: Number;
}

export interface CreateSurveyInput {
  title: string;
  description?: string;
  questions?: SurveyQuestion[];
}

export interface UpdateSurveyInput {
  title?: string;
  description?: string | null;
  questions?: SurveyQuestion[];
  status?: SurveyStatus;
}

export interface SurveyListQuery {
  page: number;
  limit: number;
  status?: SurveyStatus;
}
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedSurveys extends PaginationMeta {
  surveys: Survey[];
}
