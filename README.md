# LedgerFlow

LedgerFlow is a web app that replaces a retail shop's paper ledger. It records dealers, purchase bills, payments, and a daily cashbook, and computes each relationship's running balance for you.

- Live application: https://ledgerflow.ajiteshtamrakar.com
- Portfolio case study: https://ajiteshtamrakar.com/ledger-flow

## Features

- Email-only accounts: 6-digit code verification, rotating JWT sessions, code-based password reset
- Dealers with an opening balance, optional GSTIN, active/retired flag, and a computed outstanding balance
- Purchase bills carrying one file: a PDF, or photos the server compiles into a single PDF
- Dated payments with a method (cash, UPI, card, cheque, bank transfer)
- One cashbook row per day; the daily total is a database-generated column
- Dashboard: outstanding balances, collection trend, net cash flow, purchasing, and a task list
- Audit trail via django-simple-history on the financial models

## Tech stack

| Layer | Technology |
| --- | --- |
| API | Python 3.12, Django 5.2, Django REST Framework |
| Auth | dj-rest-auth, django-allauth, Simple JWT (access token + HttpOnly refresh cookie) |
| Database | SQLite (one file under `DJANGO_DATA_DIR`) |
| Frontend | React 19, Vite, React Router 7 |
| Deployment | One Docker container (gunicorn + WhiteNoise) serving the API, the built SPA, and admin; bill PDFs on local disk |

## Running locally

Prerequisites: Python 3.11+ and Node.js 20.19+ (the Docker build uses Python 3.12 / Node 22).

### 1. Backend (port 8000)

```bash
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the repository root with at least:

```dotenv
DJANGO_SECRET_KEY=change-me        # required, or the app fails to start
IS_DEVELOPMENT=true
APP_HOSTS=127.0.0.1,localhost
```

`.env` is gitignored and loaded automatically by `settings.py` (real environment variables always win). All supported variables — SMTP, hosts, CORS, `DJANGO_DATA_DIR` — are documented in `jbb_projects/settings.py`. Then:

```bash
python manage.py migrate
python manage.py runserver         # http://127.0.0.1:8000
```

The dev email backend is console-based: verification codes print to the terminal. Set the `EMAIL_*` variables in `.env` for real delivery.

### 2. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

The dev client calls `http://127.0.0.1:8000/api` by default; set `VITE_API_BASE_URL` to point it elsewhere.

### Tests and seed data

```bash
python manage.py test accountancy
python scripts/seed_dummy_data.py <access-token> [base-url]   # optional
```

It runs against the live dev server and seeds your account with a year of plausible dealers, bills, payments, and cashbook rows.

## Documentation

- [Architecture](docs/architecture.md) — components, request flow, key decisions
- [API reference](docs/api.md) — endpoints, authentication, request examples
