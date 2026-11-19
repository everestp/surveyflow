import { useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "email"
  | "rating"
  | "single_choice"
  | "multiple_choice"
  | "yes_no";

export type ConditionOperator = "equals" | "not_equals" | "contains";

export interface QuestionCondition {
  questionId: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface SurveyQuestion {
  id: string;
  title: string;
  description?: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  order: number;
  condition?: QuestionCondition;
}

interface CreateSurveyResponse {
  survey?: {
    id: string;
    status?: string;
  };
  id?: string;
}

interface BuilderProps {
  onNavigate: (path: string) => void;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "rating", label: "Rating (1–5)" },
  { value: "single_choice", label: "Single Choice" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "yes_no", label: "Yes / No" },
];

function createQuestion(order: number): SurveyQuestion {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    type: "text",
    required: true,
    options: [],
    order,
  };
}

function hasOptions(type: QuestionType): boolean {
  return type === "single_choice" || type === "multiple_choice";
}

function defaultValueForQuestion(
  q: SurveyQuestion | undefined,
): string | number | boolean {
  if (!q) return "";
  if (q.type === "yes_no") return true;
  if (q.type === "rating") return 5;
  if (q.options && q.options.length > 0) return q.options[0];
  return "";
}

export function Builder({ onNavigate }: BuilderProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<SurveyQuestion[]>(() => [
    createQuestion(0),
  ]);
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reindex = (items: SurveyQuestion[]): SurveyQuestion[] =>
    items.map((item, idx) => ({ ...item, order: idx }));

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createQuestion(prev.length)]);
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev
        .filter((q) => q.id !== id)
        .map((q) =>
          q.condition?.questionId === id ? { ...q, condition: undefined } : q,
        );
      return reindex(filtered);
    });
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return reindex(copy);
    });
  };

  const updateQuestion = (id: string, patch: Partial<SurveyQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const nextType = patch.type ?? q.type;
        const nextOptions = hasOptions(nextType)
          ? (patch.options ?? q.options ?? [])
          : undefined;
        return {
          ...q,
          ...patch,
          type: nextType,
          options: nextOptions,
        };
      }),
    );
  };

  const addOption = (questionId: string) => {
    const raw = (optionDrafts[questionId] || "").trim();
    if (!raw) return;

    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const existing = q.options ?? [];
        if (existing.includes(raw)) return q;
        return { ...q, options: [...existing, raw] };
      }),
    );
    setOptionDrafts((prev) => ({ ...prev, [questionId]: "" }));
  };

  const removeOption = (questionId: string, optionToRemove: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        return {
          ...q,
          options: (q.options ?? []).filter((opt) => opt !== optionToRemove),
        };
      }),
    );
  };

  const toggleCondition = (
    q: SurveyQuestion,
    index: number,
    enabled: boolean,
  ) => {
    if (!enabled) {
      updateQuestion(q.id, { condition: undefined });
      return;
    }
    const priorQuestions = questions.slice(0, index);
    const first = priorQuestions[0];
    if (!first) return;

    updateQuestion(q.id, {
      condition: {
        questionId: first.id,
        operator: "equals",
        value: defaultValueForQuestion(first),
      },
    });
  };

  const handleConditionSourceChange = (
    targetQuestionId: string,
    newSourceId: string,
  ) => {
    const nextSource = questions.find((item) => item.id === newSourceId);
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== targetQuestionId || !q.condition) return q;
        return {
          ...q,
          condition: {
            ...q.condition,
            questionId: newSourceId,
            value: defaultValueForQuestion(nextSource),
          },
        };
      }),
    );
  };

  const updateConditionValue = (
    questionId: string,
    value: string | number | boolean,
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || !q.condition) return q;
        return {
          ...q,
          condition: {
            ...q.condition,
            value,
          },
        };
      }),
    );
  };

  const updateConditionOperator = (
    questionId: string,
    operator: "equals" | "not_equals",
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || !q.condition) return q;
        return {
          ...q,
          condition: {
            ...q.condition,
            operator,
          },
        };
      }),
    );
  };

  const buildPayloadQuestions = () =>
    questions.map((q, idx) => {
      const cleanedCondition =
        q.condition && q.condition.questionId
          ? {
              questionId: q.condition.questionId,
              operator: q.condition.operator,
              value: q.condition.value,
            }
          : undefined;

      return {
        id: q.id,
        title: q.title.trim(),
        ...(q.description?.trim() ? { description: q.description.trim() } : {}),
        type: q.type,
        required: q.required,
        ...(hasOptions(q.type) ? { options: q.options ?? [] } : {}),
        order: idx,
        ...(cleanedCondition ? { condition: cleanedCondition } : {}),
      };
    });

  const handleSave = async (e: FormEvent, publishAfter = false) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Survey title is required.");
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.title.trim()) {
        setError(`Question ${i + 1} needs a title.`);
        return;
      }
      if (hasOptions(q.type) && (!q.options || q.options.length < 2)) {
        setError(`Question ${i + 1} requires at least 2 options.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        questions: buildPayloadQuestions(),
      };

      const created = await apiRequest<CreateSurveyResponse>("/surveys", {
        method: "POST",
        body: payload,
      });

      const surveyId = created?.survey?.id || created?.id;
      if (publishAfter && surveyId) {
        await apiRequest(`/surveys/${surveyId}/publish`, { method: "PATCH" });
      }

      onNavigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save survey");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => handleSave(e, false)}
      className="mx-auto max-w-3xl px-4 py-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            Create Survey
          </h1>
          <p className="text-xs text-neutral-500">
            Define questions, options, and conditional visibility rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate("/")}
            className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded border border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={(e) => handleSave(e, true)}
            className="rounded bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save & Publish"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded border border-neutral-900 bg-neutral-100 px-3 py-2 text-xs text-neutral-900">
          {error}
        </div>
      )}

      <div className="mt-5 space-y-4 rounded border border-neutral-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-neutral-700">
            Survey Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Developer Experience Survey"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700">
            Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief context shown to respondents."
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {questions.map((q, index) => {
          const priorQuestions = questions.slice(0, index);
          const sourceQuestion = questions.find(
            (item) => item.id === q.condition?.questionId,
          );

          return (
            <div
              key={q.id}
              className="space-y-3 rounded border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-900">
                    Q{index + 1}
                  </span>
                  <span className="font-mono text-[11px] text-neutral-400">
                    {q.id.slice(0, 8)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveQuestion(index, -1)}
                    className="rounded border border-neutral-300 px-2 py-0.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    disabled={index === questions.length - 1}
                    onClick={() => moveQuestion(index, 1)}
                    className="rounded border border-neutral-300 px-2 py-0.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    Down
                  </button>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      className="rounded border border-neutral-300 px-2 py-0.5 text-neutral-700 hover:bg-neutral-100"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-700">
                    Question Prompt
                  </label>
                  <input
                    type="text"
                    required
                    value={q.title}
                    onChange={(e) =>
                      updateQuestion(q.id, { title: e.target.value })
                    }
                    placeholder="Enter question text"
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700">
                    Type
                  </label>
                  <select
                    value={q.type}
                    onChange={(e) =>
                      updateQuestion(q.id, {
                        type: e.target.value as QuestionType,
                      })
                    }
                    className="mt-1 w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700">
                  Help Text (Optional)
                </label>
                <input
                  type="text"
                  value={q.description || ""}
                  onChange={(e) =>
                    updateQuestion(q.id, { description: e.target.value })
                  }
                  placeholder="Optional instruction for respondents"
                  className="mt-1 w-full rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none"
                />
              </div>

              {hasOptions(q.type) && (
                <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
                  <label className="block text-xs font-medium text-neutral-700">
                    Options
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="text"
                      value={optionDrafts[q.id] || ""}
                      onChange={(e) =>
                        setOptionDrafts((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addOption(q.id);
                        }
                      }}
                      placeholder="Add an option and press Add"
                      className="flex-1 rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => addOption(q.id)}
                      className="rounded border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
                    >
                      Add
                    </button>
                  </div>

                  {(q.options ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(q.options ?? []).map((opt) => (
                        <span
                          key={opt}
                          className="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-800"
                        >
                          {opt}
                          <button
                            type="button"
                            onClick={() => removeOption(q.id, opt)}
                            className="text-neutral-400 hover:text-neutral-900"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-2.5 text-xs">
                <label className="inline-flex items-center gap-2 text-neutral-700">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) =>
                      updateQuestion(q.id, { required: e.target.checked })
                    }
                    className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                  />
                  Required question
                </label>

                {priorQuestions.length > 0 && (
                  <label className="inline-flex items-center gap-2 text-neutral-700">
                    <input
                      type="checkbox"
                      checked={Boolean(q.condition)}
                      onChange={(e) =>
                        toggleCondition(q, index, e.target.checked)
                      }
                      className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                    />
                    Conditional visibility
                  </label>
                )}
              </div>

              {q.condition && priorQuestions.length > 0 && (
                <div className="grid gap-2 rounded border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] text-neutral-500">
                      Show only when question
                    </label>
                    <select
                      value={q.condition.questionId}
                      onChange={(e) =>
                        handleConditionSourceChange(q.id, e.target.value)
                      }
                      className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
                    >
                      {priorQuestions.map((candidate, cIdx) => (
                        <option key={candidate.id} value={candidate.id}>
                          Q{cIdx + 1}: {candidate.title || "Untitled"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-500">
                      Condition
                    </label>
                    <select
                      value={q.condition.operator}
                      onChange={(e) =>
                        updateConditionOperator(
                          q.id,
                          e.target.value as "equals" | "not_equals",
                        )
                      }
                      className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
                    >
                      <option value="equals">Equals</option>
                      <option value="not_equals">Does not equal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-500">
                      Target value
                    </label>
                    {sourceQuestion?.type === "yes_no" ? (
                      <select
                        value={String(q.condition.value)}
                        onChange={(e) =>
                          updateConditionValue(q.id, e.target.value === "true")
                        }
                        className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : sourceQuestion?.type === "rating" ? (
                      <select
                        value={String(q.condition.value)}
                        onChange={(e) =>
                          updateConditionValue(q.id, Number(e.target.value))
                        }
                        className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    ) : sourceQuestion &&
                      hasOptions(sourceQuestion.type) &&
                      (sourceQuestion.options?.length ?? 0) > 0 ? (
                      <select
                        value={String(q.condition.value)}
                        onChange={(e) =>
                          updateConditionValue(q.id, e.target.value)
                        }
                        className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
                      >
                        {(sourceQuestion.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={String(q.condition.value)}
                        onChange={(e) =>
                          updateConditionValue(q.id, e.target.value)
                        }
                        placeholder="Matching answer value"
                        className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={addQuestion}
          className="w-full rounded border border-dashed border-neutral-300 bg-white py-2.5 text-xs font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
        >
          + Add Question
        </button>
      </div>
    </form>
  );
}
