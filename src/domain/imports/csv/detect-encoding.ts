export type CsvEncoding = 'utf-8' | 'windows-1251';

/**
 * Works out a CSV's encoding from all its bytes. Windows-1251 Cyrillic is almost never valid
 * UTF-8, so a file that decodes strictly is UTF-8 and anything else is treated as windows-1251.
 */
export function detectEncoding(bytes: ArrayBuffer): CsvEncoding {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return 'utf-8';
  } catch {
    return 'windows-1251';
  }
}
