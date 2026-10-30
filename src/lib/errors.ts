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

/**
 * A failed RPC as a DomainError: the i18n key it raised on purpose (AD-032), otherwise
 * `errors.saveFailed` with the database message as the log-only detail.
 */
export function rpcFailure(error: { code?: string; message: string }): DomainError {
  return error.code === 'P0001' && error.message.startsWith('errors.')
    ? new DomainError(error.message)
    : new DomainError('errors.saveFailed', error.message);
}