import type { ISurveyRepository } from "./survey.interfaces.js";
import type {
  CreateSurveyInput,
  Survey,
  SurveyListQuery,
  UpdateSurveyInput,
} from "./survey.types.js";

import logger from "../../services/logger.service.js";
import { AppError } from "../../utils/api-error.js";

export class SurveyService {
  constructor(private readonly surveyRepository: ISurveyRepository) {}

  async create(input: CreateSurveyInput, userId: string): Promise<Survey> {
    this.validateQuestionConditions(input.questions ?? []);

    const survey = await this.surveyRepository.create(input, userId);

    logger.info("Survey created", {
      surveyId: survey.id,
      userId,
    });

    return survey;
  }

  async getById(id: string, userId?: string): Promise<Survey> {
    const survey = await this.surveyRepository.findById(id);

    if (!survey) {
      throw new AppError(404, "Survey not found", "SURVEY_NOT_FOUND");
    }

    const isPublished = survey.status === "published";
    const isOwner = Boolean(userId && survey.createdBy === userId);

    if (!isPublished && !isOwner) {
      throw new AppError(404, "Survey not found", "SURVEY_NOT_FOUND");
    }

    return survey;
  }

  async getAll(query: SurveyListQuery) {
    return this.surveyRepository.findAll({
      ...query,
      status: "published",
    });
  }

  async getAllByUserId(userId: string, query: SurveyListQuery) {
    return this.surveyRepository.findAllByUserId(userId, query);
  }

  async update(
    id: string,
    userId: string,
    input: UpdateSurveyInput,
  ): Promise<Survey> {
    if (input.questions) {
      this.validateQuestionConditions(input.questions);
    }

    const survey = await this.surveyRepository.update(id, userId, input);

    if (!survey) {
      throw new AppError(404, "Draft survey not found", "SURVEY_NOT_FOUND");
    }

    logger.info("Survey updated", {
      surveyId: id,
      userId,
    });

    return survey;
  }

  async delete(id: string, userId: string): Promise<void> {
    const deleted = await this.surveyRepository.delete(id, userId);

    if (!deleted) {
      throw new AppError(404, "Draft survey not found", "SURVEY_NOT_FOUND");
    }

    logger.info("Survey deleted", {
      surveyId: id,
      userId,
    });
  }

  async publish(id: string, userId: string): Promise<Survey> {
    const survey = await this.surveyRepository.findById(id);

    if (!survey || survey.createdBy !== userId) {
      throw new AppError(404, "Survey not found", "SURVEY_NOT_FOUND");
    }

    if (survey.questions.length === 0) {
      throw new AppError(
        400,
        "A survey must contain at least one question",
        "EMPTY_SURVEY",
      );
    }

    const publishedSurvey = await this.surveyRepository.publish(id, userId);

    if (!publishedSurvey) {
      throw new AppError(
        400,
        "Only draft surveys can be published",
        "SURVEY_CANNOT_BE_PUBLISHED",
      );
    }

    logger.info("Survey published", {
      surveyId: id,
      userId,
    });

    return publishedSurvey;
  }

  private validateQuestionConditions(
    questions: CreateSurveyInput["questions"],
  ): void {
    if (!questions) return;

    const questionIds = new Set(questions.map((question) => question.id));

    for (const question of questions) {
      if (
        question.condition &&
        !questionIds.has(question.condition.questionId)
      ) {
        throw new AppError(
          400,
          `Condition references an unknown question: ${question.condition.questionId}`,
          "INVALID_QUESTION_CONDITION",
        );
      }

      if (question.condition && question.condition.questionId === question.id) {
        throw new AppError(
          400,
          "A question cannot depend on itself",
          "INVALID_QUESTION_CONDITION",
        );
      }

      if (
        ["single_choice", "multiple_choice"].includes(question.type) &&
        (!question.options || question.options.length === 0)
      ) {
        throw new AppError(
          400,
          `Question "${question.title}" requires options`,
          "QUESTION_OPTIONS_REQUIRED",
        );
      }
    }
  }
}
