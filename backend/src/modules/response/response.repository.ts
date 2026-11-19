import type { Pool } from "pg";

import type { IResponseRepository } from "./response.interfaces.js";
import type {
  ResponseListQuery,
  SubmitResponseInput,
  SurveyResponse,
} from "./response.types.js";

interface ResponseRow {
  id: string;
  survey_id: string;
  answers: SurveyResponse["answers"];
  respondent_email: string | null;
  submitted_at: Date;
}

export class ResponseRepository implements IResponseRepository {
  constructor(private readonly db: Pool) {}

  private mapResponse(row: ResponseRow): SurveyResponse {
    return {
      id: row.id,
      surveyId: row.survey_id,
      answers: row.answers,
      respondentEmail: row.respondent_email,
      submittedAt: row.submitted_at,
    };
  }

  async create(
    surveyId: string,
    input: SubmitResponseInput,
  ): Promise<SurveyResponse> {
    const result = await this.db.query<ResponseRow>(
      `INSERT INTO responses (
                survey_id,
                answers,
                respondent_email
            )
            VALUES ($1, $2::jsonb, $3)
            RETURNING *`,
      [surveyId, JSON.stringify(input.answers), input.respondentEmail ?? null],
    );

    return this.mapResponse(result.rows[0]);
  }

  async findBySurvey(
    surveyId: string,
    query: ResponseListQuery,
  ): Promise<{
    responses: SurveyResponse[];
    total: number;
  }> {
    const offset = (query.page - 1) * query.limit;

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
             FROM responses
             WHERE survey_id = $1`,
      [surveyId],
    );

    const result = await this.db.query<ResponseRow>(
      `SELECT *
             FROM responses
             WHERE survey_id = $1
             ORDER BY submitted_at DESC
             LIMIT $2 OFFSET $3`,
      [surveyId, query.limit, offset],
    );

    return {
      responses: result.rows.map((row) => this.mapResponse(row)),
      total: Number(countResult.rows[0].count),
    };
  }
}
