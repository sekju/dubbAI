# Library + Theater UX Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Przebudować DubbAI do czytelnego flow `upload/url -> transcript -> translation -> theater`, z task-first `Library`, stage-driven `Theater`, wyborem języków oraz modelem napisów gotowym pod późniejszy dubbing.

**Architecture:** `Library` zostaje przebudowane z układu panelowego na ekran zadaniowy z intake u góry i listą projektów poniżej. `Theater` staje się ekranem pipeline i odtwarzania z realnym fullscreen, CTA dla brakujących etapów oraz nowym modelem `Primary/Secondary track`. Backend rozszerza `Project` o języki i etapowe statusy, a API rozdziela akcje transkrypcji i tłumaczenia.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Zustand, Vitest, FastAPI, SQLAlchemy, Pydantic, Celery, Pytest

---

### Task 1: Extend project model for languages and stage statuses

**Files:**
- Modify: `backend/app/models/project.py`
- Modify: `backend/app/schemas/project.py`
- Modify: `backend/app/services/projects.py`
- Test: `backend/tests/test_project_model_pipeline.py`

**Step 1: Write the failing test**

Write tests covering:
- project stores `source_language` and `target_language`
- project stores independent `transcript_status`, `translation_status`, `dubbing_status`
- library and project serializers expose those fields

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_project_model_pipeline.py -q`
Expected: FAIL because the fields and serializers do not exist.

**Step 3: Write minimal implementation**

Add the new columns and schema fields. Keep legacy `status` for compatibility, but serialize the new stage fields for all new UI consumers.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_project_model_pipeline.py -q`
Expected: PASS

### Task 2: Add project intake languages and backend defaults

**Files:**
- Modify: `backend/app/schemas/project.py`
- Modify: `backend/app/api/routes/projects.py`
- Modify: `backend/app/services/projects.py`
- Test: `backend/tests/test_project_intake_languages.py`

**Step 1: Write the failing test**

Write tests covering:
- upload and URL intake accept `source_language` and `target_language`
- `en` defaults to `pl`
- `pl` defaults to `en`
- explicit non-default target language is preserved

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_project_intake_languages.py -q`
Expected: FAIL because intake does not support language fields yet.

**Step 3: Write minimal implementation**

Extend intake requests and service logic with language defaults and persistence.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_project_intake_languages.py -q`
Expected: PASS

### Task 3: Split pipeline actions into transcribe and translate

**Files:**
- Modify: `backend/app/api/routes/projects.py`
- Modify: `backend/app/tasks/ai.py`
- Modify: `backend/app/services/gemini.py`
- Modify: `backend/app/services/projects.py`
- Test: `backend/tests/test_project_pipeline_routes.py`

**Step 1: Write the failing test**

Write tests covering:
- transcribe endpoint sets transcript stage to queued
- translate endpoint sets translation stage to queued
- completed transcript and translation states are serialized back to the client

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_project_pipeline_routes.py -q`
Expected: FAIL because translate route and stage handling do not exist.

**Step 3: Write minimal implementation**

Add a dedicated translate route and status handling. If Gemini still does combined work internally for now, keep that implementation detail behind the route contract and stage statuses.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_project_pipeline_routes.py -q`
Expected: PASS

### Task 4: Rebuild library API payload for task-first UI

**Files:**
- Modify: `backend/app/schemas/library.py`
- Modify: `backend/app/services/projects.py`
- Test: `backend/tests/test_library_payload_pipeline.py`

**Step 1: Write the failing test**

Write tests covering:
- library payload includes languages and stage statuses
- each project exposes a `next_action` value derived from pipeline state

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_library_payload_pipeline.py -q`
Expected: FAIL because library payload lacks pipeline metadata.

**Step 3: Write minimal implementation**

Add pipeline metadata to library serialization and compute `next_action` server-side.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_library_payload_pipeline.py -q`
Expected: PASS

### Task 5: Replace the library UI with a task-first layout

**Files:**
- Modify: `frontend/components/projects/project-intake-form.tsx`
- Modify: `frontend/components/library/library-shell.tsx`
- Modify: `frontend/components/library/library-grid.tsx`
- Modify: `frontend/components/library/library-sidebar.tsx`
- Modify: `frontend/components/library/library-inspector.tsx`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/types.ts`
- Test: `frontend/tests/library-shell.test.tsx`
- Test: `frontend/tests/library-actions.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- intake includes source and target language selectors
- project list shows languages and next action
- folder and playlist actions use explicit target pickers instead of active-state coupling
- project actions remain usable without selecting a sidebar collection first

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/library-shell.test.tsx tests/library-actions.test.tsx`
Expected: FAIL because current library layout and interactions still assume the old model.

**Step 3: Write minimal implementation**

Rebuild the library view around:
- top intake section
- main project list with task-oriented actions
- secondary organization panel for folders and playlists

Do not preserve the current three-column inspector-driven interaction model.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/library-shell.test.tsx tests/library-actions.test.tsx`
Expected: PASS

### Task 6: Rebuild theater around pipeline states

**Files:**
- Modify: `frontend/components/theater/theater-shell.tsx`
- Modify: `frontend/app/theater/[playlistId]/[projectId]/page.tsx`
- Modify: `frontend/lib/api.ts`
- Test: `frontend/tests/theater-shell.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- theater shows pipeline stages
- theater shows `Start transcription` when transcript is missing
- theater shows `Start translation` when translation is missing
- theater opens player mode only when the stage data needed for viewing exists

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theater-shell.test.tsx`
Expected: FAIL because current theater shell does not expose pipeline actions.

**Step 3: Write minimal implementation**

Rebuild theater header and empty states around pipeline stage visibility and actions.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/theater-shell.test.tsx`
Expected: PASS

### Task 7: Replace pseudo-fullscreen with real Fullscreen API

**Files:**
- Modify: `frontend/components/player/dubbai-player.tsx`
- Modify: `frontend/store/use-player-store.ts`
- Test: `frontend/tests/dubbai-player.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- fullscreen button calls the browser fullscreen API
- store state tracks real fullscreen transitions
- exiting fullscreen restores the theater chrome correctly

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dubbai-player.test.tsx`
Expected: FAIL because current fullscreen is only a local UI flag.

**Step 3: Write minimal implementation**

Implement fullscreen on the player container using real browser APIs and keep store state synchronized with fullscreen change events.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dubbai-player.test.tsx`
Expected: PASS

### Task 8: Replace subtitle mode with primary and secondary tracks

**Files:**
- Modify: `frontend/components/player/dubbai-player.tsx`
- Modify: `frontend/store/use-player-store.ts`
- Modify: `frontend/lib/types.ts`
- Test: `frontend/tests/dubbai-player.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- `Primary track` can show original or translation
- `Secondary track` can show original, translation, or off
- swap action exchanges slot assignments
- single-line rendering is identical regardless of whether the slot points at original or translation

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dubbai-player.test.tsx`
Expected: FAIL because the player still uses `original / translation / dual`.

**Step 3: Write minimal implementation**

Replace old subtitle mode logic with slot-based track settings. Keep typography driven by slot role, not text origin.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dubbai-player.test.tsx`
Expected: PASS

### Task 9: Remove dependence on old workspace flow

**Files:**
- Modify: `frontend/app/projects/[projectId]/page.tsx`
- Modify: `frontend/components/projects/project-workspace.tsx`
- Modify: `README.md`
- Test: `frontend/tests/routing-smoke.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- old project route redirects into the new task-first Library or Theater flow
- old workspace component is no longer a primary execution path

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routing-smoke.test.tsx`
Expected: FAIL if old workspace assumptions still leak into the new flow.

**Step 3: Write minimal implementation**

Keep compatibility routing, but remove any product-level reliance on the old workspace screen.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/routing-smoke.test.tsx`
Expected: PASS

### Task 10: Full verification

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

**Step 4: Run runtime smoke**

Run:
- `docker compose down -v`
- `docker compose up -d --build`
- open `/library`
- create project from upload and URL
- verify language selectors and default mapping
- trigger transcription and translation
- open Theater
- verify pipeline stages, fullscreen, track swap, folder and playlist actions
