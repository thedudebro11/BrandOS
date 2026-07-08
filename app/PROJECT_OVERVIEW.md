# Project Overview

## Product Name
BrandOS

## Core Mission
Build a reusable, multi-workspace digital archive platform that preserves every original file for a workspace (a brand, business, or personal knowledge vault) and creates an organized, evidence-backed record of its creation, first use, commercial use, public/customer use, development, and — where relevant — trademark readiness.

## First Workspace: Fatletic
Fatletic is the first workspace built on BrandOS: an enterprise-grade digital archive for the FATLETIC brand. Its specific mission (trademark evidence, priority of use, FATLETE conflict research) is documented in `workspaces/Fatletic/README.md`, not here — this file describes the platform every workspace runs on.

## Primary Outcomes (platform-wide)
- Preserve all original files unchanged, in every workspace.
- Create an organized archive copy per workspace.
- Generate a SHA-256 hash manifest for every file.
- Extract metadata from images, videos, PDFs, PSD/XCF/project files, orders, receipts, and documents.
- Classify every file with confidence scoring.
- Place uncertain files into a Human Review Queue.
- Build chronological timelines.
- Let a workspace assemble named cases (Case Builder) that reference evidence without duplicating it.
- Generate workspace-appropriate reports via plugins (e.g. Priority of Use Dossier and Trademark Readiness Report for brand-type workspaces).
- Build a dashboard (Mission Control) showing archive health, evidence strength, timeline, gaps, and unresolved review items — scaled to whichever modules a workspace has active.
- Generate a per-workspace Obsidian vault without overwriting the user's manual edits.

## Legal Positioning
The system must be neutral. It must never exaggerate. Every conclusion must be tied to source files, cited by safe asset ID and hash rather than raw filename. It should help document facts, not invent arguments. This applies to every workspace that generates legal or evidentiary reports, not only Fatletic.
