import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "../lib/api";

export interface FeedSurveyItem {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  responseCount?: number;
  createdAt?: string;
}

interface FeedResponse {
  surveys?: FeedSurveyItem[];
  items?: FeedSurveyItem[];
}

interface FeedProps {
  onNavigate: (path: string) => void;
}

function normalizeFeedSurveys(
  data: FeedResponse | FeedSurveyItem[] | null,
): FeedSurveyItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.surveys)) return data.surveys;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

export function Feed({ onNavigate }: FeedProps) {
  const [surveys, setSurveys] = useState<FeedSurveyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<FeedResponse | FeedSurveyItem[]>(
        "/surveys?page=1&limit=30&status=published",
        { auth: false },
      );
      const published = normalizeFeedSurveys(data).filter(
        (s) => !s.status || s.status === "published",
      );
      setSurveys(published);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load surveys feed",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            Survey Feed
          </h1>
          <p className="text-xs text-neutral-500">
            Browse published surveys. Sign in is required when submitting a
            response.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={loadFeed}
          className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded border border-neutral-900 bg-neutral-100 px-3 py-2 text-xs text-neutral-900"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-xs text-neutral-500">Loading surveys...</div>
      ) : surveys.length === 0 ? (
        <div className="mt-6 rounded border border-neutral-200 bg-white p-6 text-xs text-neutral-500">
          No published surveys available yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {surveys.map((survey) => (
            <div
              key={survey.id}
              className="flex flex-col justify-between rounded border border-neutral-200 bg-white p-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-neutral-900">
                    {survey.title}
                  </h2>
                  {survey.status && (
                    <span className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] capitalize text-neutral-700">
                      {survey.status}
                    </span>
                  )}
                </div>
                {survey.description && (
                  <p className="mt-1.5 text-xs text-neutral-600">
                    {survey.description}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs">
                <span className="text-neutral-500">
                  {survey.responseCount ?? 0} responses
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate(`/s/${survey.id}`)}
                  className="rounded bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-800"
                >
                  Open survey
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
