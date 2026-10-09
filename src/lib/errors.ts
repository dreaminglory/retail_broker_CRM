/**
 * Shared error classes for domain logic.
 */

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly params?: Record<string, string | number>
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }
}