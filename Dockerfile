# ---------------------------------------------------------------------------
# Stage 1: build the React SPA
# The Node build needs VITE_API_BASE_URL baked in at build time, e.g.
#   https://<your-project>.up.railway.app/api
# (Railway passes service variables into the docker build as args.)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Django runtime
# ---------------------------------------------------------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=frontend /src/dist ./frontend/dist

# Collect Django admin statics + the built SPA (frontend/dist) into one
# static root that WhiteNoise serves. settings.py requires DJANGO_SECRET_KEY
# at import time, but build containers don't receive service variables, so
# supply a throwaway value just for this step. The real key is injected at
# container runtime and overrides everything baked in here.
RUN DJANGO_SECRET_KEY=build-time-only python manage.py collectstatic --noinput

EXPOSE 8080
# Railway injects PORT (default 8080). Migrate against the (persistent)
# database, then serve. `exec` keeps gunicorn as PID 1 for clean shutdowns.
CMD sh -c "python manage.py migrate && \
    exec gunicorn jbb_projects.wsgi:application \
    --bind 0.0.0.0:${PORT:-8080} --workers 3"
