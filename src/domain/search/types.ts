export type SearchEntityType = 'contact' | 'opportunity' | 'inquiry';

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle: string | null;
  url: string;
  relevance: number;
}
