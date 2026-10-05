export function isSafeRelativePath(path: string | null | undefined): boolean {
  if (!path || typeof path !== 'string') return false;
  // Must start with a single slash, not two slashes (protocol-relative), not slash-backslash
  if (path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')) {
    return true;
  }
  return false;
}
