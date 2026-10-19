# API reference

Base path: `/api/` — `http://127.0.0.1:8000/api` locally; same-origin on the deployed app. See [README.md](../README.md) and [architecture.md](architecture.md).

## Authentication

- Everything under `/api/*` requires a JWT: `Authorization: Bearer <access>` (1-hour lifetime). A 401 makes the SPA call `POST /auth/token/refresh/` (HttpOnly refresh cookie) and retry once.
- Business endpoints additionally require the account to have a Business — otherwise 403 — and every row is scoped to the caller's business; cross-tenant foreign keys are rejected as "No such dealer."
- The OTP endpoints are public and rate-limited per IP (10/hour for requests, 20/hour for verifies).

List endpoints are paginated: `{"count", "next", "previous", "results"}`, 50 per page. CRUD viewsets accept GET, POST and PATCH — no PUT, no DELETE (Task alone re-enables DELETE); corrections go through PATCH.

## Endpoints

### Auth (public unless noted)

| Endpoint | Methods | Notes |
| --- | --- | --- |
| `/auth/registration/` | POST | `{email, password1, password2, business_name}`; creates account + business and emails a verification code |
| `/auth/registration/resend-email/` | POST | `{email}` |
| `/auth/otp/verify-email/` | POST | `{email, code}`; the account is usable only after this |
| `/auth/otp/password/request/` | POST | `{email}`; silently no-ops for unknown addresses |
| `/auth/otp/password/verify/` | POST | `{email, code}`; checks without consuming |
| `/auth/otp/password/confirm/` | POST | `{email, code, new_password1, new_password2}` |
| `/auth/login/` | POST | `{email, password}` → access token + refresh cookie |
| `/auth/logout/`, `/auth/token/refresh/`, `/auth/token/verify/` | POST | Session management |
| `/auth/user/` | GET (auth) | Profile; nests read-only `business: {id, name}` |
| `/auth/password/change/` | POST (auth) | `{old_password, new_password1, new_password2}` |

### Domain (authenticated)

| Endpoint | Methods | Notes |
| --- | --- | --- |
| `/dealers/`, `/dealers/{id}/` | GET/POST, GET/PATCH | `?search=`, `?is_active=`; responses add computed `outstanding_balance` |
| `/bills/`, `/bills/{id}/` | GET/POST, GET/PATCH | `?date_from=`, `?date_to=`, `?dealer=` |
| `/bills/{id}/file/` | GET | The bill's PDF; `?download=1` forces a download |
| `/bills/purchases/` | GET | `?period=week\|month\|quarter` — per-dealer purchase sums |
| `/payments/`, `/payments/{id}/` | GET/POST, GET/PATCH | `?date_from=`, `?date_to=`, `?dealer=`, `?method=` |
| `/payments/methods/` | GET | Method choices |
| `/tasks/`, `/tasks/{id}/` | GET/POST, GET/PATCH/DELETE | |
| `/business/` | GET/PATCH | Rename the business (`{name}`) |
| `/cashbook/` | GET | `?date_from=`, `?date_to=` |
| `/cashbook/by-date/{YYYY-MM-DD}/` | GET/PUT/DELETE | PUT is an upsert by date; 404 for a missing day |
| `/collection-trend/` | GET | `?period=week\|month\|quarter` |
| `/dashboard-summary/` | GET | `?period=week\|month\|quarter` |

## Examples

Login (the refresh cookie is set by the response):

```bash
curl -i http://127.0.0.1:8000/api/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"email": "owner@example.com", "password": "…"}'
```

Dealer and payment creation are ordinary JSON, e.g. `POST /payments/` with `{"dealer": 3, "date": "2026-10-12", "amount": "2450.00", "method": "upi"}`.

Bill creation is multipart — exactly one file source:

```bash
# A PDF you already have:
curl -s http://127.0.0.1:8000/api/bills/ \
  -H "Authorization: Bearer $TOKEN" \
  -F image=@bill.pdf \
  -F dealer=3 -F date=2026-10-12 -F amount=18200.00

# …or photo pages, compiled into one PDF on the server (in place of `image`):
curl -s http://127.0.0.1:8000/api/bills/ \
  -H "Authorization: Bearer $TOKEN" \
  -F images=@page1.jpg -F images=@page2.jpg \
  -F dealer=3 -F date=2026-10-12 -F amount=18200.00
```

## Validation and errors

- Bill and payment `amount` must be greater than zero; `dealer` must belong to the caller's business.
- A bill needs a file: one PDF (`image`, content type `application/pdf`) or photo pages (`images`: JPG, JPEG, PNG, WEBP — verified with Pillow). Not both; HEIC/HEIF is rejected; combined size is capped at 10 MB.
- Dealer name is unique per business. Cashbook allows one row per day per business; its `date` comes from the URL and `total` is a read-only database-generated column.
- An unknown `period` returns 400 listing the valid choices. A failed email delivery returns a clean 503, not a 500.
