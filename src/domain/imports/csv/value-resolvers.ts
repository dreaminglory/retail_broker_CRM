export function resolveSource(
  value: string | null | undefined,
  sources: { id: string; name: string }[],
  defaultSourceId: string | null = null
): string | null {
  if (!value || !value.trim()) return defaultSourceId;
  const normalized = value.trim().toLowerCase();
  
  const match = sources.find(s => s.name.toLowerCase() === normalized);
  if (match) return match.id;

  const removeDiacritics = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const matchNoDiacritics = sources.find(s => removeDiacritics(s.name.toLowerCase()) === removeDiacritics(normalized));
  if (matchNoDiacritics) return matchNoDiacritics.id;
  
  return defaultSourceId;
}

export function resolveAssignee(
  value: string | null | undefined,
  members: { user_id: string; email?: string | null; display_name?: string | null }[],
  defaultAssigneeId: string | null = null
): string | null {
  if (!value || !value.trim()) return defaultAssigneeId;
  const normalized = value.trim().toLowerCase();

  const match = members.find(m => 
    (m.email && m.email.toLowerCase() === normalized) ||
    (m.display_name && m.display_name.toLowerCase() === normalized)
  );

  if (match) return match.user_id;
  return defaultAssigneeId;
}

export function resolveStatus(
  value: string | null | undefined,
  defaultStatus: string = "new"
): string {
  if (!value || !value.trim()) return defaultStatus;
  const normalized = value.trim().toLowerCase();

  if (["new", "нов", "ново", "нова"].includes(normalized)) return "new";
  if (["contacted", "контактуван", "свързан", "в комуникация"].includes(normalized)) return "contacted";
  if (["dismissed", "отхвърлен", "отказан", "затворен"].includes(normalized)) return "dismissed";

  return defaultStatus;
}
