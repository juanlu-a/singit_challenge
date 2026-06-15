# Singit — Backend Challenge

This is my solution to the Singit backend challenge: the backend for an app that helps people learn
English through music. The challenge has two parts, and this repo contains both.

- **Part 1 — Architecture (writing only):** [`docs/Part1_Architecture.md`](docs/Part1_Architecture.md)
  (also as [PDF](docs/Part1_Architecture.pdf)).
  How I'd design the *full* system — songs with synced lyrics, splitting lyrics into searchable words,
  translations, building the word "insights", user vocabulary, and difficulty scoring — with diagrams
  and the trade-offs behind each choice.
- **Part 2 — The code (this repo):** the **practice layer** that sits on top of those word insights.
  It assumes the insights already exist (so there's no lyrics parsing here) and focuses on helping a
  user actually practice and learn words. The **API** is built with **NestJS, TypeScript, Mongoose and
  MongoDB**, and there's a small **Next.js web app** on top of it so you can click through the whole
  thing. It's a **pnpm workspace** with two packages: [`server/`](server) (the API) and
  [`web/`](web) (the UI).

### The idea in one paragraph

A *word insight* is just "a word worth learning" plus everything we know about it: its translations,
how hard it is, how often it shows up in songs, example sentences, maybe an image. The app keeps one
shared catalog of these insights. On top of that, each user has their own *vocabulary state* — which
words they already know, are still learning, or want to ignore. This backend takes those two things
and does the practice loop: it decides **which words a user should practice next**, **builds
exercises** from the insights (multiple choice, etc.), **records the answers**, and **updates what the
user knows** based on how they did.

---

## Running it

You need **Node 22**, **pnpm**, and **Docker** (just for MongoDB). Install once from the repo root:

```bash
pnpm install
```

### The quick way — start everything

```bash
pnpm dev        # starts MongoDB (Docker) + the API (:3000) + the web app (:3001)
pnpm seed       # in another terminal, load the example data (run once)
```

Then open:

- **Web app → <http://localhost:3001>** (the nice way to use it)
- **Swagger → <http://localhost:3000/docs>** (every endpoint, callable in the browser)

### Start just one side

`pnpm dev` runs both apps together; these run them on their own:

```bash
pnpm dev:db       # only MongoDB (Docker)
pnpm dev:server   # only the API   (:3000)  — needs MongoDB running
pnpm dev:web      # only the web app (:3001) — needs the API running
```

### Everything in Docker (optional)

The API also has a Dockerfile, so you can run the API + MongoDB fully containerised (the web app you'd
still run with `pnpm dev:web`):

```bash
docker compose up --build              # MongoDB + the API on :3000
docker compose exec app pnpm seed      # load the example data
```

There's also a Postman collection at
[`postman/Singit.postman_collection.json`](postman/Singit.postman_collection.json) (it auto-fills the
session and exercise ids for you after you create a session).

### Tests

```bash
pnpm test           # unit tests: prioritization, exercise generation, the attempt rule
pnpm test:e2e       # full flow over HTTP against a real (in-memory) MongoDB
```

The e2e suite spins up a real MongoDB in memory (via `mongodb-memory-server`), so it exercises the
actual database, not mocks.

---

## What the API does

Nine endpoints, grouped by what they're for. A good order to try them is the **demo flow** at the
bottom of this section.

| What you want to do | Endpoint |
|---|---|
| Load / update the word insights catalog | `POST /word-insights/import` |
| Browse the catalog (filter + paginate) | `GET /word-insights` |
| See a user's words *with* their state, stats and priority | `GET /users/:userId/word-insights` |
| Manually change a word's status for a user | `PUT /users/:userId/vocabulary/:wordInsightId` |
| Get a user's overall summary | `GET /users/:userId/insight-summary` |
| Start a practice session (generates exercises) | `POST /users/:userId/practice-sessions` |
| Look at a session (answers hidden) | `GET /practice-sessions/:sessionId` |
| Answer one exercise | `POST /practice-sessions/:sessionId/exercises/:exerciseId/attempts` |
| See how a session went | `GET /practice-sessions/:sessionId/results` |

**Demo flow:** `seed` → `GET /users/user_001/word-insights` (see the ranked words) →
`POST .../practice-sessions` (get exercises) → answer a few attempts → `GET .../results` and
`GET .../insight-summary` (watch the user's state update).

---

## How the code is organized

The repo is a pnpm workspace with two packages:

```
.
  server/            the NestJS API
  web/               the Next.js web app
  docs/              Part 1 architecture (markdown + PDF)
  postman/           Postman collection
  docker-compose.yml MongoDB (+ optional API) for local dev
```

### The API (`server/`)

Three feature modules, each owning its own collection. The split mirrors the three different kinds of
data: the **shared catalog**, the **per-user state**, and the **practice activity**.

```
server/src/
  common/            shared bits: enums, pagination, error handling, the normalize + seeded-random helpers
  config/            reads PORT and the Mongo URI from the environment
  database/          the Mongoose connection
  modules/
    word-insights/   the shared catalog — import (upsert) and browsing
    user-vocabulary/ per-user state, the prioritization logic, the user views and summary
    practice/        sessions, exercise generation, attempts, and results
  seed/              the example dataset + a script to load it
```

### The web app (`web/`)

A small **Next.js (App Router) + TypeScript** UI, deliberately minimalist with green/blue tones. It
talks to the API over REST (base URL in `NEXT_PUBLIC_API_URL`, default `http://localhost:3000`):

```
web/
  app/page.tsx          dashboard — pick a user, see the summary + words ranked by priority
  app/practice/page.tsx  practice flow — generate a session, answer exercises, see results
  lib/api.ts             typed client for the API
  components/, app/globals.css
```

Two screens: a **dashboard** (per-user summary cards + the word list ranked by priority, where you can
change a word's status), and a **practice flow** (configure a session, answer the generated exercises
one by one with instant feedback and the `learning → known` status change, then a results screen).

### The four collections

| Collection | What it holds | Important indexes |
|---|---|---|
| `word_insights` | the shared, global catalog of words | unique `(normalizedWord, language)`, unique `externalId`, `(language, source, difficulty)` |
| `user_vocabulary` | what each user knows, per word | unique `(userId, wordInsightId)`, `(userId, status)` |
| `practice_sessions` | a session with its exercises inside it | `(userId, createdAt)` |
| `exercise_attempts` | every answer a user submitted | `(sessionId)`, `(userId, wordInsightId, createdAt)` |

The link between a user's vocabulary and the catalog is `word_insights.externalId` — a stable,
readable id like `insight_002`. Using that everywhere means the dataset, a user's vocabulary, and
their attempts all line up on the same key.

---

## The rules, explained

The challenge asks for a few things to be **deterministic** — meaning the same input always gives the
same output, with no randomness leaking in. That makes them predictable and easy to test, which is
exactly why each one below lives in its own small, pure function.

### Which words to practice first (prioritization)

Lives in `server/src/modules/user-vocabulary/prioritization.service.ts`. Each word gets a score between 0
and 1 — higher means "practice this sooner":

```
priority = 0.5·status + 0.2·frequency + 0.2·difficulty + 0.1·recentlyWrong
```

In plain terms, a word gets pushed up if the user doesn't know it yet, if it shows up a lot in songs,
if it's a harder word, or if they just got it wrong. The details:

- **status** — `unknown` counts full (1.0), `learning` counts less (0.7), `known` counts 0. Words the
  user marked `ignored` are dropped from practice completely.
- **frequency** — `min(frequency, 50) / 50`, so very common words don't run away with the score.
- **difficulty** — `(difficulty − 1) / 4`, mapping the 1–5 scale onto 0–1.
- Ties are broken alphabetically by the word, so the order is always stable.
- Every word also comes back with a short, human `recommendationReason` ("New word you haven't
  learned yet", "Recently answered incorrectly", …) taken from whatever factor mattered most.

### Generating exercises

Lives in `server/src/modules/practice/exercise-generator.service.ts`. Exercises are built from the stored
insights — nothing is hardcoded. Three types:

- `word_meaning` — pick the correct translation of a word.
- `reverse_translation` — given a translation, pick the original word.
- `word_to_image` — pick the image that matches a word.

To keep it deterministic, the "random" choices (which wrong answers to show, what order to put them
in) come from a tiny seeded random generator (`common/util/seeded-random.ts`) seeded from a fixed
string. Same word, same options, every time — which is what the tests rely on.

It also refuses to make a bad question. Translation exercises are only created when the word actually
has a translation in the language you asked for, and image exercises only when there are enough images
to build real choices. If a word doesn't have enough data, it's listed in the session's `skipped[]`
instead of being faked. A session also rotates through the exercise types so you get a mix.

> One important detail: the correct answer (`correctOptionId`) is **never** sent back while an exercise
> is still unanswered. It's kept on the server and only revealed in the results after you've answered.

### What happens when you answer (the attempt rule)

Lives in `UserVocabularyService.computeNextStatus`, kept as a pure function so it's trivial to test:

- **Right answer** → the correct count goes up; the word becomes `known` after **two** correct
  answers, otherwise it's `learning`.
- **Wrong answer** → the incorrect count goes up and the word goes (back) to `learning`.
- A word the user marked `ignored` stays `ignored`. We always update `lastPracticedAt` and remember
  whether the last answer was right — that last bit feeds the "recently got it wrong" part of the
  priority score.

### Importing insights

`POST /word-insights/import` upserts on the natural key `(normalizedWord, language)` and returns a
summary: `{ created, updated, skipped, rejected[] }`. A bad record doesn't blow up the whole import —
it's rejected on its own with the reason and its position, and the rest still go through. Duplicates
inside the same request are skipped, and `externalId` stays the same across re-imports so importing
the same file twice is safe.

---

## Where I tweaked the example models

The brief explicitly invites challenging the example DTOs, so here's what I changed and why:

- Added a stable **`externalId`** separate from Mongo's `_id`, so re-imports are idempotent and the
  ids you see in one collection are readable references in another.
- Constrained **`difficulty` to 1–5** (and validated it), since the priority score assumes that range.
- Added **`correctCount`, `incorrectCount`, `lastPracticedAt` and `lastAttemptCorrect`** to a user's
  vocabulary — these are what drive the attempt rule and the prioritization.
- **Embedded the exercises inside the session** (a session is always read and written as one thing),
  while keeping **attempts in their own collection** as an append-only log of what happened.
- Gave a session a **`skipped[]`** list, so it's transparent when a word couldn't produce an exercise.

---

## Stack & assumptions

- **API:** Node.js 22, NestJS 10, Mongoose 8, MongoDB 7. **Web:** Next.js 14 (App Router) + React 18.
  Managed as a **pnpm workspace**.
- No auth — it's out of scope, so the `userId` just comes from the route (and is a plain field in the
  web app).
- No real translation or NLP here — the insights arrive already built. That whole pipeline is what
  Part 1 describes.
- The seed images use placeholder URLs; the web app falls back to a real placeholder image when one
  doesn't load, so the image exercises still work in the demo.
