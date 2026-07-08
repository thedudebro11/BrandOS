import type { DiscoveredFile } from "../../types";

export interface ClassificationInput {
  file: Pick<DiscoveredFile, "relPath" | "filename" | "extension">;
  hasExportRelationship: boolean; // true if a source_to_export relationship already names this asset as the "to" side
}

export interface ClassificationRuleResult {
  category: string;
  confidence: number;
  ruleId: string;
  reason: string;
}

const SOURCE_EXTS = new Set(["psd", "xcf", "ai"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "svg"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "mkv", "avi", "webm", "m4v"]);
const DOC_EXTS = new Set(["txt", "rtf", "md", "markdown"]);

function pathContains(relPath: string, keyword: string): boolean {
  return relPath.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * Deterministic, rule-based classification — no AI (explicitly excluded from
 * Phase 3). Rules are evaluated in order; the first match wins. Path-keyword
 * rules run before generic extension rules because folder context is a
 * stronger, more specific signal than file type alone. Confidence reflects
 * how strong the matching signal actually is (ARCHITECTURE_PRINCIPLES.md #4)
 * — a binary file-format match scores higher than a folder-name keyword
 * guess. Anything under 70 is routed to Needs Review by the caller
 * (see knowledge-repositories.ts upsertClassification).
 */
export function classifyFile(input: ClassificationInput): ClassificationRuleResult {
  const { file } = input;
  const ext = file.extension.toLowerCase();
  const path = file.relPath;

  // --- Strong path-context signals ---
  if (pathContains(path, "instagram")) {
    return {
      category: "Marketing Evidence",
      confidence: 90,
      ruleId: "path-instagram",
      reason: `Path contains "instagram": ${path}`,
    };
  }
  if (pathContains(path, "printful") || pathContains(path, "printiful")) {
    return {
      category: "Commerce Evidence",
      confidence: 90,
      ruleId: "path-printful",
      reason: `Path references Printful order/invoice content: ${path}`,
    };
  }
  if (pathContains(path, "proof")) {
    return {
      category: "Commerce Evidence",
      confidence: 85,
      ruleId: "path-proof",
      reason: `Path contains "proof" (product/print proof): ${path}`,
    };
  }
  if (pathContains(path, "invoice") || pathContains(path, "receipt")) {
    return {
      category: "Commerce Evidence",
      confidence: 90,
      ruleId: "path-invoice",
      reason: `Path contains invoice/receipt keyword: ${path}`,
    };
  }
  if (pathContains(path, "customer")) {
    return {
      category: "Marketplace Evidence",
      confidence: 85,
      ruleId: "path-customer",
      reason: `Path contains "customer": ${path}`,
    };
  }
  if (pathContains(path, "legal") || pathContains(path, "trademark") || pathContains(path, "copyright")) {
    return {
      category: "Legal Documentation",
      confidence: 90,
      ruleId: "path-legal",
      reason: `Path contains a legal/trademark/copyright keyword: ${path}`,
    };
  }
  // Known product structure: a workspace's clothing/product promo tree
  // (e.g. "Fatletic Offical Logo Clothing Promo/<Product Name>/photo.jpg")
  // is a strong, real folder-structure signal — an image nested under such a
  // folder is almost certainly a product photo, even with no other keyword.
  if (IMAGE_EXTS.has(ext) && /clothing.?promo|product.?promo|promo.?clothing|product.?mockup/i.test(path)) {
    return {
      category: "Product Photo",
      confidence: 82,
      ruleId: "path-product-structure",
      reason: `Path matches a known product-promo folder structure: ${path}`,
    };
  }

  // --- File-format signals (strong: read from the file's own type) ---
  if (SOURCE_EXTS.has(ext)) {
    return {
      category: "Design Source",
      confidence: 95,
      ruleId: "ext-source",
      reason: `File extension .${ext} is a design source format (PSD/XCF/AI)`,
    };
  }
  if (ext === "pdf") {
    return {
      category: "Documentation",
      confidence: 80,
      ruleId: "ext-pdf",
      reason: `File extension .pdf, no stronger path signal found`,
    };
  }
  if (VIDEO_EXTS.has(ext)) {
    return {
      category: "Historical Evidence",
      confidence: 75,
      ruleId: "ext-video",
      reason: `File extension .${ext} is a video format`,
    };
  }
  if (IMAGE_EXTS.has(ext)) {
    if (input.hasExportRelationship) {
      return {
        category: "Export",
        confidence: 90,
        ruleId: "ext-image-export",
        reason: `Image with a detected source_to_export relationship (has a matching-stem design source file)`,
      };
    }
    return {
      category: "Image",
      confidence: 65,
      ruleId: "ext-image-generic",
      reason: `Image file with no source-file relationship and no path context — ambiguous (could be a photo, export, or screenshot)`,
    };
  }
  if (ext === "json") {
    return { category: "Data", confidence: 90, ruleId: "ext-json", reason: "File extension .json" };
  }
  if (DOC_EXTS.has(ext)) {
    return { category: "Documentation", confidence: 80, ruleId: "ext-doc", reason: `File extension .${ext}` };
  }

  return {
    category: "Unknown",
    confidence: 0,
    ruleId: "fallback-unknown",
    reason: `No rule matched extension ".${ext}" or path "${path}"`,
  };
}

/**
 * Deterministic "neighboring assets" signal (Phase 3.5 System 6): when the
 * base rule result is the generic, low-confidence "Image" fallback, a strong
 * majority of already-classified siblings in the same immediate folder
 * sharing one specific category is real evidence — not a guess, an
 * observation about the folder's actual contents. Only ever applied to the
 * generic fallback case; never overrides a confident, specific match.
 */
export function applySiblingContextBoost(
  base: ClassificationRuleResult,
  siblingCategories: string[]
): ClassificationRuleResult {
  if (base.ruleId !== "ext-image-generic" || siblingCategories.length < 3) return base;

  const counts = new Map<string, number>();
  for (const c of siblingCategories) counts.set(c, (counts.get(c) ?? 0) + 1);
  const [topCategory, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const majorityRatio = topCount / siblingCategories.length;

  if (topCategory === "Unknown" || topCategory === "Image" || majorityRatio < 0.6) return base;

  return {
    category: topCategory,
    confidence: 72,
    ruleId: "sibling-majority-boost",
    reason: `Base rule was the generic Image fallback (confidence 65). ${topCount} of ${siblingCategories.length} sibling assets in the same folder are classified "${topCategory}" (${Math.round(
      majorityRatio * 100
    )}%) — folder-context evidence, not a guess about this file's own content.`,
  };
}
