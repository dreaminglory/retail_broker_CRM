import { describe, expect, it, vi } from 'vitest';
import { runCommitBatches, type CommitBatchResult } from './commit-loop';

const batches = (...results: CommitBatchResult[]) => {
  const commit = vi.fn<() => Promise<CommitBatchResult>>();
  results.forEach((r) => commit.mockResolvedValueOnce(r));
  return commit;
};

describe('runCommitBatches', () => {
  it('commits batch after batch until nothing remains', async () => {
    const commit = batches(
      { success: true, data: { processed: 200, remaining: 100 } },
      { success: true, data: { processed: 100, remaining: 0 } }
    );
    const onProgress = vi.fn();

    expect(await runCommitBatches(commit, 300, onProgress)).toEqual({ done: true });
    expect(commit).toHaveBeenCalledTimes(2);
    expect(onProgress.mock.calls).toEqual([[200, 100], [100, 0]]);
  });

  it('stops and is not done when a batch fails, keeping its error', async () => {
    const commit = batches(
      { success: true, data: { processed: 200, remaining: 100 } },
      { success: false, error: 'Timed out' }
    );

    expect(await runCommitBatches(commit, 300, vi.fn())).toEqual({ done: false, error: 'Timed out' });
  });

  it('stops when a batch makes no progress, instead of calling forever', async () => {
    const commit = batches({ success: true, data: { processed: 0, remaining: 50 } });

    expect(await runCommitBatches(commit, 50, vi.fn())).toEqual({ done: false, error: null });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('is not done when a batch throws', async () => {
    const commit = vi.fn<() => Promise<CommitBatchResult>>().mockRejectedValue(new Error('offline'));

    expect(await runCommitBatches(commit, 10, vi.fn())).toEqual({ done: false, error: 'offline' });
  });

  it('is done at once when nothing is left to commit', async () => {
    const commit = batches();

    expect(await runCommitBatches(commit, 0, vi.fn())).toEqual({ done: true });
    expect(commit).not.toHaveBeenCalled();
  });
});
