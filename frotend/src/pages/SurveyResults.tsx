import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "../lib/api";

interface AnswerEntry {
  questionId: string;
  value: string | number | boolean | string[];
}

interface SurveyResponseRecord {
  id: string;
  respondentEmail?: string;
  submittedAt?: string;
  createdAt?: string;
  answers: AnswerEntry[];
}

interface ResponsesPayload {
  responses?: SurveyResponseRecord[];
  items?: SurveyResponseRecord[];
  total?: number;
  page?: number;
  limit?: number;
}

interface QuestionAnalytics {
  questionId: string;
  title?: string;
  type?: string;
  totalAnswers?: number;
  average?: number;
  distribution?: Record<string, number>;
  counts?: Record<string, number>;
}

interface SurveyAnalyticsPayload {
  surveyId?: string;
  title?: string;
  status?: string;
  totalResponses?: number;
  questions?: QuestionAnalytics[];
}

interface SurveyDetail {
  id: string;
  title: string;
  description?: string;
  status?: string;
  questions?: Array<{
    id: string;
    title: string;
    type?: string;
  }>;
}

interface SurveyResultsProps {
  surveyId: string;
  onNavigate: (path: string) => void;
}

function normalizeResponses(
  data: ResponsesPayload | SurveyResponseRecord[] | null,
): SurveyResponseRecord[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.responses)) return data.responses;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function formatAnswerValue(val: AnswerEntry["value"]): string {
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (val === null || val === undefined) return "—";
  return String(val);
}

export function SurveyResults({ surveyId, onNavigate }: SurveyResultsProps) {
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [analytics, setAnalytics] = useState<SurveyAnalyticsPayload | null>(
    null,
  );
  const [responses, setResponses] = useState<SurveyResponseRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalResponses, setTotalResponses] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [surveyRes, analyticsRes, responsesRes] = await Promise.all([
        apiRequest<{ survey?: SurveyDetail } | SurveyDetail>(
          `/surveys/${surveyId}`,
        ).catch(() => null),
        apiRequest<SurveyAnalyticsPayload>(
          `/analytics/surveys/${surveyId}`,
        ).catch(() => null),
        apiRequest<ResponsesPayload | SurveyResponseRecord[]>(
          `/responses/${surveyId}?page=${page}&limit=${limit}`,
        ),
      ]);

      if (surveyRes) {
        const resolvedSurvey =
          "survey" in surveyRes && surveyRes.survey
            ? surveyRes.survey
            : (surveyRes as SurveyDetail);
        setSurvey(resolvedSurvey);
      }

      setAnalytics(analyticsRes);

      const list = normalizeResponses(responsesRes);
      setResponses(list);

      if (
        responsesRes &&
        !Array.isArray(responsesRes) &&
        typeof responsesRes.total === "number"
      ) {
        setTotalResponses(responsesRes.total);
      } else if (typeof analyticsRes?.totalResponses === "number") {
        setTotalResponses(analyticsRes.totalResponses);
      } else {
        setTotalResponses(list.length);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load survey results",
      );
    } finally {
      setLoading(false);
    }
  }, [surveyId, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const questionTitleById = new Map<string, string>();
  for (const q of survey?.questions ?? []) {
    questionTitleById.set(q.id, q.title);
  }
  for (const aq of analytics?.questions ?? []) {
    if (aq.title && !questionTitleById.has(aq.questionId)) {
      questionTitleById.set(aq.questionId, aq.title);
    }
  }

  const questionStats = analytics?.questions ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div>
          <button
            type="button"
            onClick={() => onNavigate("/")}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            ← Back to surveys
          </button>
          <h1 className="mt-1 text-lg font-semibold text-neutral-900">
            {survey?.title || analytics?.title || "Survey Results"}
          </h1>
          <p className="text-xs text-neutral-500">
            Status:{" "}
            <span className="capitalize">
              {survey?.status || analytics?.status || "—"}
            </span>{" "}
            · Total submissions: {totalResponses}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            window.open(
              `${window.location.origin}/s/${surveyId}`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
        >
          Open public link
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded border border-neutral-900 bg-neutral-100 px-3 py-2 text-xs text-neutral-900">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-xs text-neutral-500">Loading results...</div>
      ) : (
        <>
          {questionStats.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-neutral-900">
                Question Breakdown
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {questionStats.map((stat, idx) => {
                  const breakdown = stat.distribution || stat.counts || {};
                  const entries = Object.entries(breakdown);

                  return (
                    <div
                      key={stat.questionId || idx}
                      className="rounded border border-neutral-200 bg-white p-4"
                    >
                      <div className="text-xs font-medium text-neutral-900">
                        {idx + 1}.{" "}
                        {stat.title ||
                          questionTitleById.get(stat.questionId) ||
                          stat.questionId}
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-500">
                        Answers: {stat.totalAnswers ?? 0}
                        {typeof stat.average === "number"
                          ? ` · Avg: ${stat.average.toFixed(2)}`
                          : ""}
                      </div>

                      {entries.length > 0 && (
                        <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-2.5 text-xs">
                          {entries.map(([key, count]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between text-neutral-700"
                            >
                              <span className="truncate pr-2">{key}</span>
                              <span className="font-mono text-neutral-900">
                                {count}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">
                Submissions
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-neutral-300 px-2.5 py-1 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-neutral-500">Page {page}</span>
                <button
                  type="button"
                  disabled={responses.length < limit}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-neutral-300 px-2.5 py-1 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {responses.length === 0 ? (
                <div className="rounded border border-neutral-200 bg-white p-5 text-xs text-neutral-500">
                  No responses collected yet.
                </div>
              ) : (
                responses.map((rec, rIdx) => {
                  const timestamp = rec.submittedAt || rec.createdAt;
                  return (
                    <div
                      key={rec.id || rIdx}
                      className="rounded border border-neutral-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2 text-xs text-neutral-500">
                        <span className="font-medium text-neutral-800">
                          {rec.respondentEmail || "Anonymous respondent"}
                        </span>
                        <span>
                          {timestamp
                            ? new Date(timestamp).toLocaleString()
                            : `#${(page - 1) * limit + rIdx + 1}`}
                        </span>
                      </div>

                      <dl className="mt-3 space-y-2 text-xs">
                        {(rec.answers ?? []).map((ans, aIdx) => (
                          <div
                            key={`${ans.questionId}-${aIdx}`}
                            className="grid gap-1 sm:grid-cols-3"
                          >
                            <dt className="font-medium text-neutral-600">
                              {questionTitleById.get(ans.questionId) ||
                                ans.questionId}
                            </dt>
                            <dd className="text-neutral-900 sm:col-span-2">
                              {formatAnswerValue(ans.value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
