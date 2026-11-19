import type { Pool } from "pg";

import type { ISurveyRepository } from "./survey.interfaces.js";

import type {
  CreateSurveyInput,
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
}

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
    };
  }

  async create(input: CreateSurveyInput, userId: string): Promise<Survey> {
    const result = await this.db.query<SurveyRow>(
      `INSERT INTO surveys (title, description, questions, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
      [
        input.title,
        input.description ?? null,
        JSON.stringify(input.questions ?? []),
        userId,
      ],
    );

    return this.mapSurvey(result.rows[0]);
  }

  async findById(id: string): Promise<Survey | null> {
    const result = await this.db.query<SurveyRow>(
      `SELECT * FROM surveys WHERE id = $1`,
      [id],
    );

    return result.rows[0] ? this.mapSurvey(result.rows[0]) : null;
  }

  async findAll(
    userId: string,
    query: SurveyListQuery,
  ): Promise<{ surveys: Survey[]; total: number }> {
    const offset = (query.page - 1) * query.limit;

    const conditions = ["created_by = $1"];
    const values: unknown[] = [userId];

    if (query.status) {
      values.push(query.status);
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
             FROM surveys
             WHERE ${whereClause}`,
      values,
    );

    const result = await this.db.query<SurveyRow>(
      `SELECT *
             FROM surveys
             WHERE ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${values.length + 1}
             OFFSET $${values.length + 2}`,
      [...values, query.limit, offset],
    );

    return {
      surveys: result.rows.map((row) => this.mapSurvey(row)),
      total: Number(countResult.rows[0].count),
    };
  }

  async update(
    id: string,
    userId: string,
    input: UpdateSurveyInput,
  ): Promise<Survey | null> {
    const result = await this.db.query<SurveyRow>(
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
             RETURNING *`,
      [
        id,
        userId,
        input.title ?? null,
        input.description !== undefined,
        input.description ?? null,
        input.questions ? JSON.stringify(input.questions) : null,
      ],
    );

    return result.rows[0] ? this.mapSurvey(result.rows[0]) : null;
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
    const result = await this.db.query<SurveyRow>(
      `UPDATE surveys
             SET
                status = 'published',
                published_at = NOW(),
                updated_at = NOW()
             WHERE id = $1
               AND created_by = $2
               AND status = 'draft'
             RETURNING *`,
      [id, userId],
    );

    return result.rows[0] ? this.mapSurvey(result.rows[0]) : null;
  }
}
