# Architecture

## Recommended Stack
- Desktop/local-first app: Tauri or Electron.
- Frontend: React + TypeScript + Tailwind.
- Backend: Node.js or Python.
- Database: SQLite.
- Search: SQLite FTS5 or Meilisearch optional.
- Exports: Markdown, PDF, CSV, JSON, ZIP.

## Core Services
1. File Scanner
2. Metadata Extractor
3. Hashing Engine
4. Classification Engine
5. Human Review Queue
6. Relationship Engine
7. Timeline Engine
8. Evidence Scoring Engine
9. Report Generator
10. Dashboard UI

## Core Principle
Original files are sacred. The app may read originals but must never modify them without explicit user approval.
