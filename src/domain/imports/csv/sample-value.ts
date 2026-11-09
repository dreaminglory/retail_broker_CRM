/** The first non-blank value of a column in the file's sample rows, for the mapping step. */
export function sampleValue(headers: string[], sampleRows: string[][], header: string | null): string | null {
  if (!header) return null;
  const index = headers.indexOf(header);
  if (index < 0) return null;
  for (const row of sampleRows) {
    const value = row[index]?.trim();
    if (value) return value;
  }
  return null;
}
