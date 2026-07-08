# Relationship Engine

## Purpose
Make connections between assets to create a factual case history.

## Relationship Examples
Generic: source file -> export, work -> proof of use, proof of use -> public/customer evidence.

Illustrative, from Fatletic (a brand-type workspace with `assetManagement`, `instagram`, `printful` active):
- PSD source -> PNG export
- Logo file -> T-shirt mockup
- Mockup -> Printful product
- Printful order -> shipment proof
- Shipment proof -> first product photo
- Product photo -> Instagram post
- Instagram post -> customer inquiry
- Customer photo -> proof of public marketplace use

A workspace with different active modules will have a different relationship vocabulary; the engine itself does not assume any of the above are universal.

## Output
- Relationship_Graph.json
- Relationship_Graph.md
- Dashboard graph view

## Rule
Every relationship must have confidence and evidence.
