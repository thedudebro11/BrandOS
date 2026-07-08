# Plugin: classifier-apparel-brand

**Type:** Classifier
**Activates on:** `workspace.json` → `modules.assetManagement = true` and `type = brand`
**Extracted from:** `app/specs/05_CLASSIFICATION_ENGINE.md`

## Purpose
Extend the core baseline categories (Document, Image, Video, Design source file, Unknown — see `app/specs/05_CLASSIFICATION_ENGINE.md`) with apparel/brand-specific categories, for brand-type workspaces selling physical goods.

## Asset Categories
- Logo
- Logo revision
- Finished artwork
- Design source file
- Mockup
- Product photo
- Customer photo
- Customer testimonial
- Instagram post
- Instagram reel
- Printful order
- Receipt/invoice
- Shipping proof
- Website proof
- Marketing material
- Packaging
- Sticker
- Trademark/legal
- Business document
- Unknown

## Confidence
Uses the same confidence bands as the core Classification Engine (100 / 90-99 / 70-89 / <70 → Needs Review). This plugin only adds category detection logic on top of the core mechanism; it does not change the scoring rule.
