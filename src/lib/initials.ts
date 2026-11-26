/** Up to two initials from a name or an email ("Мария Колева" → "МК"). */
export function initials(name: string): string {
  const words = name.split(/[\s@._-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase())
    .join("");
}
