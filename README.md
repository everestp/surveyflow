# SurveyFlow

SurveyFlow is a small full-stack survey application. Its backend is a versioned Express REST API backed by PostgreSQL; its frontend is a React single-page application that uses that API to create surveys, collect answers, and review basic analytics.

This documentation describes the current code, not a target design. In particular, the API's current authorization and submission behavior differs in a few places from what the browser UI implies; those differences and other known limitations are called out below.

## Contents

- [Features and current scope](#features-and-current-scope)
- [Architecture](#architecture)
- [Architecture Decisions](#architecture-decisions)
- [Database](#database)
- [Local setup](#local-setup)
- [API reference](#api-reference)
- [Security](#security)
- [Implementation caveats](#implementation-caveats)

## Features and current scope

- Email/password registration and login, with bearer JWT authentication.
- First-account administrator bootstrap, followed by ordinary user accounts.
- Survey drafts with typed questions, options, required flags, and conditional visibility rules.
- Survey publishing and public listing/detail access for published surveys.
- Response persistence in JSONB and owner-only response retrieval.
- Owner-scoped overview counts, response trends, and question answer distributions.
- Browser views for a public survey feed, survey creation, taking surveys, a dashboard, and results.

Question types accepted by the API are `text`, `textarea`, `number`, `email`, `single_choice`, `multiple_choice`, `rating`, `date`, and `yes_no`. The current builder UI exposes only `text`, `email`, `rating`, `single_choice`, `multiple_choice`, and `yes_no`.

The API supports draft update and deletion, but the browser currently has no edit-survey screen. `archived` is a database-supported status and can be filtered on the owner survey list; there is no route to archive a survey or to update its status directly.

## Architecture

SurveyFlow is a modular monolith. The backend groups code by auth, survey, response, and analytics domains and keeps HTTP handling, business rules, and SQL access in distinct layers. A small composition module constructs shared infrastructure and module dependencies at startup; there is no external dependency-injection container.

```mermaid
flowchart TD
    Browser[React SPA] -->|fetch JSON and optional bearer token| API[Express 5 API]
    API --> Global[Correlation, Helmet, CORS, compression, body parsing, rate limit]
    Global --> Routes[Versioned module routes]
    Routes --> Validation[Zod request validation]
    Validation --> Controller[Controllers]
    Controller --> Service[Domain services]
    Service --> Repository[Repository implementations]
    Repository --> Pool[pg connection pool]
    Pool --> DB[(PostgreSQL)]
    Service --> Shared[JWT and password services]
    API --> Errors[Not-found and centralized error middleware]
    Global --> Logs[Winston JSON logs and correlation context]
```

### Backend request flow

`src/app.ts` installs correlation, security, compression, and JSON/urlencoded parsing middleware, then exposes `/health` and mounts `/api/v1` behind a 100-request-per-15-minute IP rate limit. The v1 router forwards requests to auth, survey, response, or analytics routers. Module routers apply route-specific authentication and Zod validation; controllers translate HTTP input/output; services enforce business rules; repositories use `pg` and parameterized SQL.

`src/container.ts` constructs repositories with the shared PostgreSQL pool, injects them into services, injects services into controllers, and exports configured routers. Interfaces exist around repositories and auth services, while several controllers and services receive concrete class types. The composition is constructor-based and manual.

Express 5 forwards rejected async route handlers to the centralized error middleware. Known application errors and validation failures become JSON responses; unexpected exceptions are logged and returned as generic 500 responses. A correlation ID is generated for each request and returned in `X-Correlation-ID`; `AsyncLocalStorage` makes it available to log formatting.

The active pool is `src/database/pool.ts` (maximum 20 clients, 30-second idle timeout, 5-second connection timeout). The server checks the database before listening and closes the HTTP server and pool on shutdown signals. Migrations are ordered SQL files recorded in `schema_migrations` and run transactionally one file at a time.

### Frontend structure

The frontend is a React 19 SPA built with Vite and Tailwind CSS. `App.tsx` provides lightweight pathname routing using the browser History API and `popstate`; it does not use a routing library. Page components live under `src/pages`, with navigation in `src/components` and HTTP/auth helpers in `src/lib`.

`AuthProvider` keeps the current user and token in React context. The token is stored in `localStorage`; on startup the provider requests `/auth/me`. The shared `apiRequest` helper serializes JSON, attaches the bearer token by default, unwraps the API's `data` property, and clears the token when an authenticated request returns 401.

The builder creates a new survey in local component state and submits it through `POST /surveys`. It can add, remove, reorder, and configure questions and conditionally show later questions based on earlier answers. The taking page renders the supported question controls, evaluates visibility in the browser, and submits answers. The backend repeats important answer checks independently; browser-side validation is not trusted. The results page loads question analytics and a paginated response list. There is no global state library or form library in the package dependencies.

## Architecture Decisions

| Decision                                        | Why it is used here                                                                                                                                   | Problem addressed                                                                                  | Alternatives and trade-offs                                                                                                                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js                                         | The API and frontend tooling share the JavaScript/TypeScript ecosystem, and database/HTTP work is largely asynchronous I/O.                           | Supports concurrent request handling without a thread-per-request model.                           | A threaded runtime such as .NET or Java is viable; Node's event loop makes CPU-heavy work a poor fit without workers.                                                                                                          |
| Express 5                                       | A small routing and middleware framework matching the modular route layout. Async handler rejections flow into Express error handling.                | Provides HTTP composition without imposing a larger application framework.                         | Fastify or NestJS could add stronger conventions or performance features, but would introduce a different plugin/decorator model and more framework structure.                                                                 |
| TypeScript                                      | Both applications are written in TypeScript, with strict backend compiler settings and typed frontend components.                                     | Catches many interface and refactoring errors before runtime.                                      | Plain JavaScript is simpler initially; static types still require runtime validation at HTTP boundaries.                                                                                                                       |
| PostgreSQL with `pg`                            | Relational tables model users, surveys, and responses; foreign keys and transactions protect important relationships and signup/migration operations. | Provides durable relational integrity while supporting flexible JSONB payloads.                    | A document database could store survey documents directly, but would shift ownership and relationship constraints into application code.                                                                                       |
| Raw SQL with `pg`                               | Repositories issue explicit, parameterized SQL and map database rows to TypeScript domain objects.                                                    | Gives direct control over joins, aggregates, filters, and JSONB operations without an ORM runtime. | Prisma, Drizzle, or another ORM could reduce manual mapping and improve migration/type workflows; raw SQL means query maintenance, row mapping, and schema/type synchronization are manual.                                    |
| JSONB questions and answers                     | Survey question definitions and submitted answer collections vary by survey and are stored as JSONB.                                                  | Avoids requiring a schema migration for each new question or answer shape.                         | Normalized question/answer tables improve per-answer constraints, indexing, and querying, but add joins and more schema/application complexity. JSONB trades some relational enforcement and query ergonomics for flexibility. |
| Modular monolith                                | Auth, surveys, responses, and analytics are separate modules within one deployable backend.                                                           | Keeps domain ownership understandable without distributed-service operations.                      | Microservices allow independent deployments/scaling but add network, deployment, and consistency costs that this application's size does not justify.                                                                          |
| Repository interfaces and constructor injection | Services depend on repository contracts in key module boundaries; `container.ts` assembles concrete implementations.                                  | Makes service logic less coupled to SQL implementation and centralizes composition.                | Direct database calls simplify tiny applications; a DI framework can automate larger graphs but adds configuration and runtime machinery. Current DI is manual and not uniformly interface-typed.                              |
| Zod runtime validation                          | Route middleware validates auth, survey, response, and analytics inputs.                                                                              | TypeScript types disappear at runtime and cannot validate untrusted HTTP payloads.                 | JSON Schema/Ajv or class-validator are alternatives; validation currently lives in per-module Zod schemas.                                                                                                                     |
| JWT bearer authentication                       | Signed tokens carry subject, email, and role claims and are verified by protected routes.                                                             | Allows API requests to authenticate without server-side session storage.                           | Server sessions simplify revocation and cookie-based browser flows; stateless JWTs require explicit expiry/revocation strategy. Current token expiry is fixed at one hour.                                                     |
| bcrypt password hashing                         | Passwords are stored as bcrypt hashes and checked with bcrypt comparison.                                                                             | Prevents storing recoverable plaintext passwords.                                                  | Argon2id is a modern alternative; bcrypt has a 72-byte input limit and the current cost is hard-coded.                                                                                                                         |
| Winston and request context                     | Winston writes JSON-formatted logs to console and rotating files; AsyncLocalStorage supplies a request correlation ID.                                | Makes request completion and application events easier to trace.                                   | A hosted logging/observability stack could centralize retention and search; this repository does not configure one. Correlation context is not a full tracing system.                                                          |

## Database

The checked-in migrations create three application tables. The migration runner also creates `schema_migrations` to track executed files; it is infrastructure metadata rather than a domain table.

```mermaid
erDiagram
    USERS ||--o{ SURVEYS : creates
    SURVEYS ||--o{ RESPONSES : receives

    USERS {
        uuid id PK
        varchar email UK
        text password_hash
        varchar role
        timestamptz created_at
        timestamptz updated_at
    }
    SURVEYS {
        uuid id PK
        varchar title
        text description
        varchar status
        jsonb questions
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
        timestamptz published_at
    }
    RESPONSES {
        uuid id PK
        uuid survey_id FK
        jsonb answers
        varchar respondent_email
        timestamptz submitted_at
    }
```

### Tables and constraints

| Table       | Columns and constraints                                                                                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`     | `id` UUID primary key, generated with `gen_random_uuid()`; unique, required `email`; required `password_hash`; `role` defaults to `user` and is limited to `admin` or `user`; `created_at` and `updated_at` default to `NOW()`.                                                                                                             |
| `surveys`   | UUID primary key; required `title`; nullable `description`; `status` defaults to `draft` and is limited to `draft`, `published`, or `archived`; required `questions JSONB` defaults to `[]`; required `created_by` references `users(id)` with `ON DELETE CASCADE`; `created_at`, `updated_at` default to `NOW()`; nullable `published_at`. |
| `responses` | UUID primary key; required `survey_id` references `surveys(id)` with `ON DELETE CASCADE`; required `answers JSONB`; nullable `respondent_email`; `submitted_at` defaults to `NOW()`.                                                                                                                                                        |

Indexes are created for user email (in addition to the unique constraint), survey owner, survey status, descending survey creation time, response survey ID, descending response submission time, and `(survey_id, submitted_at DESC)`. No GIN indexes are defined for JSONB. Deleting a user cascades to their surveys, and deleting a survey cascades to its responses.

Survey questions are JSON arrays with fields such as `id`, `title`, `type`, `required`, `order`, optional `description`/`options`, and optional `condition`. Responses store arrays of `{ questionId, value }`. JSONB accommodates heterogeneous survey-specific shapes, but does not provide foreign keys or relational constraints for individual question/answer entries; the service layer performs those checks.

## Local setup

### Prerequisites

- Git.
- Node.js `20.19+` or `22.12+` and npm `10+`. The frontend's Vite 8 package requires Node `^20.19.0 || >=22.12.0`; Express 5 itself requires Node 18 or newer.
- PostgreSQL 13 or newer, with permission to create a database. The migrations use PostgreSQL's `gen_random_uuid()`.

There is no root package manifest; install each app independently. The repository URL is present in `backend/package.json`:

```sh
git clone https://github.com/everestp/surveyflow.git
cd surveyflow
npm ci --prefix backend
npm ci --prefix frotend
```

The directory is named `frotend` in the repository.

### Environment configuration

Copy the backend example and edit it locally:

```sh
cp backend/.env.example backend/.env
```

| Variable         | Required?        | Default / example                                                   | Purpose and implementation note                                                                                          |
| ---------------- | ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`       | No               | `development`                                                       | Must be `development`, `production`, or `test`; production enables TLS verification in the active PostgreSQL pool.       |
| `PORT`           | No               | `5000`                                                              | Positive integer port for the API.                                                                                       |
| `DATABASE_URL`   | Yes              | `postgresql://postgres:dev-only-password@localhost:5432/surveyflow` | PostgreSQL connection string. Replace the example credential with a local development credential.                        |
| `JWT_SECRET`     | Yes              | `replace-with-a-random-secret-at-least-32-characters`               | Must be at least 32 characters. Use a unique random secret outside local development.                                    |
| `JWT_EXPIRES_IN` | No               | `1d`                                                                | Validated and documented by the environment schema, but the current token service ignores it and issues one-hour tokens. |
| `BCRYPT_ROUNDS`  | No               | `12`                                                                | Validated with an allowed range of 10-15, but the password service currently hard-codes 12 rounds.                       |
| `FRONTEND_URL`   | No               | `http://localhost:5173`                                             | Validated URL; currently not referenced by the application after validation. CORS uses `CORS_ORIGIN` instead.            |
| `CORS_ORIGIN`    | No               | `http://localhost:5173`                                             | Comma-separated allowed origins for CORS.                                                                                |
| `LOG_LEVEL`      | No               | `info`                                                              | Winston threshold; allowed values are `error`, `warn`, `info`, `http`, `verbose`, `debug`, and `silly`.                  |
| `ADMIN_EMAIL`    | Only for seeding | `admin@example.test`                                                | Read by the seed script; normalized to lowercase. Not part of the general environment validation schema.                 |
| `ADMIN_PASSWORD` | Only for seeding | Use a fake local value of at least 12 characters                    | Seed-script password; maximum 72 UTF-8 bytes. Not part of the general environment validation schema.                     |

The backend `.env.example` currently contains the first seven values; `CORS_ORIGIN` and `LOG_LEVEL` have defaults, and the two `ADMIN_*` values are optional seed-only settings. Keep actual credentials out of source control.

The frontend has no checked-in `.env.example`. `VITE_API_URL` is optional and defaults to `http://localhost:5000/api/v1`. To override it, create `frotend/.env.local`, for example:

```dotenv
VITE_API_URL=http://localhost:5000/api/v1
```

### Database and bootstrap account

Create an empty database using a local PostgreSQL role with appropriate permissions:

```sh
createdb surveyflow
```

Set `DATABASE_URL` in `backend/.env`, then run migrations:

```sh
npm run migrate --prefix backend
```

To seed an administrator, add `ADMIN_EMAIL` and `ADMIN_PASSWORD` to `backend/.env`, then run:

```sh
npm run seed --prefix backend
```

The seed command creates the supplied admin account only if that email does not already exist. Alternatively, the first account registered through `POST /api/v1/auth/register` is assigned the `admin` role. Registration remains public, so do not expose an empty deployment before establishing a trusted first account.

### Run the applications

Run the backend and frontend in separate terminals from the repository root:

```sh
npm run dev --prefix backend
```

```sh
npm run dev --prefix frotend
```

The API defaults to `http://localhost:5000`; Vite prints its frontend URL (normally `http://localhost:5173`). The API health check is `GET http://localhost:5000/health`.

### Type checking and builds

```sh
npm run typecheck --prefix backend
npm run build --prefix backend
npm start --prefix backend
```

The backend build compiles `backend/src` into `backend/build`; the production start script runs `build/server.js`. Run it only after setting production environment variables and applying migrations.

The frontend has no standalone typecheck script. Its build runs TypeScript project checks followed by Vite:

```sh
npm run build --prefix frotend
npm run lint --prefix frotend
```

The frontend build output is `frotend/dist`. The backend does not serve this directory; deploy/serve the SPA separately and configure its API URL and the backend's CORS allowlist accordingly.

## API reference

Base URL: `http://localhost:5000/api/v1`. Except for `/health`, all API routes are subject to the global 100-requests-per-IP-per-15-minute limiter. Authenticated requests use:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Most successful responses use `{ "success": true, "data": ... }`, optionally with a `message`. The frontend helper unwraps `data`; examples below show the raw HTTP JSON. Dates serialize as ISO strings.

### Authentication

| Method | Endpoint         | Authentication | Description                                                                   |
| ------ | ---------------- | -------------- | ----------------------------------------------------------------------------- |
| `POST` | `/auth/register` | No             | Registers an account; the first user is assigned `admin`, later users `user`. |
| `POST` | `/auth/login`    | No             | Verifies credentials and issues a bearer token.                               |
| `GET`  | `/auth/me`       | Bearer token   | Returns the current account from the database.                                |

`POST /auth/register` and `POST /auth/login` accept `{ "email": "person@example.com", "password": "at-least-12-characters" }`. Registration requires a valid email up to 255 characters and a password of at least 12 characters and at most 72 UTF-8 bytes. Login accepts any non-empty password string. Successful registration returns 201 and login returns 200:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "5e889f8c-585b-4c12-941a-385d0989363f",
      "email": "admin@example.com",
      "role": "admin",
      "createdAt": "2026-11-19T12:00:00.000Z"
    },
    "accessToken": "<signed-jwt>",
    "tokenType": "Bearer",
    "expiresIn": 3600
  }
}
```

`GET /auth/me` returns `200 { "success": true, "data": { "user": { ... } } }`. Common errors: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS` or `UNAUTHORIZED`, and `409 EMAIL_ALREADY_EXISTS`.

### Surveys

| Method   | Endpoint               | Authentication                           | Description                                                 |
| -------- | ---------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/surveys`             | No; optional valid bearer token          | Lists published surveys with pagination.                    |
| `GET`    | `/surveys/mine`        | Bearer token                             | Lists the caller's surveys; supports status filtering.      |
| `GET`    | `/surveys/:id`         | No for published; owner token for drafts | Gets a published survey or the authenticated owner's draft. |
| `POST`   | `/surveys`             | Bearer token                             | Creates a draft owned by the caller.                        |
| `PATCH`  | `/surveys/:id`         | Bearer token, owner, draft only          | Updates draft title, description, or questions.             |
| `DELETE` | `/surveys/:id`         | Bearer token, owner, draft only          | Deletes a draft (responses cascade with survey deletion).   |
| `PATCH`  | `/surveys/:id/publish` | Bearer token, owner, draft only          | Publishes a non-empty draft.                                |

List query parameters are `page` (default 1), `limit` (default 10, maximum 100), and optional `status` (`draft`, `published`, or `archived`). The public `GET /surveys` implementation always forces status to `published`; a supplied status does not expose drafts. `/surveys/mine` honors the status filter.

Create body:

```json
{
  "title": "Developer experience",
  "description": "A short optional introduction",
  "questions": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "title": "Which language do you use most?",
      "type": "single_choice",
      "required": true,
      "options": ["TypeScript", "Python"],
      "order": 0
    },
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "title": "What would you improve?",
      "type": "textarea",
      "required": false,
      "order": 1,
      "condition": {
        "questionId": "11111111-1111-4111-8111-111111111111",
        "operator": "equals",
        "value": "TypeScript"
      }
    }
  ]
}
```

Question `title` is required (1-500 characters), `type` must be one of the nine supported types, `order` is a non-negative integer, and `required` defaults to false. Questions are limited to 100. Options, when provided, must be non-empty strings up to 200 characters; choice questions must have options. Conditions use an existing question UUID and `equals`, `not_equals`, or `contains`; the service rejects unknown references and self-reference. It does not validate dependency cycles or require dependencies to appear earlier in the question list.

Update accepts any subset of `title`, `description` (string or null), and `questions`. Status is not accepted. Create returns 201; reads and update/publish return 200; delete returns 200 with a message. Create/update/get return the survey as `data.survey`. List returns:

```json
{
  "success": true,
  "data": {
    "surveys": [],
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

Common errors: `400 VALIDATION_ERROR`, `400 EMPTY_SURVEY` or `SURVEY_CANNOT_BE_PUBLISHED`, `401 UNAUTHORIZED`/`INVALID_TOKEN`, and `404 SURVEY_NOT_FOUND`. Non-owners and unavailable drafts are reported as 404. Any authenticated role can create a survey; ownership, not role, controls survey mutation.

### Responses

| Method | Endpoint               | Authentication             | Description                            |
| ------ | ---------------------- | -------------------------- | -------------------------------------- |
| `POST` | `/responses/:surveyId` | No at the API route        | Submits answers to a published survey. |
| `GET`  | `/responses/:surveyId` | Bearer token, survey owner | Lists responses, newest first.         |

Submission body has 1-100 answers and an optional respondent email:

```json
{
  "respondentEmail": "respondent@example.com",
  "answers": [
    {
      "questionId": "11111111-1111-4111-8111-111111111111",
      "value": "TypeScript"
    }
  ]
}
```

Each answer value must be a string, number, boolean, or array of strings. The server verifies that the survey exists and is published; rejects unknown question IDs and duplicate answer IDs; checks values against the question type and choice options; and checks required answers for questions it considers visible. Rating values must be 1-5, email answers must match a basic email pattern, and date answers must parse as dates. Hidden-question answers are not required, though any submitted answer is still checked for a known question and compatible value type.

The API route does not require authentication to submit. The current browser page does require a signed-in user and includes their email automatically; this is a frontend-only gate and should not be treated as an API security guarantee.

`GET` accepts `page` (default 1) and `limit` (default 20, maximum 100). It returns 200 with `{ "success": true, "data": { "responses": [...], "total": 0 } }`; the response list does not include page metadata. Submission returns 201 with `data.response`. Common errors: `400 VALIDATION_ERROR`, `400 DUPLICATE_ANSWERS`, `INVALID_QUESTION`, `INVALID_ANSWER_TYPE`, or `REQUIRED_ANSWER_MISSING`; `404 SURVEY_NOT_FOUND`; `401 UNAUTHORIZED`; and `404` for non-owner response retrieval.

### Analytics

| Method | Endpoint                       | Authentication             | Description                                                     |
| ------ | ------------------------------ | -------------------------- | --------------------------------------------------------------- |
| `GET`  | `/analytics/overview`          | Bearer token               | Counts the caller's surveys by status and their responses.      |
| `GET`  | `/analytics/responses/trend`   | Bearer token               | Counts the caller's responses by day for a date window.         |
| `GET`  | `/analytics/surveys/:surveyId` | Bearer token, survey owner | Returns per-question answer distributions for one owned survey. |

`GET /analytics/responses/trend` accepts `days` (default 30, integer 1-365). Overview returns `data.overview` with `totalSurveys`, `publishedSurveys`, `draftSurveys`, `archivedSurveys`, `totalResponses`, and `averageResponsesPerSurvey`. Trend returns `data.trend`, an array of `{ "date": "YYYY-MM-DD", "count": 0 }`; dates with no responses are omitted. Survey analytics returns `data.analytics` with survey ID/title, total response count, a currently empty `responseTrend`, and `questions`. Each question has `questionId`, `questionTitle`, `questionType`, `totalAnswers`, and a `distribution` array of `{ "value", "count", "percentage" }`.

Common errors: `400 VALIDATION_ERROR`/`INVALID_DATE_RANGE`, `401 UNAUTHORIZED` or `INVALID_TOKEN`, and `404 SURVEY_NOT_FOUND` for unknown or non-owned surveys.

### Common error format

Application errors generally use this shape and include the request correlation ID:

```json
{
  "success": false,
  "message": "Authentication required",
  "code": "UNAUTHORIZED",
  "correlationId": "b41691db-7bcc-47e7-9c60-34de377d6238"
}
```

Unexpected errors return a generic `500 INTERNAL_SERVER_ERROR`; details are logged, not returned. Direct Zod errors that reach the error middleware include an `errors` array, while the module validation middleware currently converts most failures to `VALIDATION_ERROR` without field details. Rate-limit responses are `429` with `success: false` and a message; they do not use the normal error envelope.

`GET /health` is outside `/api/v1` and returns `200 { "success": true, "message": "SurveyFlow API is healthy" }`.

## Security

### Implemented controls

- Passwords are hashed with bcrypt before storage; the API does not return password hashes.
- JWT verification checks the signature, expiration, issuer (`surveyflow-api`), audience (`surveyflow-client`), subject, email, and allowed role value.
- Protected routes require a `Bearer` token. Survey updates/deletes/publishing, response reads, and analytics lookups check the authenticated user's ownership in service or SQL queries.
- SQL values are passed through `pg` parameters rather than interpolated from request values.
- Zod validates request bodies and query parameters, and the response service validates answers against the stored published survey rather than relying on frontend checks.
- Helmet sets standard security headers; CORS origins come from `CORS_ORIGIN`; request body parsing is capped at 1 MB.
- The API applies a global IP-based limit of 100 requests per 15 minutes under `/api/v1`; `/health` is excluded. It trusts one proxy hop (`trust proxy = 1`), which must match the deployment topology.
- Secrets and database credentials are supplied through environment variables. Production PostgreSQL connections request TLS with certificate verification in the active pool.
- Centralized errors avoid returning unexpected exception details; request completion and errors are logged with correlation context.

### Important limitations and hardening work

- Registration is public. The first registered account is made `admin`; on a fresh exposed deployment, an untrusted visitor can claim that role. Bootstrap through a controlled process and disable or restrict public registration before production use.
- The `authorize` role middleware exists but is not mounted on module routes. Survey operations are owner-scoped but are not admin-only; authenticated users can create and manage their own surveys. The frontend's admin checks do not provide backend authorization.
- Response submission is unauthenticated at the API even though the UI requests login. Public submissions have only the global rate limit, with no duplicate-submission, bot, or survey-specific abuse controls.
- The browser stores bearer tokens in `localStorage`, making token theft through an XSS vulnerability a concern. There is no refresh, revocation, or server-side session mechanism.
- `JWT_EXPIRES_IN` and `BCRYPT_ROUNDS` are validated but ignored by their service implementations; JWT lifetime is one hour and bcrypt cost is 12. Configuration should not be assumed to override those values.
- No automated tests, security scanning, CI workflow, or production observability integration are defined in the repository. Validate and add these before relying on the service in production.

## Implementation caveats

- There is no test script in either package manifest and no checked-in test suite was found during this audit. `npm run typecheck --prefix backend`, the frontend build, and frontend lint are available checks, not behavioral tests.
- `backend/Dockerfile` and `backend/docker-compose.yml` are empty; Docker-based setup is not currently implemented. `frotend/vercel.json` contains an SPA rewrite, but no deployment workflow or hosting configuration is defined here.
- `backend/src/config/database.ts` defines a second pool configuration with a maximum of 10 connections but is not imported by the application. Runtime uses `backend/src/database/pool.ts`, whose maximum is 20.
- Public `GET /surveys` always lists published surveys, including for a valid admin token. The frontend dashboard treats admins as if that endpoint returns all surveys, but the server does not expose all users' drafts there.
- The UI displays conditional rules for prior questions and offers equals/not-equals. The API also supports `contains`, but does not reject cycles or forward references. Its answer-visibility evaluation is server-side; clients should not infer stronger rule validation than is implemented.
- Analytics exposes counts and distributions only. The survey-level `responseTrend` field is currently always empty; there are no averages for rating questions or chart-specific aggregations in the backend.
