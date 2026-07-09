import path from "node:path";
import { writeFixtureFile } from "../helpers";
import type { LoadedWorkspace } from "../../src/core/types";

/**
 * The permanent Golden Dataset (Phase 7 spec, section "Golden Dataset"):
 * a small, deterministic, known-shape evidence set that every future release
 * validates against. "Permanent" means this builder — not a materialized
 * binary fixture directory — lives in git; it produces byte-identical output
 * every run, which is what makes the expectations below meaningful as a
 * regression baseline rather than a moving target. A hand-crafted fixture
 * with known relationships is not "fabricated evidence" in the sense Phase 7
 * forbids — that principle is about not inventing facts about *real brand
 * data* (Instagram, Printful); a deliberately-constructed regression fixture
 * with honestly-labeled synthetic content is how every phase's test suite
 * already works (see tests/helpers.ts).
 *
 * Deliberately includes: a source->export pair (relationship detection), an
 * exact-duplicate pair (duplicate detection), and a minimal real PDF (real
 * metadata extraction, not a text file wearing a .pdf extension).
 */

// A minimal, syntactically valid single-page PDF — real bytes for pdf-parse
// to actually walk, not a renamed text file.
const MINIMAL_PDF = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<<>>>>endobj",
    "trailer<</Size 4/Root 1 0 R>>",
    "%%EOF",
    "",
  ].join("\n"),
  "utf-8"
);

export interface GoldenDatasetExpectations {
  totalFiles: number;
  totalAssets: number;
  sourceToExportRelationships: number;
  duplicateGroups: number;
  duplicateAssetsInGroup: number;
}

export const GOLDEN_EXPECTATIONS: GoldenDatasetExpectations = {
  totalFiles: 5,
  totalAssets: 5,
  sourceToExportRelationships: 1,
  duplicateGroups: 1,
  duplicateAssetsInGroup: 2,
};

/** Populates an already-created LoadedWorkspace's rootDir with the golden dataset's fixed file set. */
export function buildGoldenDataset(workspace: LoadedWorkspace): void {
  // Source -> Export pair: same directory, matching stem, source+export extensions.
  writeFixtureFile(workspace, path.join("Logos", "GoldenLogo.psd"), "GOLDEN-DATASET-SOURCE-PSD-V1");
  writeFixtureFile(workspace, path.join("Logos", "GoldenLogo.png"), "GOLDEN-DATASET-EXPORT-PNG-V1");

  // Exact-duplicate pair: identical bytes, different filenames/locations.
  writeFixtureFile(workspace, path.join("Photos", "ProductShotA.jpg"), "GOLDEN-DATASET-DUPLICATE-CONTENT-V1");
  writeFixtureFile(workspace, path.join("Photos", "Reupload", "ProductShotB.jpg"), "GOLDEN-DATASET-DUPLICATE-CONTENT-V1");

  // A real, minimal, valid PDF for genuine metadata extraction.
  writeFixtureFile(workspace, path.join("Docs", "Invoice.pdf"), MINIMAL_PDF);
}
