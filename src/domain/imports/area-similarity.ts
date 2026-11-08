// spec: property-import, rule 3 (A1). A new area from the file that looks like a typo of an
// existing one: the preview warns, the user decides. Never merged automatically.

function normalize(name: string): string {
  return name.toLocaleLowerCase('bg').replace(/\s+/g, ' ').trim();
}

/** Levenshtein distance, stopping early once it is past `max`. */
function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return false;
    previous = current;
  }
  return previous[b.length] <= max;
}

/** Within one edit of each other, or the same once digits and spaces are ignored. */
export function isNearDuplicateArea(a: string, b: string): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  const bare = (s: string) => s.replace(/[\d\s]/g, '');
  if (bare(x) && bare(x) === bare(y)) return true;
  return editDistanceWithin(x, y, 1);
}

/** The first existing area name close to `name`, for the preview's warning. */
export function findSimilarArea(name: string, existing: string[]): string | null {
  return existing.find((candidate) => isNearDuplicateArea(name, candidate)) ?? null;
}
