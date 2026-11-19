import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
import type { QuestionCondition, QuestionType } from "./Builder";

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
  description?: string;
  status?: string;
  questions: PublicQuestion[];
}

interface SurveyLookupResponse {
  survey?: PublicSurvey;
}

type AnswerValue = string | number | boolean | string[];

interface TakeSurveyProps {
  surveyId: string;
}

function evaluateCondition(
  condition: QuestionCondition | undefined,
  answers: Record<string, AnswerValue>,
): boolean {
  if (!condition || !condition.questionId) return true;

  const actual = answers[condition.questionId];
  const target = condition.value;

  const matches = Array.isArray(actual)
    ? actual.map(String).includes(String(target))
    : actual !== undefined &&
      actual !== "" &&
      String(actual).toLowerCase() === String(target).toLowerCase();

  return condition.operator === "not_equals" ? !matches : matches;
}

function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function TakeSurvey({ surveyId }: TakeSurveyProps) {
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [respondentEmail, setRespondentEmail] = useState("");
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
        let data: SurveyLookupResponse | PublicSurvey;
        try {
          data = await apiRequest<SurveyLookupResponse | PublicSurvey>(
            `/surveys/${surveyId}/public`,
            { auth: false },
          );
        } catch (err) {
          if (
            err instanceof ApiError &&
            (err.status === 404 || err.status === 405)
          ) {
            data = await apiRequest<SurveyLookupResponse | PublicSurvey>(
              `/surveys/${surveyId}`,
              { auth: false },
            );
          } else {
            throw err;
          }
        }

        if (cancelled) return;
        const resolved =
          data && typeof data === "object" && "survey" in data && data.survey
            ? data.survey
            : (data as PublicSurvey);

        if (!resolved || !Array.isArray(resolved.questions)) {
          throw new Error("Invalid survey response format");
        }

        const sorted = [...resolved.questions].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
        setSurvey({ ...resolved, questions: sorted });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Survey not found or unavailable",
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
        auth: false,
        body: {
          ...(respondentEmail.trim()
            ? { respondentEmail: respondentEmail.trim() }
            : {}),
          answers: formattedAnswers,
        },
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as
          | { errors?: Array<{ message?: string }> }
          | undefined;
        const firstDetail = details?.errors?.[0]?.message;
        setError(firstDetail ? `${err.message}: ${firstDetail}` : err.message);
      } else {
        setError("Failed to submit response");
      }
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
        <button
          type="button"
          onClick={() => {
            setAnswers({});
            setRespondentEmail("");
            setSubmitted(false);
            setError(null);
          }}
          className="mt-4 rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
        >
          Submit another response
        </button>
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

        <div className="mt-4 border-t border-neutral-100 pt-4">
          <label className="block text-xs font-medium text-neutral-700">
            Your Email (Optional)
          </label>
          <input
            type="email"
            value={respondentEmail}
            onChange={(e) => setRespondentEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>
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
              <div className="flex items-start justify-between gap-2">
                <label className="text-sm font-medium text-neutral-900">
                  {index + 1}. {q.title}
                  {q.required && (
                    <span className="ml-1 text-xs text-neutral-500">*</span>
                  )}
                </label>
              </div>

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

                {q.type === "email" && (
                  <input
                    type="email"
                    required={q.required}
                    value={typeof val === "string" ? val : ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder="name@example.com"
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
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-neutral-900 px-5 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Response"}
        </button>
      </div>
    </form>
  );
}
