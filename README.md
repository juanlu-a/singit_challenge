# Singit — Backend Challenge

English-learning-through-music backend challenge. Two parts:

- **Part 1 — Architecture Principles** (written): [`docs/PART1-ARCHITECTURE.md`](docs/PART1-ARCHITECTURE.md).
  Designs the full system (songs, synchronized lyrics, word indexing, translations, insight
  generation, user vocabulary, difficulty scoring) with diagrams, DTOs and trade-offs.
- **Part 2 — Backend Development** (this repo): a **practice layer** built on top of word insights.
  Insights are assumed to already exist (no lyrics parsing). Implemented with **NestJS + TypeScript +
  Mongoose + MongoDB**.

---

## Quick start

### Option A — Docker Compose (app + MongoDB)

```bash
docker compose up --build        # starts MongoDB + the API on :3000
# in another terminal, load the example dataset:
docker compose exec app npm run seed
```

### Option B — Local Node, Docker only for MongoDB

```bash
cp .env.example .env
docker compose up -d mongo       # just MongoDB on :27017
npm install
npm run seed                     # load the example dataset
npm run start:dev                # API on :3000 (watch mode)
```

Then open **Swagger UI at <http://localhost:3000/docs>** to explore and exercise every endpoint, or
import [`postman/Singit.postman_collection.json`](postman/Singit.postman_collection.json) into Postman.

### Tests

```bash
npm test            # unit tests (prioritization, exercise generation, attempt rule)
npm run test:e2e    # full HTTP flow against an in-memory MongoDB (mongodb-memory-server)
```

---

## What it does (operations)

| Operation | Endpoint |
|---|---|
| Import / upsert word insights | `POST /word-insights/import` |
| List global insights (filters + pagination) | `GET /word-insights` |
| Get user word insights (state + stats + priority) | `GET /users/:userId/word-insights` |
| Update user vocabulary status | `PUT /users/:userId/vocabulary/:wordInsightId` |
| Get user insight summary | `GET /users/:userId/insight-summary` |
| Create practice session (generated exercises) | `POST /users/:userId/practice-sessions` |
| Get practice session (answers hidden) | `GET /practice-sessions/:sessionId` |
| Submit exercise attempt | `POST /practice-sessions/:sessionId/exercises/:exerciseId/attempts` |
| Get practice session results | `GET /practice-sessions/:sessionId/results` |

A typical demo flow: **seed → `GET /users/user_001/word-insights` → `POST .../practice-sessions` →
submit attempts → `GET .../results` → `GET .../insight-summary`.**

---

## Architecture

Three modules with clear collection boundaries (global catalog vs. per-user state vs. practice
activity):

```
src/
  common/            enums, pagination DTO, exception filter, normalize + seeded-random utils
  config/            env configuration
  database/          Mongoose connection
  modules/
    word-insights/   global insight catalog: import (upsert) + filtered listing
    user-vocabulary/ per-user state, prioritization, get-user-word-insights, summary
    practice/        sessions, deterministic exercise generation, attempts, results
  seed/              example dataset + idempotent seed script
```

### Collections & key indexes

| Collection | Purpose | Key indexes |
|---|---|---|
| `word_insights` | global, shared catalog | unique `(normalizedWord, language)`, unique `externalId`, `(language, source, difficulty)` |
| `user_vocabulary` | per-user knowledge state | unique `(userId, wordInsightId)`, `(userId, status)` |
| `practice_sessions` | sessions with embedded exercises | `(userId, createdAt)` |
| `exercise_attempts` | recorded answers | `(sessionId)`, `(userId, wordInsightId, createdAt)` |

`user_vocabulary.wordInsightId` references `word_insights.externalId` (the stable, human-readable id
such as `insight_002`) so the dataset, vocabulary and attempts all line up on one key.

---

## Documented design decisions

These are the rules the challenge asks to be explicit and deterministic.

### Prioritization (which words to practice first)

`src/modules/user-vocabulary/prioritization.service.ts` — a pure, weighted score in `[0, 1]`:

```
priority = 0.5·statusWeight + 0.2·normFrequency + 0.2·normDifficulty + 0.1·recentIncorrectFlag
```

- `statusWeight`: `unknown = 1.0`, `learning = 0.7`, `known = 0.0`; `ignored` words are **excluded**
  from practice entirely.
- `normFrequency = min(frequency, 50) / 50`; `normDifficulty = (difficulty − 1) / 4` (difficulty 1–5).
- Deterministic tie-break by `normalizedWord`.
- A human `recommendationReason` is derived from the dominant factor (a recent mistake takes
  precedence as the most actionable reason).

### Exercise generation (deterministic)

`src/modules/practice/exercise-generator.service.ts` — three types, generated from stored insights:

- `word_meaning` — choose the correct translation of a word.
- `reverse_translation` — choose the source-language word for a translated meaning.
- `word_to_image` — choose the image that represents a word.

Determinism comes from a small seeded PRNG (`common/util/seeded-random.ts`) seeded from a stable
string, so option order and distractor selection are fully reproducible (covered by tests). **Guards:**
translation exercises are only generated when the requested `translationLanguage` exists on the
insight; image exercises only when there are enough images to build valid options. Words without
enough data are reported in the session's `skipped[]` array — never answered with fabricated options.
Each session rotates exercise types across words so a session mixes types.

> Correct answers (`correctOptionId`) are **never** returned by the API for unanswered exercises —
> they are stored server-side and revealed only in results after an attempt.

### Attempt → vocabulary update rule

`UserVocabularyService.computeNextStatus` (pure, unit-tested):

- **Correct** → `correctCount++`; the word becomes `known` once `correctCount >= 2`, otherwise
  `learning`.
- **Incorrect** → `incorrectCount++`; the word moves to `learning`.
- `ignored` is preserved (the user opted out). `lastPracticedAt` and `lastAttemptCorrect` are always
  updated; the latter feeds the "answered incorrectly recently" priority term.

### Import semantics

`POST /word-insights/import` upserts by the natural key `(normalizedWord, language)` and returns a
per-batch summary `{ created, updated, skipped, rejected[] }`. Invalid records are rejected
individually (with index + reason) and never fail the whole batch; duplicates within one batch are
skipped. `externalId` is stable across re-imports.

---

## Model enrichments (vs. the example DTOs)

The brief invites challenging the example models; deviations:

- Added a stable **`externalId`** distinct from Mongo's `_id` so dataset imports are idempotent and
  cross-collection references stay readable.
- **Difficulty** is constrained to `1..5` (validated); the priority score normalizes it.
- Added **`correctCount` / `incorrectCount` / `lastPracticedAt` / `lastAttemptCorrect`** on user
  vocabulary to drive the attempt rule and prioritization.
- Practice sessions **embed** their exercises (a session is read/written as a unit); attempts are a
  separate collection (append-only activity log).
- Sessions record a **`skipped[]`** list for transparency when a word lacked data for an exercise.

---

## Tech & assumptions

- Node.js 22, NestJS 10, Mongoose 8, MongoDB 7.
- No authentication/authorization (out of scope) — `userId` is taken from the route.
- No real translation/NLP generation — insights arrive pre-computed (that pipeline is Part 1).
