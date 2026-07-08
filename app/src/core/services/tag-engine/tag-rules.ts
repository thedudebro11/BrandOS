export interface TagSuggestion {
  tag: string;
  confidence: number;
  reason: string;
}

function pathContainsAny(relPath: string, keywords: string[]): string | null {
  const lower = relPath.toLowerCase();
  for (const k of keywords) if (lower.includes(k)) return k;
  return null;
}

/**
 * Deterministic tag suggestions from a classification category + path
 * context. No AI. Every suggestion carries a reason so it stays traceable
 * (ARCHITECTURE_PRINCIPLES.md #3) — a tag is never applied without a
 * specific, inspectable justification.
 */
export function suggestTags(relPath: string, category: string): TagSuggestion[] {
  const tags: TagSuggestion[] = [];
  const push = (tag: string, confidence: number, reason: string) => tags.push({ tag, confidence, reason });

  const logoKeyword = pathContainsAny(relPath, ["logo", "mascot", "emblem", "label"]);
  if (logoKeyword) {
    push("Logo", 90, `Path contains "${logoKeyword}"`);
    push("Brand", 90, `Path contains "${logoKeyword}"`);
  }

  const productKeyword = pathContainsAny(relPath, ["product", "mockup", "promo", "clothing"]);
  if (productKeyword) push("Product", 85, `Path contains "${productKeyword}"`);

  switch (category) {
    case "Marketing Evidence":
      push("Marketing", 90, "Classified as Marketing Evidence");
      push("Social", 85, "Classified as Marketing Evidence");
      push("Evidence", 90, "Classified as Marketing Evidence");
      break;
    case "Commerce Evidence": {
      const shipmentKw = pathContainsAny(relPath, ["shipment", "shipping"]);
      if (shipmentKw) push("Shipment", 85, `Path contains "${shipmentKw}"`);
      const invoiceKw = pathContainsAny(relPath, ["invoice"]);
      if (invoiceKw) push("Invoice", 90, `Path contains "${invoiceKw}"`);
      const receiptKw = pathContainsAny(relPath, ["receipt"]);
      if (receiptKw) push("Receipt", 90, `Path contains "${receiptKw}"`);
      push("Evidence", 85, "Classified as Commerce Evidence");
      break;
    }
    case "Marketplace Evidence":
      push("Customer", 85, "Classified as Marketplace Evidence");
      push("Evidence", 85, "Classified as Marketplace Evidence");
      break;
    case "Legal Documentation":
      if (pathContainsAny(relPath, ["trademark"])) push("Trademark", 90, 'Path contains "trademark"');
      if (pathContainsAny(relPath, ["copyright"])) push("Copyright", 90, 'Path contains "copyright"');
      push("Legal", 90, "Classified as Legal Documentation");
      push("Evidence", 85, "Classified as Legal Documentation");
      break;
    case "Historical Evidence":
      push("Historical", 80, "Classified as Historical Evidence");
      push("Evidence", 80, "Classified as Historical Evidence");
      break;
    case "Design Source":
      push("Prototype", 60, "Design source file — status as prototype vs. final is undetermined without further signal");
      break;
    default:
      break;
  }

  if (pathContainsAny(relPath, ["unused", "old", "draft", "wip"])) {
    push("Unused", 75, "Path suggests a discarded/in-progress version");
  }
  const finalKeyword = pathContainsAny(relPath, ["final", "official", "offical"]); // "offical" matches this workspace's real (misspelled) folder naming
  if (finalKeyword) {
    push("Final", 75, `Path contains "${finalKeyword}"`);
  }

  return tags;
}
