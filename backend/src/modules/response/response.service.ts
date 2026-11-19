import type {
  IResponseRepository,
  ISurveyLookupRepository,
} from "./response.interfaces.js";

import type {
  ResponseListQuery,
  SubmitResponseInput,
  SurveyResponse,
} from "./response.types.js";

import type { SurveyQuestion } from "../survey/survey.types.js";

import { AppError } from "../../utils/app-error.js";
import logger from "../../services/logger.service.js";

export class ResponseService {
  constructor(
    private readonly responseRepository: IResponseRepository,
    private readonly surveyRepository: ISurveyLookupRepository,
  ) {}

  async submit(
    surveyId: string,
    input: SubmitResponseInput,
  ): Promise<SurveyResponse> {
    const survey = await this.surveyRepository.findById(surveyId);

    if (!survey || survey.status !== "published") {
      throw new AppError(404, "Published survey not found", "SURVEY_NOT_FOUND");
    }

    this.validateAnswers(survey.questions, input.answers);

    const response = await this.responseRepository.create(surveyId, input);

    logger.info("Survey response submitted", {
      surveyId,
      responseId: response.id,
    });

    return response;
  }

  async getBySurvey(
    surveyId: string,
    userId: string,
    query: ResponseListQuery,
  ): Promise<{
    responses: SurveyResponse[];
    total: number;
  }> {
    const survey = await this.surveyRepository.findById(surveyId);

    if (!survey || survey.createdBy !== userId) {
      throw new AppError(404, "Survey not found", "SURVEY_NOT_FOUND");
    }

    return this.responseRepository.findBySurvey(surveyId, query);
  }

  private validateAnswers(
    questions: SurveyQuestion[],
    answers: SubmitResponseInput["answers"],
  ): void {
    const questionMap = new Map(
      questions.map((question) => [question.id, question]),
    );

    const answerMap = new Map(
      answers.map((answer) => [answer.questionId, answer.value]),
    );

    if (answerMap.size !== answers.length) {
      throw new AppError(
        400,
        "Duplicate question answers are not allowed",
        "DUPLICATE_ANSWERS",
      );
    }

    for (const answer of answers) {
      const question = questionMap.get(answer.questionId);

      if (!question) {
        throw new AppError(
          400,
          "Answer references an unknown question",
          "INVALID_QUESTION",
        );
      }

      this.validateAnswerType(question, answer.value);
    }

    for (const question of questions) {
      const value = answerMap.get(question.id);
      const isVisible = this.isQuestionVisible(question, answerMap);

      if (!isVisible) continue;

      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);

      if (question.required && isEmpty) {
        throw new AppError(
          400,
          `Answer required for question: ${question.title}`,
          "REQUIRED_ANSWER_MISSING",
        );
      }
    }
  }

  private validateAnswerType(
    question: SurveyQuestion,
    value: string | number | boolean | string[],
  ): void {
    const invalid = (): never => {
      throw new AppError(
        400,
        `Invalid answer for question: ${question.title}`,
        "INVALID_ANSWER_TYPE",
      );
    };

    switch (question.type) {
      case "text":
      case "textarea":
        if (typeof value !== "string") invalid();
        break;

      case "email":
        if (
          typeof value !== "string" ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        )
          invalid();
        break;

      case "number":
      case "rating":
        if (typeof value !== "number" || !Number.isFinite(value)) {
          invalid();
        }
        if (question.type === "rating" && (value < 1 || value > 5)) invalid();
        break;

      case "single_choice":
        if (typeof value !== "string" || !question.options?.includes(value))
          invalid();
        break;

      case "multiple_choice":
        if (
          !Array.isArray(value) ||
          value.some((item) => !question.options?.includes(item))
        )
          invalid();
        break;

      case "date":
        if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
          invalid();
        break;

      case "yes_no":
        if (typeof value !== "boolean") invalid();
        break;
    }
  }

  private isQuestionVisible(
    question: SurveyQuestion,
    answers: Map<string, string | number | boolean | string[]>,
  ): boolean {
    if (!question.condition) return true;

    const dependencyValue = answers.get(question.condition.questionId);

    if (dependencyValue === undefined) return false;

    const expected = question.condition.value;

    switch (question.condition.operator) {
      case "equals":
        return JSON.stringify(dependencyValue) === JSON.stringify(expected);

      case "not_equals":
        return JSON.stringify(dependencyValue) !== JSON.stringify(expected);

      case "contains":
        if (Array.isArray(dependencyValue)) {
          return dependencyValue.includes(String(expected));
        }

        return (
          typeof dependencyValue === "string" &&
          dependencyValue.includes(String(expected))
        );
    }
  }
}
