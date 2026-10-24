# Controle do Casal Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Transform the current static PWA into a reliable, mobile-first couple finance app that is usable today and structured to compete with leading personal-finance apps.

**Architecture:** Keep GitHub Pages + Supabase to avoid migration risk today. Split pure financial logic from the browser/Supabase layer so parsing, installments and dashboard math can be tested independently. Preserve the current schema and RLS model; add UX capabilities without destructive database changes.

**Tech Stack:** HTML/CSS/ES modules, Supabase JS 2.102.0, Node built-in test runner, GitHub Pages.

**Spec:** Current product requirements in conversation: ready today, couple-first, secure, fast, conversational transaction entry, progressively competitive with market leaders.

## Global Constraints
- Do not store bank passwords, CVV, or full card numbers.
- Preserve Supabase project `xqgrspcmanbeyxbhvavi` and current household data model.
- Do not weaken RLS or expose service-role credentials to the client.
- Mobile-first, installable PWA, usable on iPhone Safari.
- No paid dependency is required for the ready-today version.

## Review Focus
- Brazilian currency parsing (comma/dot/thousands separators).
- Installments preserve exact total and clamp month-end dates.
- Dashboard never reports protected reserve as spendable.
- Transaction filters/search do not mutate source data.
- Offline state never pretends that a write was persisted.

---

### Task 1: Pure financial core
**Files:** Create `core.mjs`; create `tests/core.test.mjs`.
- [x] Write failing tests for parsing, installments, dates, dashboard and filters.
- [x] Run tests and confirm RED.
- [x] Implement minimal pure functions.
- [x] Run tests and confirm GREEN.

### Task 2: Production mobile UI
**Files:** Replace `index.html`; create `styles.css`; create `app.js`.
- [x] Build mobile-first dashboard, quick entry, filters, editing, budget, couple insight, backup and account screens.
- [x] Wire Supabase auth, household onboarding, realtime, CRUD and exports.
- [x] Syntax-check modules.

### Task 3: PWA reliability
**Files:** Update `manifest.webmanifest`; update `sw.js`.
- [x] Cache the shell only; never queue financial writes silently.
- [x] Add robust install/offline messaging.
- [x] Validate service worker syntax.

### Task 4: Security and production verification
- [x] Confirm project healthy and RLS policies intact.
- [x] Run Supabase security advisor.
- [x] Run full core tests and syntax checks.
- [ ] Push branch, review diff, then merge to `main` only after verification.
