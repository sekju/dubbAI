# Word-Timed Transcript And Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Przebudować pipeline transcriptu i player tak, aby aplikacja używała transcriptu `per-word`, obsługiwała `keyword` i `tiktok mode`, miała retry dla etapów AI oraz żywy UX pipeline zamiast martwych statusów.

**Architecture:** Backend przestaje traktować segment tekstowy jako źródło prawdy i wprowadza trwały model `transcript_words`. Gemini zwraca strukturę `per-word`, backend waliduje ją i zapisuje bez placeholderów. Frontend buduje z transcript words widoki `compact`, `balanced` i `sentence`, a `Theater` dostaje spinner, elapsed timer, progress i retry dla nieudanych etapów.

**Tech Stack:** Next.js App Router, React, Zustand, Vitest, FastAPI, SQLAlchemy, Pydantic, Celery, Pytest

---

### Task 1: Add persistent word-level transcript model

**Files:**
- Modify: `backend/app/models/transcript.py`
- Modify: `backend/app/db/base.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_transcript_word_model.py`

**Step 1: Write the failing test**

Write tests covering:
- `TranscriptWord` persistence with `start_ms`, `end_ms`, `original_text`, `translated_text`, `keyword`, `position`
- schema bootstrap adds the new table for existing dev databases

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_transcript_word_model.py -q`
Expected: FAIL because the model/table do not exist.

**Step 3: Write minimal implementation**

Add the new SQLAlchemy model and dev schema bootstrap logic. Keep existing segment table for compatibility during the transition.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_transcript_word_model.py -q`
Expected: PASS

### Task 2: Teach Gemini client to request and parse per-word transcript data

**Files:**
- Modify: `backend/app/services/gemini.py`
- Test: `backend/tests/test_gemini.py`

**Step 1: Write the failing test**

Write tests covering:
- `transcribe_translate` requests/accepts `per-word` JSON items with `start`, `end`, `text`, `keyword`
- translation parser accepts structured items and rejects malformed items
- audio transcription path uses the longer timeout budget

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_gemini.py -q`
Expected: FAIL because the client still expects coarse segment payloads.

**Step 3: Write minimal implementation**

Update prompt and parsing logic to normalize Gemini output into internal word records. Reject invalid payloads instead of silently degrading.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_gemini.py -q`
Expected: PASS

### Task 3: Replace placeholder success with validated AI pipeline output

**Files:**
- Modify: `backend/app/tasks/ai.py`
- Test: `backend/tests/test_project_intake.py`
- Test: `backend/tests/test_project_pipeline_routes.py`

**Step 1: Write the failing test**

Write tests covering:
- transcription fails when Gemini returns no usable words
- translation fails when response shape is invalid
- failed jobs set project state to `failed` and keep bad transcript/translation data out of storage

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_project_intake.py backend/tests/test_project_pipeline_routes.py -q`
Expected: FAIL because task code still allows fallback success.

**Step 3: Write minimal implementation**

Remove placeholder success paths and require validated AI output before marking stages `ready`.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_project_intake.py backend/tests/test_project_pipeline_routes.py -q`
Expected: PASS

### Task 4: Serialize transcript words to the frontend

**Files:**
- Modify: `backend/app/schemas/transcript.py`
- Modify: `backend/app/schemas/project.py`
- Modify: `backend/app/services/projects.py`
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/lib/api.ts`
- Test: `backend/tests/test_project_model_pipeline.py`

**Step 1: Write the failing test**

Write tests covering:
- project detail payload includes `transcript_words`
- each word exposes `start_ms`, `end_ms`, `original_text`, `translated_text`, `keyword`, `position`

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_project_model_pipeline.py -q`
Expected: FAIL because project payload does not expose word-level transcript data.

**Step 3: Write minimal implementation**

Add word-level schema serialization and matching frontend types/parsers. Keep old segment payload temporarily only if needed by the migration path.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_project_model_pipeline.py -q`
Expected: PASS

### Task 5: Build derived cue grouping from transcript words

**Files:**
- Create: `frontend/lib/transcript-rendering.ts`
- Modify: `frontend/lib/types.ts`
- Test: `frontend/tests/transcript-rendering.test.ts`

**Step 1: Write the failing test**

Write tests covering:
- compact mode groups a few words
- balanced mode groups short phrases
- sentence mode groups a readable sentence instead of truncating the first block
- punctuation is preserved in grouped output

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transcript-rendering.test.ts`
Expected: FAIL because transcript grouping helper does not exist.

**Step 3: Write minimal implementation**

Implement pure helpers that convert transcript words into render-ready grouped cues for each density.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/transcript-rendering.test.ts`
Expected: PASS

### Task 6: Rebuild player rendering around words, active word timing, and keywords

**Files:**
- Modify: `frontend/components/player/dubbai-player.tsx`
- Modify: `frontend/store/use-player-store.ts`
- Modify: `frontend/lib/types.ts`
- Test: `frontend/tests/dubbai-player.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- player highlights the active word by current time
- keyword words render with distinct styling
- sentence mode shows grouped sentence output instead of a single stored block

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dubbai-player.test.tsx`
Expected: FAIL because player still renders only coarse `TranscriptCue` text blocks.

**Step 3: Write minimal implementation**

Switch player subtitle rendering to use transcript words plus derived grouped cues.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dubbai-player.test.tsx`
Expected: PASS

### Task 7: Add per-track Tiktok mode toggles

**Files:**
- Modify: `frontend/store/use-player-store.ts`
- Modify: `frontend/components/player/dubbai-player.tsx`
- Test: `frontend/tests/dubbai-player.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- primary track can enable/disable tiktok mode independently
- secondary track can enable/disable tiktok mode independently
- keyword + active-word emphasis changes when tiktok mode is on

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dubbai-player.test.tsx`
Expected: FAIL because the store has no per-track tiktok toggles.

**Step 3: Write minimal implementation**

Add per-track toggles and render variants without changing the underlying transcript data.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dubbai-player.test.tsx`
Expected: PASS

### Task 8: Make Theater pipeline visibly alive with spinner and elapsed timer

**Files:**
- Modify: `frontend/components/theater/theater-shell.tsx`
- Modify: `frontend/lib/types.ts`
- Test: `frontend/tests/theater-shell.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- active job shows spinner/progress state
- elapsed timer increments while a job is active
- stage cards and gate panel both show live processing feedback

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theater-shell.test.tsx`
Expected: FAIL because the theater view does not yet render timer/spinner UX.

**Step 3: Write minimal implementation**

Add live timer, spinner, clearer stage labels, and non-dead intermediate feedback while polling.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/theater-shell.test.tsx`
Expected: PASS

### Task 9: Add retry actions for failed transcript and translation stages

**Files:**
- Modify: `backend/app/services/projects.py`
- Modify: `backend/app/tasks/ai.py`
- Modify: `frontend/components/library/library-shell.tsx`
- Modify: `frontend/components/theater/theater-shell.tsx`
- Test: `backend/tests/test_project_pipeline_routes.py`
- Test: `frontend/tests/library-actions.test.tsx`
- Test: `frontend/tests/theater-shell.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- failed transcription can be retried without deleting the project
- failed translation can be retried without deleting the project
- retry clears only stage-dependent data

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_project_pipeline_routes.py -q`
Run: `npx vitest run tests/library-actions.test.tsx tests/theater-shell.test.tsx`
Expected: FAIL because retry is not implemented as a first-class product action.

**Step 3: Write minimal implementation**

Allow retries through existing stage endpoints and clear stale data in the correct scope before re-queueing.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_project_pipeline_routes.py -q`
Run: `npx vitest run tests/library-actions.test.tsx tests/theater-shell.test.tsx`
Expected: PASS

### Task 10: Detect and surface legacy broken transcript data

**Files:**
- Modify: `backend/app/services/projects.py`
- Modify: `frontend/components/theater/theater-shell.tsx`
- Test: `backend/tests/test_project_model_pipeline.py`
- Test: `frontend/tests/theater-shell.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- projects containing known placeholder transcript patterns are flagged as invalid transcript data
- UI points the user to `Retry transcription` or `Retry translation`

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_project_model_pipeline.py -q`
Run: `npx vitest run tests/theater-shell.test.tsx`
Expected: FAIL because legacy invalid transcript data is not classified separately.

**Step 3: Write minimal implementation**

Detect legacy placeholder or malformed transcript states and route them to retry instead of pretending they are usable.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_project_model_pipeline.py -q`
Run: `npx vitest run tests/theater-shell.test.tsx`
Expected: PASS

### Task 11: Full verification

**Files:**
- Modify: `README.md`

**Step 1: Run backend tests**

Run: `python -m pytest backend/tests -q`
Expected: PASS

**Step 2: Run frontend tests**

Run: `npx vitest run`
Expected: PASS

**Step 3: Run production build**

Run: `npm run build`
Expected: PASS

**Step 4: Rebuild the runtime stack**

Run:
- `docker compose up -d --build api worker frontend`

Expected: containers restart on fresh code.

**Step 5: Runtime smoke**

Run:
- create a fresh project
- trigger transcription
- verify spinner + elapsed timer in Theater during processing
- verify transcript words highlight progressively in playback
- trigger translation
- verify translated track is not a placeholder or JSON string
- toggle `Tiktok mode` for `Primary` and `Secondary`
- verify keyword highlighting
- verify `Retry transcription` / `Retry translation` on a forced failure
