import { ProjectVersion } from "../types";

/**
 * Default category for projects without categories
 */
export const DEFAULT_CATEGORY = "Main Plans";

/**
 * Predefined common categories for construction projects
 */
export const COMMON_CATEGORIES = [
  "Structural",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Architectural",
  "Site Plan",
  "Foundation",
  "Framing",
  "Interior",
  "Exterior",
];

/**
 * Get all unique categories from project versions
 */
export function getCategories(versions: ProjectVersion[]): string[] {
  const categories = new Set(
    versions.map((v) => v.category || DEFAULT_CATEGORY),
  );
  return Array.from(categories).sort();
}

/**
 * Get versions filtered by category
 */
export function getVersionsByCategory(
  versions: ProjectVersion[],
  category: string,
): ProjectVersion[] {
  return versions
    .filter((v) => (v.category || DEFAULT_CATEGORY) === category)
    .sort((a, b) => b.categoryVersionNumber - a.categoryVersionNumber);
}

/**
 * Get the next version number for a category
 */
export function getNextCategoryVersion(
  versions: ProjectVersion[],
  category: string,
): number {
  const categoryVersions = getVersionsByCategory(versions, category);
  if (categoryVersions.length === 0) return 1;

  const maxVersion = Math.max(
    ...categoryVersions.map((v) => v.categoryVersionNumber),
  );
  return maxVersion + 1;
}

/**
 * Get the latest version for a category
 */
export function getLatestVersionForCategory(
  versions: ProjectVersion[],
  category: string,
): ProjectVersion | null {
  const categoryVersions = getVersionsByCategory(versions, category);
  return categoryVersions.length > 0 ? categoryVersions[0] : null;
}

/**
 * Get version count per category
 */
export function getCategoryCounts(
  versions: ProjectVersion[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  versions.forEach((v) => {
    const cat = v.category || DEFAULT_CATEGORY;
    counts[cat] = (counts[cat] || 0) + 1;
  });

  return counts;
}

/**
 * Migrate old versions to have category fields
 */
export function migrateVersionsToCategories(
  versions: ProjectVersion[],
): ProjectVersion[] {
  return versions.map((v, index) => {
    if (!v.category) {
      return {
        ...v,
        category: DEFAULT_CATEGORY,
        categoryVersionNumber: v.versionNumber,
      };
    }
    return v;
  });
}
