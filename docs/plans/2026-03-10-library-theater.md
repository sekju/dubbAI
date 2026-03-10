# Library + Theater Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Przebudować frontend DubbAI na model `Library + Theater` i dołożyć backendowe wsparcie dla folderów, playlist oraz nawigacji odtwarzacza po playliście.

**Architecture:** `Library` stanie się osobną trasą do zarządzania projektami, folderami i playlistami. `Theater` stanie się osobną trasą z własnym store'em odtwarzacza i kolejki playlisty, z overlayem znikającym po bezruchu oraz wysuwanym panelem materiałów.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Zustand, Vitest, FastAPI, SQLAlchemy, Pydantic, Pytest

---

### Task 1: Add backend folder and playlist models

**Files:**
- Modify: `backend/app/models/project.py`
- Create: `backend/app/models/folder.py`
- Create: `backend/app/models/playlist.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_library_models.py`

**Step 1: Write the failing test**

Write tests covering:
- project can belong to one folder
- playlist stores ordered items
- same project can belong to multiple playlists

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_library_models.py -q`
Expected: FAIL because models and relations do not exist.

**Step 3: Write minimal implementation**

Add SQLAlchemy models for:
- `Folder`
- `Playlist`
- `PlaylistItem`
- `folder_id` on `Project`

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_library_models.py -q`
Expected: PASS

### Task 2: Add backend routes for folder and playlist CRUD

**Files:**
- Create: `backend/app/schemas/library.py`
- Create: `backend/app/api/routes/library.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/services/projects.py`
- Test: `backend/tests/test_library_routes.py`

**Step 1: Write the failing test**

Write API tests for:
- create folder
- create playlist
- assign project to folder
- add project to playlist
- reorder playlist items
- delete project from playlist

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_library_routes.py -q`
Expected: FAIL because schemas and routes are missing.

**Step 3: Write minimal implementation**

Add REST endpoints and serializers for folder and playlist management.

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_library_routes.py -q`
Expected: PASS

### Task 3: Build library state and API client

**Files:**
- Create: `frontend/store/use-library-store.ts`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/types.ts`
- Test: `frontend/tests/library-store.test.ts`

**Step 1: Write the failing test**

Write tests for:
- selecting active folder
- selecting active playlist
- setting sort and filters
- storing playlist queue metadata

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/library-store.test.ts`
Expected: FAIL because the store does not exist.

**Step 3: Write minimal implementation**

Add library store and API helpers for folder / playlist CRUD.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/library-store.test.ts`
Expected: PASS

### Task 4: Replace dashboard with real `/library` route

**Files:**
- Create: `frontend/app/library/page.tsx`
- Create: `frontend/components/library/library-shell.tsx`
- Create: `frontend/components/library/library-sidebar.tsx`
- Create: `frontend/components/library/library-grid.tsx`
- Create: `frontend/components/library/library-inspector.tsx`
- Modify: `frontend/app/page.tsx`
- Test: `frontend/tests/library-shell.test.tsx`

**Step 1: Write the failing test**

Write a UI test covering:
- folders and playlists visible in sidebar
- project cards visible in main area
- inspector opens for selected project
- CTA opens Theater

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/library-shell.test.tsx`
Expected: FAIL because `/library` shell does not exist.

**Step 3: Write minimal implementation**

Implement library layout with:
- left navigation
- central project list
- right inspector

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/library-shell.test.tsx`
Expected: PASS

### Task 5: Build Theater queue store and routing

**Files:**
- Create: `frontend/store/use-theater-queue-store.ts`
- Create: `frontend/app/theater/[playlistId]/[projectId]/page.tsx`
- Modify: `frontend/lib/api.ts`
- Test: `frontend/tests/theater-queue-store.test.ts`

**Step 1: Write the failing test**

Write tests for:
- loading playlist items
- selecting current index
- next/previous navigation
- autoplay toggle

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theater-queue-store.test.ts`
Expected: FAIL because the queue store does not exist.

**Step 3: Write minimal implementation**

Add Theater queue store and route params handling.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/theater-queue-store.test.ts`
Expected: PASS

### Task 6: Replace native player controls with custom Theater player

**Files:**
- Modify: `frontend/components/player/dubbai-player.tsx`
- Modify: `frontend/store/use-player-store.ts`
- Test: `frontend/tests/dubbai-player.test.tsx`

**Step 1: Write the failing test**

Write tests covering:
- play/pause
- keyboard shortcuts
- time-driven cue switching
- overlay hide/show
- settings panel toggles
- autoplay next callback

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dubbai-player.test.tsx`
Expected: FAIL because the current player still relies on native controls and missing behaviors.

**Step 3: Write minimal implementation**

Implement custom controls:
- transport row
- timeline
- volume
- playback speed
- fullscreen
- settings menu
- hide/show overlay on inactivity

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dubbai-player.test.tsx`
Expected: PASS

### Task 7: Add Theater layout with collapsible playlist panel

**Files:**
- Create: `frontend/components/theater/theater-shell.tsx`
- Create: `frontend/components/theater/theater-playlist-drawer.tsx`
- Modify: `frontend/components/projects/project-workspace.tsx`
- Test: `frontend/tests/theater-shell.test.tsx`

**Step 1: Write the failing test**

Write a UI test for:
- playlist drawer hidden by default
- drawer opens from Theater
- clicking playlist item navigates to another project
- fullscreen mode keeps Theater layout clean

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theater-shell.test.tsx`
Expected: FAIL because Theater shell and drawer do not exist.

**Step 3: Write minimal implementation**

Implement Theater shell and wire it to queue state.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/theater-shell.test.tsx`
Expected: PASS

### Task 8: Wire Library actions to Theater and batch management

**Files:**
- Modify: `frontend/components/library/library-grid.tsx`
- Modify: `frontend/components/library/library-inspector.tsx`
- Modify: `frontend/components/library/library-sidebar.tsx`
- Test: `frontend/tests/library-actions.test.tsx`

**Step 1: Write the failing test**

Write tests for:
- create folder
- create playlist
- move project to folder
- add project to playlist
- delete project
- open playlist in Theater

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/library-actions.test.tsx`
Expected: FAIL because actions are not wired.

**Step 3: Write minimal implementation**

Wire Library UI to CRUD and Theater launch flows.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/library-actions.test.tsx`
Expected: PASS

### Task 9: Clean migration from old workspace flow

**Files:**
- Modify: `frontend/app/projects/[projectId]/page.tsx`
- Modify: `frontend/app/page.tsx`
- Modify: `README.md`
- Test: `frontend/tests/routing-smoke.test.tsx`

**Step 1: Write the failing test**

Write routing smoke tests for:
- `/` redirects or points clearly to `/library`
- project CTA reaches Theater
- old route still works as compatibility entrypoint

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routing-smoke.test.tsx`
Expected: FAIL because routing compatibility is not implemented.

**Step 3: Write minimal implementation**

Finish migration and compatibility route behavior.

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

**Step 4: Runtime smoke**

Run:
- `docker compose up -d`
- open `/library`
- open Theater from a playlist item
- verify cue switching, keyboard shortcuts, drawer and autoplay toggle
