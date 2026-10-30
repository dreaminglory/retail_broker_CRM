/**
 * Supabase Auth returns English messages. Maps its error codes to keys under
 * `auth.errors` in messages/{bg,en}.json, so the message itself never reaches the UI.
 */
const AUTH_ERROR_KEYS: Record<string, string> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  user_already_exists: 'user_already_exists',
  email_exists: 'user_already_exists',
  weak_password: 'weak_password',
  same_password: 'same_password',
  over_email_send_rate_limit: 'rate_limited',
  over_request_rate_limit: 'rate_limited',
  over_sms_send_rate_limit: 'rate_limited',
  signup_disabled: 'signup_disabled',
};

export function authErrorKey(error: { code?: string }): string {
  return (error.code && AUTH_ERROR_KEYS[error.code]) || 'generic';
}
