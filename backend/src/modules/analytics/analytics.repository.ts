import type { Pool } from "pg";

import type { IAnalyticsRepository } from "./analytics.interfaces.js";

import type {
  AnalyticsOverview,
  QuestionAnalytics,
  ResponseTrend,
  SurveyAnalytics,
} from "./analytics.types.js";

interface OverviewRow {
  total_surveys: string;
  published_surveys: string;
  draft_surveys: string;
  archived_surveys: string;
  total_responses: string;
}

interface TrendRow {
  date: string;
  count: string;
}

interface SurveyRow {
  id: string;
  title: string;
  questions: {
    id: string;
    title: string;
    type: string;
  }[];
  total_responses: string;
}

interface AnswerRow {
  question_id: string;
  value: string;
  count: string;
}

export class AnalyticsRepository implements IAnalyticsRepository {
  constructor(private readonly db: Pool) {}

  async getOverview(userId: string): Promise<AnalyticsOverview> {
    const result = await this.db.query<OverviewRow>(
      `SELECT
                COUNT(DISTINCT s.id)::text AS total_surveys,
                COUNT(DISTINCT s.id) FILTER (
                    WHERE s.status = 'published'
                )::text AS published_surveys,
                COUNT(DISTINCT s.id) FILTER (
                    WHERE s.status = 'draft'
                )::text AS draft_surveys,
                COUNT(DISTINCT s.id) FILTER (
                    WHERE s.status = 'archived'
                )::text AS archived_surveys,
                COUNT(r.id)::text AS total_responses
             FROM surveys s
             LEFT JOIN responses r ON r.survey_id = s.id
             WHERE s.created_by = $1`,
      [userId],
    );

    const row = result.rows[0];

    const totalSurveys = Number(row.total_surveys);
    const totalResponses = Number(row.total_responses);

    return {
      totalSurveys,
      publishedSurveys: Number(row.published_surveys),
      draftSurveys: Number(row.draft_surveys),
      archivedSurveys: Number(row.archived_surveys),
      totalResponses,
      averageResponsesPerSurvey:
        totalSurveys === 0
          ? 0
          : Number((totalResponses / totalSurveys).toFixed(2)),
    };
  }

  async getResponseTrend(
    userId: string,
    days: number,
  ): Promise<ResponseTrend[]> {
    const result = await this.db.query<TrendRow>(
      `SELECT
                TO_CHAR(DATE(r.submitted_at), 'YYYY-MM-DD') AS date,
                COUNT(r.id)::text AS count
             FROM responses r
             INNER JOIN surveys s ON s.id = r.survey_id
             WHERE s.created_by = $1
               AND r.submitted_at >= NOW() - ($2::int * INTERVAL '1 day')
             GROUP BY DATE(r.submitted_at)
             ORDER BY DATE(r.submitted_at) ASC`,
      [userId, days],
    );

    return result.rows.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  }

  async getSurveyAnalytics(
    surveyId: string,
    userId: string,
  ): Promise<SurveyAnalytics | null> {
    const surveyResult = await this.db.query<SurveyRow>(
      `SELECT
                s.id,
                s.title,
                s.questions,
                COUNT(r.id)::text AS total_responses
             FROM surveys s
             LEFT JOIN responses r ON r.survey_id = s.id
             WHERE s.id = $1
               AND s.created_by = $2
             GROUP BY s.id`,
      [surveyId, userId],
    );

    const survey = surveyResult.rows[0];

    if (!survey) return null;

    const answerResult = await this.db.query<AnswerRow>(
      `SELECT
                answer->>'questionId' AS question_id,
                answer->'value' AS value,
                COUNT(*)::text AS count
             FROM responses r
             CROSS JOIN LATERAL jsonb_array_elements(r.answers) AS answer
             WHERE r.survey_id = $1
             GROUP BY answer->>'questionId', answer->'value'`,
      [surveyId],
    );

    const questions: QuestionAnalytics[] = survey.questions.map((question) => {
      const rows = answerResult.rows.filter(
        (row) => row.question_id === question.id,
      );

      const totalAnswers = rows.reduce(
        (total, row) => total + Number(row.count),
        0,
      );

      return {
        questionId: question.id,
        questionTitle: question.title,
        questionType: question.type,
        totalAnswers,
        distribution: rows.map((row) => {
          const count = Number(row.count);

          return {
            value: row.value,
            count,
            percentage:
              totalAnswers === 0
                ? 0
                : Number(((count / totalAnswers) * 100).toFixed(2)),
          };
        }),
      };
    });

    return {
      surveyId: survey.id,
      surveyTitle: survey.title,
      totalResponses: Number(survey.total_responses),
      responseTrend: [],
      questions,
    };
  }
}
