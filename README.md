# DubbAI

Production-oriented multi-user SaaS for transcript, translation, diarization and AI dubbing of video content, with local-first development via Docker Compose.

## Stack

- Frontend: Next.js, React, Tailwind CSS, Zustand
- API: FastAPI
- Background jobs: Celery + Redis
- Database: Postgres
- Storage: Cloudflare R2
- Media pipeline: FFmpeg, yt-dlp
- AI: Gemini text + Gemini TTS

## Local development

1. Copy `.env.example` to `.env`
2. Fill in Gemini and R2 credentials
3. Run `docker compose up --build`
4. Open `http://localhost:3002`
5. Open `http://localhost:8000/api/docs`
6. Open `http://localhost:8025` for activation mails in Mailpit

## Services

- `frontend` -> Next.js app
- `api` -> FastAPI app
- `worker` -> Celery worker
- `postgres` -> primary database
- `redis` -> Celery broker/result backend
- `mailpit` -> local e-mail capture

## Repo structure

```text
.
|-- backend
|   |-- app
|   |   |-- api
|   |   |-- core
|   |   |-- db
|   |   |-- models
|   |   |-- schemas
|   |   |-- services
|   |   `-- tasks
|   |-- tests
|   |-- Dockerfile
|   `-- requirements.txt
|-- docs
|   `-- plans
|-- frontend
|   |-- app
|   |-- components
|   |-- lib
|   |-- store
|   |-- tests
|   `-- Dockerfile
|-- storage
|-- .env.example
|-- docker-compose.yml
`-- README.md
```
