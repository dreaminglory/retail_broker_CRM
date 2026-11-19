"use server";

/**
 * Call log Server Actions (spec phone-loop rules 2 and 6, AD-065): the post-call prompt and
 * "Log call" save through `logCallAction`; the prompt asks `findCallTaskAction` which pending
 * call it would complete. No phone number reaches these actions or their logs (rule 12).
 */

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { CallService } from '@/domain/calls/service';
import { callContextSchema, logCallSchema } from '@/domain/calls/validation';
import { CALL_CHANNELS, type CallContext, type CallChannel, type CompletableTask, type LogCallInput } from '@/domain/calls/types';
import { getAgencySettings } from '@/domain/agencies/settings';
import { getAuthContext, toActionError, type ActionResult, type AuthContext } from '@/lib/actions';
import { DomainError } from '@/lib/errors';

async function callServiceFor(ctx: AuthContext) {
  const { timezone } = await getAgencySettings(ctx.agencyId);
  return { service: new CallService(ctx.supabase, { timezone }), timezone };
}

function revalidateContext(scope: { opportunity_id?: string | null; contact_id?: string | null; inquiry_id?: string | null }) {
  revalidatePath('/today');
  if (scope.inquiry_id) revalidatePath('/inquiries');
  if (scope.opportunity_id) revalidatePath(`/opportunities/${scope.opportunity_id}`);
  if (scope.contact_id) revalidatePath(`/contacts/${scope.contact_id}`);
}

/** Logs a call and its optional next action or retry in one save. */
export async function logCallAction(
  input: LogCallInput
): Promise<ActionResult<{ callTaskId: string; nextTaskId?: string }>> {
  try {
    const ctx = await getAuthContext();
    const { service, timezone } = await callServiceFor(ctx);

    const parsed = logCallSchema(timezone).safeParse(input);
    if (!parsed.success) return toActionError(parsed.error);

    // Task titles in the actor's language (rule 6).
    const t = await getTranslations('phoneLoop.titles');
    const name = parsed.data.name;
    const titles = { call: t('call', { name }), followUp: t('followUp', { name }), retry: t('retry', { name }) };

    const { callTask, nextTask } = await service.log(ctx.agencyId, ctx.userId, parsed.data, titles);

    revalidateContext(callTask);
    return { success: true, data: { callTaskId: callTask.id, ...(nextTask && { nextTaskId: nextTask.id }) } };
  } catch (error) { return toActionError(error); }
}

/** The pending call of mine the prompt would complete ("Completes: <task>"), or null. */
export async function findCallTaskAction(
  context: CallContext,
  channel: CallChannel
): Promise<ActionResult<CompletableTask | null>> {
  try {
    const ctx = await getAuthContext();
    if (!CALL_CHANNELS.includes(channel)) throw new DomainError('validation.failed');
    const parsedContext = callContextSchema.safeParse(context);
    if (!parsedContext.success) return toActionError(parsedContext.error);

    const { service } = await callServiceFor(ctx);
    return { success: true, data: await service.findTaskToComplete(ctx.agencyId, ctx.userId, parsedContext.data, channel) };
  } catch (error) { return toActionError(error); }
}
