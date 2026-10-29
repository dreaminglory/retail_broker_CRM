/**
 * Client-safe helpers for failed Server Action results.
 */

import type { ActionResult } from './actions';

/**
 * The message to show for a failed action: the first field's own validation
 * message when there is one (dialogs that don't mark fields), else the error.
 */
export function actionErrorMessage(result: Extract<ActionResult<unknown>, { success: false }>): string {
  return Object.values(result.fieldErrors ?? {}).flat()[0] ?? result.error;
}
