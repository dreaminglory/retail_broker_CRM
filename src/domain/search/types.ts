export type SearchEntityType = 'contact' | 'opportunity' | 'inquiry';

export type SearchResultKind = 'person' | 'organization' | 'buyer' | 'seller' | 'landlord' | 'tenant';

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  /** Null when the record has no name: the UI shows a translated fallback. */
  title: string | null;
  /** Free text from the record, such as an inquiry's subject. */
  subtitle: string | null;
  /** What the record is, translated by the UI as `search.kinds.<kind>`. */
  kind: SearchResultKind | null;
  url: string;
  relevance: number;
}
