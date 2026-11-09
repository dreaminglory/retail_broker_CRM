// The wizard's commit loop: one batch RPC call after another until nothing remains (AD-034).
// It says whether the import finished, so the wizard never shows "complete" for a job that is
// still `committing`; a stopped loop can be run again, and the RPC carries on from there.

export type CommitBatchResult =
  | { success: true; data: { processed: number; remaining: number } | null | undefined }
  | { success: false; error: string };

export type CommitLoopOutcome = { done: true } | { done: false; error: string | null };

export async function runCommitBatches(
  commitBatch: () => Promise<CommitBatchResult>,
  remaining: number,
  onProgress: (processed: number, remaining: number) => void
): Promise<CommitLoopOutcome> {
  let left = remaining;
  while (left > 0) {
    let res: CommitBatchResult;
    try {
      res = await commitBatch();
    } catch (error) {
      return { done: false, error: error instanceof Error ? error.message : null };
    }
    if (!res.success) return { done: false, error: res.error };
    if (!res.data) return { done: false, error: null };

    onProgress(res.data.processed, res.data.remaining);
    // Rows locked by another commit of the same job: stop rather than call in a tight loop.
    if (res.data.processed === 0 && res.data.remaining > 0) return { done: false, error: null };
    left = res.data.remaining;
  }
  return { done: true };
}
