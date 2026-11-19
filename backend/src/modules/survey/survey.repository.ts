import type { Pool } from "pg";

import type { ISurveyRepository } from "./survey.interfaces.js";

import type {
  CreateSurveyInput,
  PaginatedSurveys,
  Survey,
  SurveyListQuery,
  SurveyQuestion,
  SurveyStatus,
  UpdateSurveyInput,
} from "./survey.types.js";

interface SurveyRow {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  questions: SurveyQuestion[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  response_count: string; // pg returns BIGINT / COUNT(*) as string
}

const SURVEY_WITH_COUNT_SELECT = `
  SELECT
    s.*,
    COUNT(r.id)::text AS response_count
  FROM surveys s
  LEFT JOIN responses r ON r.survey_id = s.id
`;

export class SurveyRepository implements ISurveyRepository {
  constructor(private readonly db: Pool) {}

  private mapSurvey(row: SurveyRow): Survey {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      questions: row.questions,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      responseCount: Number(row.response_count ?? 0),
    };
  }

  private async queryPaginatedSurveys(
    baseConditions: string[],
    baseValues: unknown[],
    query: SurveyListQuery,
  ): Promise<PaginatedSurveys> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const offset = (page - 1) * limit;

    const conditions = [...baseConditions];
    const values = [...baseValues];

    if (query.status) {
      values.push(query.status);
      conditions.push(`s.status = $${values.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM surveys s
       ${whereClause}`,
      values,
    );

    const result = await this.db.query<SurveyRow>(
      `${SURVEY_WITH_COUNT_SELECT}
       ${whereClause}
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    const total = Number(countResult.rows[0]?.count ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      surveys: result.rows.map((row) => this.mapSurvey(row)),
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async create(input: CreateSurveyInput, userId: string): Promise<Survey> {
    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO surveys (title, description, questions, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        input.title,
        input.description ?? null,
        JSON.stringify(input.questions ?? []),
        userId,
      ],
    );

    const created = await this.findById(inserted.rows[0].id);
    return created!;
  }

  async findById(id: string): Promise<Survey | null> {
    const result = await this.db.query<SurveyRow>(
      `${SURVEY_WITH_COUNT_SELECT}
       WHERE s.id = $1
       GROUP BY s.id`,
      [id],
    );

    return result.rows[0] ? this.mapSurvey(result.rows[0]) : null;
  }

  async findAll(query: SurveyListQuery): Promise<PaginatedSurveys> {
    return this.queryPaginatedSurveys([], [], query);
  }

  async findAllByUserId(
    userId: string,
    query: SurveyListQuery,
  ): Promise<PaginatedSurveys> {
    return this.queryPaginatedSurveys(["s.created_by = $1"], [userId], query);
  }

  async update(
    id: string,
    userId: string,
    input: UpdateSurveyInput,
  ): Promise<Survey | null> {
    const updated = await this.db.query<{ id: string }>(
      `UPDATE surveys
       SET
         title = COALESCE($3, title),
         description = CASE
           WHEN $4::boolean THEN $5
           ELSE description
         END,
         questions = COALESCE($6::jsonb, questions),
         updated_at = NOW()
       WHERE id = $1
         AND created_by = $2
         AND status = 'draft'
       RETURNING id`,
      [
        id,
        userId,
        input.title ?? null,
        input.description !== undefined,
        input.description ?? null,
        input.questions ? JSON.stringify(input.questions) : null,
      ],
    );

    if (!updated.rows[0]) {
      return null;
    }

    return this.findById(updated.rows[0].id);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM surveys
       WHERE id = $1
         AND created_by = $2
         AND status = 'draft'`,
      [id, userId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async publish(id: string, userId: string): Promise<Survey | null> {
    const published = await this.db.query<{ id: string }>(
      `UPDATE surveys
       SET
         status = 'published',
         published_at = NOW(),
         updated_at = NOW()
       WHERE id = $1
         AND created_by = $2
         AND status = 'draft'
       RETURNING id`,
      [id, userId],
    );

    if (!published.rows[0]) {
      return null;
    }

    return this.findById(published.rows[0].id);
  }
}
