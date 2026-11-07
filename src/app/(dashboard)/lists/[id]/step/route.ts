import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext, type AuthContext } from "@/lib/actions";
import { SmartListService } from "@/domain/smart-lists/service";
import { parseQueueStep, queueDealHref } from "@/domain/smart-lists/queue";

/**
 * One step of Work through (spec rule 7): re-runs the list at the moment of the click and
 * redirects to the deal it lands on, or to the list page's "List done" state. Reads only.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/lists/[id]/step">) {
  const { id } = await ctx.params;
  const url = new URL(request.url);

  let auth: AuthContext;
  try {
    auth = await getAuthContext();
  } catch {
    return NextResponse.redirect(new URL("/login", url));
  }

  const input = parseQueueStep(Object.fromEntries(url.searchParams));
  let step: Awaited<ReturnType<SmartListService["step"]>>;
  try {
    step = await new SmartListService(auth.supabase).step(auth, id, input.scope, input);
  } catch (error) {
    // The list page shows the list (or its own error) rather than a bare 500 with the detail.
    console.error("Smart list step failed:", error);
    const scope = input.scope === "agency" ? "?scope=agency" : "";
    return NextResponse.redirect(new URL(`/lists/${encodeURIComponent(id)}${scope}`, url));
  }

  // A list the viewer can't open, or one without a queue, goes back to the lists.
  if (!step) return NextResponse.redirect(new URL("/lists", url));

  const scope = step.scope === "agency" ? "&scope=agency" : "";
  if (step.done) return NextResponse.redirect(new URL(`/lists/${encodeURIComponent(id)}?done=1${scope}`, url));

  return NextResponse.redirect(
    new URL(
      queueDealHref({ listId: id, dealId: step.id, sortKey: step.sortKey, pos: step.pos, total: step.total, scope: step.scope }),
      url
    )
  );
}
