export class DomainError extends Error {
  code: string;
  params?: Record<string, string | number>;

  constructor(code: string, message: string, params?: Record<string, string | number>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.params = params;
  }
}
