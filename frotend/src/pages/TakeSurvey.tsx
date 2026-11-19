import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
import { useAuth } from "../lib/auth";
import type {
  ConditionOperator,
  QuestionCondition,
  QuestionType,
} from "./Builder";

interface PublicQuestion {
  id: string;
  title: string;
  description?: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  order: number;
  condition?: QuestionCondition;
}

interface PublicSurvey {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  questions: PublicQuestion[];
}

interface SurveyLookupResponse {
  survey?: PublicSurvey;
}

type AnswerValue = string | number | boolean | string[];

interface TakeSurveyProps {
  surveyId: string;
  onNavigate: (path: string) => void;
}

function evaluateCondition(
  condition: QuestionCondition | undefined,
  answers: Record<string, AnswerValue>,
): boolean {
  if (!condition || !condition.questionId) return true;

  const actual = answers[condition.questionId];
  const target = String(condition.value).toLowerCase();
  const op: ConditionOperator = condition.operator || "equals";

  if (op === "contains") {
    if (Array.isArray(actual)) {
      return actual.some((item) => String(item).toLowerCase().includes(target));
    }
    if (actual === undefined || actual === null || actual === "") return false;
    return String(actual).toLowerCase().includes(target);
  }

  const matches = Array.isArray(actual)
    ? actual.map((v) => String(v).toLowerCase()).includes(target)
    : actual !== undefined &&
      actual !== null &&
      actual !== "" &&
      String(actual).toLowerCase() === target;

  return op === "not_equals" ? !matches : matches;
}

function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function TakeSurvey({ surveyId, onNavigate }: TakeSurveyProps) {
  const { isAuthenticated, user } = useAuth();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSurvey() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<SurveyLookupResponse | PublicSurvey>(
          `/surveys/${surveyId}`,
          { auth: false },
        );
        if (cancelled) return;
        const resolved =
          data && typeof data === "object" && "survey" in data && data.survey
            ? data.survey
            : (data as PublicSurvey);
        const sorted = [...(resolved.questions ?? [])].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
        setSurvey({ ...resolved, questions: sorted });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load survey",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSurvey();
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  const visibleQuestions = useMemo(() => {
    if (!survey) return [];
    return survey.questions.filter((q) =>
      evaluateCondition(q.condition, answers),
    );
  }, [survey, answers]);

  const setAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const toggleMultiChoice = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId])
        ? (prev[questionId] as string[])
        : [];
      const exists = current.includes(option);
      const next = exists
        ? current.filter((item) => item !== option)
        : [...current, option];
      return { ...prev, [questionId]: next };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!survey) return;
    setError(null);

    if (!isAuthenticated) {
      onNavigate("/login");
      return;
    }

    for (const q of visibleQuestions) {
      if (q.required && !isAnswered(answers[q.id])) {
        setError(`Please answer required question: "${q.title}"`);
        return;
      }
    }

    const formattedAnswers = visibleQuestions
      .filter((q) => isAnswered(answers[q.id]))
      .map((q) => ({
        questionId: q.id,
        value: answers[q.id],
      }));

    setSubmitting(true);
    try {
      await apiRequest(`/responses/${survey.id}`, {
        method: "POST",
        auth: true,
        body: {
          ...(user?.email ? { respondentEmail: user.email } : {}),
          answers: formattedAnswers,
        },
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onNavigate("/login");
        return;
      }
      setError(
        err instanceof ApiError ? err.message : "Failed to submit response",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-xs text-neutral-500">
        Loading survey...
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded border border-neutral-900 bg-neutral-100 p-4 text-xs text-neutral-900">
        {error}
      </div>
    );
  }

  if (!survey) return null;

  if (submitted) {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded border border-neutral-200 bg-white p-6">
        <h1 className="text-base font-semibold text-neutral-900">
          Response recorded
        </h1>
        <p className="mt-1 text-xs text-neutral-600">
          Thank you for completing {survey.title}.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onNavigate("/")}
            className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
          >
            Back to feed
          </button>
          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
              setError(null);
            }}
            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded border border-neutral-200 bg-white p-5">
        <h1 className="text-lg font-semibold text-neutral-900">
          {survey.title}
        </h1>
        {survey.description && (
          <p className="mt-1 text-xs text-neutral-600">{survey.description}</p>
        )}

        {!isAuthenticated && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
            <span className="text-neutral-700">
              Sign in is required to submit your response.
            </span>
            <button
              type="button"
              onClick={() => onNavigate("/login")}
              className="rounded bg-neutral-900 px-3 py-1 font-medium text-white hover:bg-neutral-800"
            >
              Sign in
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded border border-neutral-900 bg-neutral-100 px-3 py-2 text-xs text-neutral-900">
          {error}
        </div>
      )}

      <div className="mt-5 space-y-4">
        {visibleQuestions.map((q, index) => {
          const val = answers[q.id];

          return (
            <div
              key={q.id}
              className="rounded border border-neutral-200 bg-white p-4"
            >
              <label className="text-sm font-medium text-neutral-900">
                {index + 1}. {q.title}
                {q.required && (
                  <span className="ml-1 text-xs text-neutral-500">*</span>
                )}
              </label>

              {q.description && (
                <p className="mt-1 text-xs text-neutral-500">{q.description}</p>
              )}

              <div className="mt-3">
                {q.type === "text" && (
                  <input
                    type="text"
                    required={q.required}
                    value={typeof val === "string" ? val : ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                )}

                {q.type === "textarea" && (
                  <textarea
                    rows={3}
                    required={q.required}
                    value={typeof val === "string" ? val : ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                )}

                {q.type === "number" && (
                  <input
                    type="number"
                    required={q.required}
                    value={
                      typeof val === "number" || typeof val === "string"
                        ? String(val)
                        : ""
                    }
                    onChange={(e) =>
                      setAnswer(
                        q.id,
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                )}

                {q.type === "date" && (
                  <input
                    type="date"
                    required={q.required}
                    value={typeof val === "string" ? val : ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                )}

                {q.type === "email" && (
                  <input
                    type="email"
                    required={q.required}
                    value={typeof val === "string" ? val : ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                )}

                {q.type === "rating" && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((num) => {
                      const selected = val === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setAnswer(q.id, num)}
                          className={`h-9 w-9 rounded border text-xs font-medium ${
                            selected
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100"
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.type === "yes_no" && (
                  <div className="flex gap-2">
                    {[
                      { label: "Yes", value: true },
                      { label: "No", value: false },
                    ].map((choice) => {
                      const selected = val === choice.value;
                      return (
                        <button
                          key={choice.label}
                          type="button"
                          onClick={() => setAnswer(q.id, choice.value)}
                          className={`rounded border px-4 py-1.5 text-xs font-medium ${
                            selected
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100"
                          }`}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.type === "single_choice" && (
                  <div className="space-y-2">
                    {(q.options ?? []).map((opt) => (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-2.5 rounded border border-neutral-200 px-3 py-2 text-xs text-neutral-800 hover:bg-neutral-50"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={val === opt}
                          onChange={() => setAnswer(q.id, opt)}
                          className="border-neutral-300 text-neutral-900 focus:ring-0"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {q.type === "multiple_choice" && (
                  <div className="space-y-2">
                    {(q.options ?? []).map((opt) => {
                      const checked = Array.isArray(val) && val.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-center gap-2.5 rounded border border-neutral-200 px-3 py-2 text-xs text-neutral-800 hover:bg-neutral-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMultiChoice(q.id, opt)}
                            className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        {isAuthenticated ? (
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-neutral-900 px-5 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Response"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate("/login")}
            className="rounded bg-neutral-900 px-5 py-2 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Sign in to Submit
          </button>
        )}
      </div>
    </form>
  );
}
