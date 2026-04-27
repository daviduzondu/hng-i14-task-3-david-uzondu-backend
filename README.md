# HNG i14 Stage 2 Backend Task — Intelligence Query Engine

A production-grade Express API that enriches names using external prediction services (Genderize, Agify, Nationalize), stores structured demographic profile data in a database, and exposes a **queryable intelligence engine** for filtering, sorting, paginating, and searching profiles using both structured parameters and natural language.

Built for Insighta Labs — a demographic intelligence company whose clients (marketing teams, product teams, growth analysts) rely on this API to segment users, identify patterns, and query large datasets efficiently.

---

## What's new in Stage 2

Stage 1 covered basic profile creation and deduplication. Stage 2 upgrades the system into a **Queryable Intelligence Engine**:

- Advanced multi-condition filtering on all profile fields
- Sorting by age, creation date, or gender probability
- Cursor-based pagination with configurable limits
- A **natural language query engine** that converts plain English into structured filters — built entirely with rule-based parsing (no LLMs)
- A seeded database of 2026 profiles, safe to re-run without duplicates
- Strict query validation with structured error responses

---

## Getting started

Install dependencies:

```bash
pnpm install
```

Run development server:

```bash
pnpm run dev
```

Start production server:

```bash
pnpm run start
```

The API will be available at:

```
http://localhost:3000
```

---

## Database schema

All profiles are stored in a `profiles` table with the following structure:

| Field                | Type          | Notes                                      |
| -------------------- | ------------- | ------------------------------------------ |
| `id`                 | UUID v7       | Primary key, auto-generated                |
| `name`               | VARCHAR       | Unique, person's full name                 |
| `gender`             | VARCHAR       | `"male"` or `"female"`                     |
| `gender_probability` | FLOAT         | Confidence score from Genderize API        |
| `age`                | INT           | Exact predicted age                        |
| `age_group`          | VARCHAR       | `child`, `teenager`, `adult`, or `senior`  |
| `country_id`         | VARCHAR(2)    | ISO 3166-1 alpha-2 code (e.g. `NG`, `US`)  |
| `country_name`       | VARCHAR       | Full country name                          |
| `country_probability`| FLOAT         | Confidence score from Nationalize API      |
| `created_at`         | TIMESTAMP     | Auto-generated, stored in UTC              |

---

## Data seeding

The database is pre-seeded with **2026 profiles**. Re-running the seed is safe. It uses upsert logic and does not create duplicate records. Seeding runs automatically when the server starts.

---

## API endpoints

### POST `/api/profiles`

Creates or retrieves a profile based on a given name. The service fetches predictions from external APIs and stores a normalised profile in the database.

#### Request body

| Field | Type   | Required | Description      |
| ----- | ------ | -------- | ---------------- |
| name  | string | yes      | Name to classify |

#### Validation rules

- `name` is required
- `name` cannot be empty
- `name` must not be numeric

#### Example request

```http
POST /api/profiles
Content-Type: application/json

{
  "name": "alex"
}
```

#### 200 OK — new profile created

```json
{
  "status": "success",
  "data": {
    "id": "01957a3e-3b2c-7e4f-a1b2-c3d4e5f60001",
    "name": "alex",
    "gender": "male",
    "gender_probability": 0.99,
    "age": 28,
    "age_group": "adult",
    "country_id": "US",
    "country_name": "United States",
    "country_probability": 0.87,
    "created_at": "2026-04-22T10:00:00.000Z"
  }
}
```

#### 409 Conflict — profile already exists

```json
{
  "status": "success",
  "message": "Profile already exists",
  "data": {
    "id": "01957a3e-3b2c-7e4f-a1b2-c3d4e5f60001",
    "name": "alex",
    "gender": "male",
    "gender_probability": 0.99,
    "age": 28,
    "age_group": "adult",
    "country_id": "US",
    "country_name": "United States",
    "country_probability": 0.87,
    "created_at": "2026-04-22T10:00:00.000Z"
  }
}
```

---

### GET `/api/profiles`

Returns a paginated, filterable, sortable list of profiles.

#### Query parameters

| Parameter               | Type   | Description                                                      |
| ----------------------- | ------ | ---------------------------------------------------------------- |
| `gender`                | string | Filter by gender: `male` or `female`                             |
| `age_group`             | string | Filter by group: `child`, `teenager`, `adult`, `senior`          |
| `country_id`            | string | Filter by ISO 3166-1 alpha-2 country code (e.g. `NG`, `US`)     |
| `min_age`               | number | Minimum age (inclusive)                                          |
| `max_age`               | number | Maximum age (inclusive)                                          |
| `min_gender_probability`| number | Minimum gender confidence score (0–1)                            |
| `min_country_probability`| number| Minimum country confidence score (0–1)                           |
| `sort_by`               | string | Sort field: `age`, `created_at`, or `gender_probability`         |
| `order`                 | string | Sort direction: `asc` or `desc`                                  |
| `page`                  | number | Page number (default: `1`)                                       |
| `limit`                 | number | Results per page (default: `10`, max: `50`)                      |

All filters are combinable. Results must match **all** supplied conditions simultaneously.

#### Example requests

```
GET /api/profiles?gender=male&country_id=NG&min_age=25
GET /api/profiles?age_group=adult&sort_by=age&order=desc&page=2&limit=20
GET /api/profiles?min_gender_probability=0.9&min_country_probability=0.8
```

#### Success response

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "data": [
    {
      "id": "01957a3e-3b2c-7e4f-a1b2-c3d4e5f60001",
      "name": "Chidi Okeke",
      "gender": "male",
      "gender_probability": 0.97,
      "age": 31,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.91,
      "created_at": "2026-04-22T10:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/profiles/search`

Converts a plain English query string into structured filters and returns matching profiles. Pagination parameters (`page`, `limit`) apply here too.

#### Query parameters

| Parameter | Type   | Description                                       |
| --------- | ------ | ------------------------------------------------- |
| `q`       | string | Natural language query (see rules below)          |
| `page`    | number | Page number (default: `1`)                        |
| `limit`   | number | Results per page (default: `10`, max: `50`)       |

#### Example requests

```
GET /api/profiles/search?q=young males from nigeria
GET /api/profiles/search?q=adult females above 30&page=2&limit=25
GET /api/profiles/search?q=teenagers from kenya sorted by age descending
```

#### Success response

Same structure as `GET /api/profiles`.

#### Uninterpretable query

```json
{
  "status": "error",
  "message": "Unable to interpret query"
}
```

---

## Natural language query engine

The search endpoint uses a **rule-based parser** to convert plain English into the same filter parameters accepted by `GET /api/profiles`. No LLMs or AI models are involved.

### How it works

The input string is lowercased and tokenised. A set of pattern rules is matched against it to extract filter values. Matches are combined to produce a filter object identical to what structured query parameters would produce.

### Supported mappings

#### Gender

| Term(s)                                                    | Maps to         |
| ---------------------------------------------------------- | --------------- |
| `male`, `males`, `man`, `men`, `boy`, `boys`, `guy`, `guys`, `gentleman`, `gentlemen` | `gender=male`   |
| `female`, `females`, `woman`, `women`, `girl`, `girls`, `lady`, `ladies`              | `gender=female` |

#### Age group

| Term(s)                                                                    | Maps to              |
| -------------------------------------------------------------------------- | -------------------- |
| `child`, `children`, `kid`, `kids`, `minor`, `minors`                      | `age_group=child`    |
| `teenager`, `teenagers`, `teen`, `teens`, `adolescent`, `adolescents`      | `age_group=teenager` |
| `adult`, `adults`, `grown up`, `grown-up`, `lady`, `ladies`, `gentleman`, `gentlemen` | `age_group=adult`    |
| `senior`, `seniors`, `elderly`, `retired`, `retirees`                      | `age_group=senior`   |

> **Note:** `lady`/`ladies` and `gentleman`/`gentlemen` are listed under both `gender` and `age_group`. Gender takes priority — if one of these terms appears in a query, it resolves to gender first.

#### The "young" keyword

`young` is a **special-case keyword**. It is not a stored `age_group` value. When matched, it sets:

```
min_age = 16
max_age = 24
age_group = null
```

This overrides any `age_group` match in the same query.

#### Age — minimum

| Pattern                                             | Example                        |
| --------------------------------------------------- | ------------------------------ |
| `at least <N> years old`                            | `at least 25 years old`        |
| `(min\|minimum) age (is\|of\|from\|at\|starting at) <N>` | `minimum age of 18`      |
| `no younger than <N>`                               | `no younger than 30`           |
| `age starting at <N>`                               | `age starting at 21`           |
| `from age <N>`                                      | `from age 40`                  |
| `aged <N>`                                          | `aged 22`                      |

#### Age — maximum

| Pattern                                             | Example                        |
| --------------------------------------------------- | ------------------------------ |
| `up to <N>`                                         | `up to 45`                     |
| `no older than <N>`                                 | `no older than 60`             |
| `(max\|maximum) age (is\|of\|up to\|at) <N>`        | `maximum age of 50`            |
| `at most <N> years old`                             | `at most 35 years old`         |
| `to age <N>`                                        | `to age 65`                    |

#### Age — between range

The pattern `between [age|the age of|the ages of] <N> (and|to) <N>` sets both `min_age` and `max_age` simultaneously.

```
between 18 and 35
between the ages of 20 to 40
```

When a `between` match is found, it takes priority over individual `min_age`/`max_age` patterns.

#### Country

Countries are matched by their **full name** (case-insensitive) against an internal country-code mapping. The resolved ISO 3166-1 alpha-2 code is used as the `country_id` filter.

```
from nigeria     → country_id=NG
people in kenya  → country_id=KE
from angola      → country_id=AO
```

#### Confidence scores

| Pattern                                                                                   | Maps to                    |
| ----------------------------------------------------------------------------------------- | -------------------------- |
| `(gender confidence\|gender probability\|gender_probability) (of at least\|starting at) <N>` | `min_gender_probability=N` |
| `(min\|minimum) gender (confidence\|probability\|gender_probability) (is\|of\|from\|at\|starting at) <N>` | `min_gender_probability=N` |
| `(country confidence\|country probability\|country_probability) (of at least\|starting at) <N>` | `min_country_probability=N` |
| `(min\|minimum) country (confidence\|probability\|country_probability) (is\|of\|from\|at\|starting at) <N>` | `min_country_probability=N` |

#### Sorting

| Pattern                                                                                   | Maps to                       |
| ----------------------------------------------------------------------------------------- | ----------------------------- |
| `(sort\|arrange\|group) by age` / `sorted by age`                                        | `sort_by=age`                 |
| `(sort\|arrange\|group) by created at` / `sorted by created at`                          | `sort_by=created_at`          |
| `(sort\|arrange\|group) by (gender confidence\|gender probability\|gender_probability)`   | `sort_by=gender_probability`  |

#### Sort order

| Term(s)                              | Maps to     |
| ------------------------------------ | ----------- |
| `ascending`, `asc`, `lowest first`, `a to z`, `oldest first` | `order=asc`  |
| `descending`, `desc`, `highest first`, `z to a`, `newest first` | `order=desc` |


### Try it yourself — example queries

The table below walks through queries from simple to complex, showing exactly what each phrase triggers in the parser.

#### Simple queries

| Query | Resolved filters |
| ----- | ---------------- |
| `young males` | `gender=male`, `min_age=16`, `max_age=24` |
| `elderly women` | `age_group=senior`, `gender=female` |
| `kids from france` | `age_group=child`, `country_id=FR` |
| `teenagers` | `age_group=teenager` |
| `guys` | `gender=male` |

```
GET /api/profiles/search?q=young males
GET /api/profiles/search?q=elderly women
GET /api/profiles/search?q=kids from france
```

---

#### Intermediate queries

| Query | Resolved filters |
| ----- | ---------------- |
| `women no older than 40` | `gender=female`, `max_age=40` |
| `men at least 30 years old from ghana` | `gender=male`, `min_age=30`, `country_id=GH` |
| `adults sorted by age ascending` | `age_group=adult`, `sort_by=age`, `order=asc` |
| `seniors from nigeria sorted by age descending` | `age_group=senior`, `country_id=NG`, `sort_by=age`, `order=desc` |
| `women between the ages of 20 to 35` | `gender=female`, `min_age=20`, `max_age=35` |

```
GET /api/profiles/search?q=women no older than 40
GET /api/profiles/search?q=men at least 30 years old from ghana
GET /api/profiles/search?q=adults sorted by age ascending
GET /api/profiles/search?q=seniors from nigeria sorted by age descending
GET /api/profiles/search?q=women between the ages of 20 to 35
```

---

#### Complex queries

| Query | Resolved filters |
| ----- | ---------------- |
| `males from India aged between 50 and 70, and min gender probability of 0.9, sorted by age in asc order` | `gender=male`, `country_id=IN`, `min_age=50`, `max_age=70`, `min_gender_probability=0.9`, `sort_by=age`, `order=asc` |
| `senior men with country probability of at least 0.85 sorted by age lowest first` | `age_group=senior`, `gender=male`, `min_country_probability=0.85`, `sort_by=age`, `order=asc` |
| `girls between 13 and 17 from kenya sorted by gender probability descending` | `gender=female`, `min_age=13`, `max_age=17`, `country_id=KE`, `sort_by=gender_probability`, `order=desc` |
| `adult males from brazil minimum age of 25, maximum age of 45, minimum gender probability of 0.95` | `age_group=adult`, `gender=male`, `country_id=BR`, `min_age=25`, `max_age=45`, `min_gender_probability=0.95` |

```
GET /api/profiles/search?q=males from India aged between 50 and 70, and min gender probability of 0.9, sorted by age in asc order
GET /api/profiles/search?q=senior men with country probability of at least 0.85 sorted by age lowest first
GET /api/profiles/search?q=girls between 13 and 17 from kenya sorted by gender probability descending
GET /api/profiles/search?q=adult males from brazil minimum age of 25, maximum age of 45, minimum gender probability of 0.95
```

> **Tip:** Pagination works on all search queries. Append `&page=2&limit=25` to any request above to walk through results.
---

## Natural language parser — known limitations

The parser is rule-based and pattern-matched. It is intentionally simple and has the following constraints:

1. **Exact phrasing required for some patterns.** Paraphrasing outside the defined patterns will not match. For example, `"above 30"` does not resolve a `min_age` unless the query uses one of the listed patterns like `"at least 30"` or `"no younger than 30"`. The word `"above"` alone is not a supported keyword.

2. **No semantic understanding.** The parser does not understand meaning — only surface patterns. `"old people"` will not match `age_group=senior` unless the word `senior`, `elderly`, or `retired` is present.

3. **Gender vs age_group ambiguity.** Terms like `lady`, `ladies`, `gentleman`, and `gentlemen` appear in both the `gender` and `age_group` mapping tables. Due to the order of evaluation, these will resolve to whichever category is matched first. In practice, the `gender` check runs before `age_group` is evaluated, so these terms will produce a gender filter, not an age_group filter, when used alone.

4. **`young` overrides `age_group`.** If the word `young` is present in the query, `age_group` is set to `null` regardless of other terms, and `min_age=16`, `max_age=24` are applied. You cannot combine `young` with a different `age_group` in the same query.

5. **`between` overrides individual age patterns.** If a `between X and Y` age range is detected, it takes precedence over any separate `min_age` or `max_age` patterns in the same query.

6. **Country matching is full-name only.** Countries must appear by their full English name (e.g. `nigeria`, `united kingdom`). ISO codes, demonyms (`nigerian`, `british`), and partial names are not supported.

7. **Multi-gender queries are not supported.** A query like `"males and females"` cannot resolve two genders simultaneously. The parser returns whichever gender term it matches first.

8. **Uninterpretable queries fail gracefully.** If no recognisable filter can be extracted from the query, the endpoint returns `{ "status": "error", "message": "Unable to interpret query" }` rather than returning all profiles.

9. **Numbers must be numeric digits.** Written-out numbers like `"twenty five"` are not supported. Use `25`.

10. **No partial matches on composite phrases.** Patterns like `"sort by age"` must appear as a contiguous phrase. `"age sorting"` or `"sort using age"` will not match.

---

## Error responses

All errors follow a consistent structure:

```json
{
  "status": "error",
  "message": "<human-readable error message>"
}
```

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| `400`  | Missing or empty required parameter           |
| `422`  | Parameter present but invalid type or value   |
| `404`  | Profile not found                             |
| `500`  | Internal server error                         |
| `502`  | Upstream API call failed                      |

### Examples

#### 400 Bad Request

```json
{
  "status": "error",
  "message": "'name' is required in request body"
}
```

#### 422 Unprocessable Entity

```json
{
  "status": "error",
  "message": "Invalid query parameters"
}
```

or

```json
{
  "status": "error",
  "message": "No prediction available for the provided name"
}
```

#### 502 Bad Gateway

```json
{
  "status": "error",
  "message": "Error calling Genderize API"
}
```

#### 500 Internal Server Error

```json
{
  "status": "error",
  "message": "Internal server error"
}
```

---

## Features

- Express REST API with TypeScript
- Parallel external API calls (Genderize, Agify, Nationalize)
- Database persistence with deduplication (case-insensitive name match)
- Age group classification (`child`, `teenager`, `adult`, `senior`)
- Country probability extraction (highest probability selection)
- Input validation middleware
- Centralized error handling
- CORS support (`Access-Control-Allow-Origin: *`)
- Structured and consistent JSON responses
- Advanced multi-condition filtering on all profile fields
- Sorting by `age`, `created_at`, or `gender_probability`
- Pagination with configurable `page` and `limit` (max 50)
- Rule-based natural language query engine (no AI/LLMs)
- 2026-profile seeded dataset with safe re-seed support
- All timestamps in UTC ISO 8601
- All IDs in UUID v7 format

---

## Project structure

```
hng-i14-task-0-david-uzondu/
├── apps/
│   └── server/        # Express backend API
├── packages/          # Shared packages (types, env, db, etc.)
```

---

## Available scripts

- `pnpm run dev` – Start development server with hot reload
- `pnpm run start` – Start production server
- `pnpm run build` – Compile TypeScript
- `pnpm run check` – Lint and format code

---

## Environment variables

```env
CORS_ORIGIN=*
NODE_ENV=development
PORT=3000
DATABASE_URL=your_database_url_here
```