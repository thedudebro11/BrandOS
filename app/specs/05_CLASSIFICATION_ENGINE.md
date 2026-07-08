# Classification Engine

## Core Baseline Categories
Every workspace gets these regardless of type or active modules:
- Document
- Image
- Video
- Design source file
- Unknown

## Extended Categories (plugin-provided)
Brand-type workspaces with `modules.assetManagement` active additionally get the apparel/brand category set (Logo, Mockup, Customer photo, Printful order, etc.) via the `classifier-apparel-brand` plugin — see `app/specs/plugins/classifier-apparel-brand.md`. A different workspace type can supply its own classifier plugin with a different category set; the Classification Engine itself only defines the confidence mechanism below, not a fixed category list.

## Confidence Scores
- 100: directly proven by metadata or document text
- 90-99: strongly supported by multiple signals
- 70-89: likely but needs review
- Below 70: Needs Review

## Rule
Never silently guess. Anything uncertain goes to Human_Review_Queue.md.
