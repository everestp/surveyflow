import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "../lib/api";
import { useAuth, type AuthUser } from "../lib/auth";

export interface SurveySummary {
  id: string;
  title: string;
  description?: string | null;
  status: "draft" | "published" | "archived" | string;
  responseCount?: number;
  createdAt?: string;
  createdBy?: string;
  userId?: string;
  ownerId?: string;
}

interface SurveysResponse {
  surveys?: SurveySummary[];
  items?: SurveySummary[];
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

function isOwnedByCurrentUser(
  survey: SurveySummary,
  user: AuthUser | null,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  const ownerId = survey.createdBy || survey.userId || survey.ownerId;
  if (!ownerId) return true;
  return ownerId === user.id;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const [overview, setOverview] = useState<OverviewStats>({});
  const [trendTotal30d, setTrendTotal30d] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadUserDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const surveysEndpoint =
        user?.role === "admin"
          ? "/surveys?page=1&limit=20"
          : "/surveys/mine?page=1&limit=20";

      const [mineData, overviewData, trendData] = await Promise.all([
        apiRequest<SurveysResponse | SurveySummary[]>(surveysEndpoint),
        apiRequest<OverviewStats>("/analytics/overview").catch(() => ({})),
        apiRequest<TrendResponse | TrendPoint[]>(
          "/analytics/responses/trend?days=30",
        ).catch(() => []),
      ]);

      const filteredSurveys = normalizeSurveys(mineData).filter((s) =>
        isOwnedByCurrentUser(s, user),
      );
      setSurveys(filteredSurveys);
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
  }, [user]);

  useEffect(() => {
    loadUserDashboard();
  }, [loadUserDashboard]);

  const handlePublish = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest(`/surveys/${id}/publish`, { method: "PATCH" });
      await loadUserDashboard();
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
      await loadUserDashboard();
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
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-neutral-900">
              My Dashboard
            </h1>
            {user?.role && (
              <span className="rounded border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium uppercase text-neutral-700">
                {user.role}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            {user?.role === "admin"
              ? `All surveys — signed in as ${user.email}.`
              : `Surveys created by ${user?.email || "your account"}.`}
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
          <div className="text-xs text-neutral-500">
            {user?.role === "admin" ? "Total surveys" : "My surveys"}
          </div>
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
          <div className="p-6 text-xs text-neutral-500">
            Loading your surveys...
          </div>
        ) : surveys.length === 0 ? (
          <div className="p-6 text-xs text-neutral-500">
            You have not created any surveys yet.
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
                const canDelete =
                  !isPublished && isOwnedByCurrentUser(survey, user);
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
                            {canDelete && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDelete(survey.id)}
                                className="rounded border border-neutral-300 px-2.5 py-1 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            )}
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
