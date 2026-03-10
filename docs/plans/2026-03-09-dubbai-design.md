# DubbAI Design

**Date:** 2026-03-09

**Summary:** Produkcyjny multi-user SaaS do transkrypcji, tłumaczenia, diaryzacji i wielogłosowego dubbingu wideo z lokalnym developmentem i prostym wdrożeniem na jednym VPS przez Docker Compose.

## Założenia

- Wersja produkcyjna od pierwszego dnia
- Multi-user SaaS
- Deploy docelowy: jeden VPS z Docker Compose
- Storage mediów: Cloudflare R2
- Dev lokalny: pełny stack uruchamialny lokalnie
- Backend: FastAPI + Celery + Redis + Postgres
- Frontend: Next.js + React + Tailwind + Zustand

## Architektura

System składa się z pięciu głównych runtime'ów:

- `frontend` w Next.js
- `api` w FastAPI
- `worker` w Celery
- `postgres`
- `redis`

Cloudflare R2 pełni rolę storage dla uploadów, artefaktów pośrednich i eksportów. Operacje ciężkie obliczeniowo i I/O są realizowane poza ścieżką request/response jako joby asynchroniczne.

## Moduły domenowe

- `auth`
- `users`
- `projects`
- `media`
- `pipeline`
- `transcripts`
- `voices`
- `exports`
- `jobs`
- `notifications`

## Przepływ danych

1. Użytkownik tworzy projekt i wrzuca plik albo podaje URL.
2. API tworzy rekord projektu i enqueueuje job `ingest`.
3. Worker pobiera lub zapisuje media do R2.
4. Worker ekstrahuje audio przez FFmpeg.
5. Worker wysyła audio do Gemini i zapisuje strukturę transkrypcji z tłumaczeniem i speakerami.
6. Worker generuje TTS per segment i miksuje dubbing.
7. Worker renderuje eksporty SRT/VTT/ASS/MP4.
8. Frontend odczytuje statusy jobów przez polling lub WebSocket.

## Frontend UX

- Workspace projektu z odtwarzaczem, timeline, transcript editorem i panelem speakerów
- Dual-language subtitles
- Karaoke highlight
- Regulator gęstości napisów
- Mikser audio oryginał/dubbing w czasie rzeczywistym
- Dashboard z historią projektów i eksportów

## Bezpieczeństwo

- Argon2 dla haseł
- E-mail activation tokens z TTL
- JWT access + rotowane refresh tokens
- Autoryzacja per owner/project
- Presigned URL krótkiego życia
- Walidacja uploadów i limitów
- Audytowalne statusy jobów i błędów

## Lokalny development

Lokalny start odbywa się przez `docker compose up --build`. W środowisku dev działają:

- frontend na `localhost:3000`
- api na `localhost:8000`
- postgres
- redis
- mailpit

R2 jest używany od razu także w dev, zgodnie z decyzją projektową.
