CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    respondent_email VARCHAR(255),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_responses_survey_id
    ON responses(survey_id);

CREATE INDEX IF NOT EXISTS idx_responses_submitted_at
    ON responses(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_responses_survey_submitted
    ON responses(survey_id, submitted_at DESC);
