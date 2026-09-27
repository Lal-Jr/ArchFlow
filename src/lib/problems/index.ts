import { CLASSIC } from "./classic";
import { DATA_INFRA } from "./data-infra";
import { SEARCH_COMMERCE } from "./search-commerce";
import { STORAGE_SOCIAL } from "./storage-social";
import type { Problem, ProblemCategory } from "./types";

export * from "./types";

export const PROBLEMS: Problem[] = [...CLASSIC, ...STORAGE_SOCIAL, ...SEARCH_COMMERCE, ...DATA_INFRA];

export function getProblem(slug: string) {
  return PROBLEMS.find((p) => p.slug === slug);
}

export const CATEGORIES: ProblemCategory[] = [...new Set(PROBLEMS.map((p) => p.category))];
export const COMPANIES: string[] = [...new Set(PROBLEMS.flatMap((p) => p.askedAt))].sort();
