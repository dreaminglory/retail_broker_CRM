/**
 * Client-safe helpers for failed Server Action results.
 */

/**
 * The message to show for a failed action: the first field's own validation
 * message when there is one (dialogs that don't mark fields), else the error.
 */
export function actionErrorMessage(result: {
  success: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
}): string {
  return Object.values(result.fieldErrors ?? {}).flat()[0] ?? result.error;
}
