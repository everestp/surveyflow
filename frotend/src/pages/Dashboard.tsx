import { useCallback, useEffect, useState } from "react";
import { apiRequest, ApiError } from "../lib/api";

export interface SurveySummary {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "published" | string;
  responseCount?: number;
  createdAt?: string;
}

interface SurveysResponse {
  surveys?: SurveySummary[];
  items?: SurveySummary[];
  total?: number;
}

interface OverviewStats {
  totalSurveys?: number;
  publishedSurveys?: number;
  draftSurveys?: number;
  totalResponses?: number;
}

interface TrendPoint {
  date: string;
  count: number;
}

interface TrendResponse {
  trend?: TrendPoint[];
  points?: TrendPoint[];
}

interface DashboardProps {
  onNavigate: (path: string) => void;
}

function normalizeSurveys(
  data: SurveysResponse | SurveySummary[] | null,
): SurveySummary[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.surveys)) return data.surveys;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeTrend(
  data: TrendResponse | TrendPoint[] | null,
): TrendPoint[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.trend)) return data.trend;
  if (Array.isArray(data.points)) return data.points;
  return [];
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const [overview, setOverview] = useState<OverviewStats>({});
  const [trendTotal30d, setTrendTotal30d] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [surveysData, overviewData, trendData] = await Promise.all([
        apiRequest<SurveysResponse | SurveySummary[]>(
          "/surveys?page=1&limit=20",
        ),
        apiRequest<OverviewStats>("/analytics/overview").catch(() => ({})),
        apiRequest<TrendResponse | TrendPoint[]>(
          "/analytics/responses/trend?days=30",
        ).catch(() => []),
      ]);

      const list = normalizeSurveys(surveysData);
      setSurveys(list);
      setOverview(overviewData || {});

      const points = normalizeTrend(trendData);
      const sum = points.reduce(
        (acc, item) => acc + (Number(item.count) || 0),
        0,
      );
      setTrendTotal30d(sum);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handlePublish = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest(`/surveys/${id}/publish`, { method: "PATCH" });
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to publish survey",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest(`/surveys/${id}`, { method: "DELETE" });
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to delete survey",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyPublicLink = async (id: string) => {
    const publicUrl = `${window.location.origin}/s/${id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError(`Public link: ${publicUrl}`);
    }
  };

  const totalSurveys = overview.totalSurveys ?? surveys.length;
  const publishedSurveys =
    overview.publishedSurveys ??
    surveys.filter((s) => s.status === "published").length;
  const totalResponses =
    overview.totalResponses ??
    surveys.reduce((acc, s) => acc + (s.responseCount ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Surveys</h1>
          <p className="text-xs text-neutral-500">
            Manage drafts, publish public links, and inspect responses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("/builder")}
          className="rounded bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800"
        >
          Create survey
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded border border-neutral-200 bg-white p-3.5">
          <div className="text-xs text-neutral-500">Total surveys</div>
          <div className="mt-1 text-xl font-semibold text-neutral-900">
            {totalSurveys}
          </div>
        </div>
        <div className="rounded border border-neutral-200 bg-white p-3.5">
          <div className="text-xs text-neutral-500">Published</div>
          <div className="mt-1 text-xl font-semibold text-neutral-900">
            {publishedSurveys}
          </div>
        </div>
        <div className="rounded border border-neutral-200 bg-white p-3.5">
          <div className="text-xs text-neutral-500">Total responses</div>
          <div className="mt-1 text-xl font-semibold text-neutral-900">
            {totalResponses}
          </div>
        </div>
        <div className="rounded border border-neutral-200 bg-white p-3.5">
          <div className="text-xs text-neutral-500">Last 30 days</div>
          <div className="mt-1 text-xl font-semibold text-neutral-900">
            {trendTotal30d}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded border border-neutral-900 bg-neutral-100 px-3 py-2 text-xs text-neutral-900">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded border border-neutral-200 bg-white">
        {loading ? (
          <div className="p-6 text-xs text-neutral-500">Loading surveys...</div>
        ) : surveys.length === 0 ? (
          <div className="p-6 text-xs text-neutral-500">
            No surveys yet. Create one to get started.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Responses</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {surveys.map((survey) => {
                const isPublished = survey.status === "published";
                const isBusy = busyId === survey.id;

                return (
                  <tr key={survey.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">
                        {survey.title}
                      </div>
                      {survey.description && (
                        <div className="line-clamp-1 text-xs text-neutral-500">
                          {survey.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded border border-neutral-300 px-2 py-0.5 text-xs capitalize text-neutral-700">
                        {survey.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-700">
                      {survey.responseCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate(`/surveys/${survey.id}/results`)
                          }
                          className="rounded border border-neutral-300 px-2.5 py-1 text-neutral-800 hover:bg-neutral-100"
                        >
                          Results
                        </button>

                        {isPublished ? (
                          <button
                            type="button"
                            onClick={() => handleCopyPublicLink(survey.id)}
                            className="rounded border border-neutral-300 px-2.5 py-1 text-neutral-800 hover:bg-neutral-100"
                          >
                            {copiedId === survey.id ? "Copied" : "Copy link"}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handlePublish(survey.id)}
                              className="rounded bg-neutral-900 px-2.5 py-1 text-white hover:bg-neutral-800 disabled:opacity-50"
                            >
                              Publish
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(survey.id)}
                              className="rounded border border-neutral-300 px-2.5 py-1 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
