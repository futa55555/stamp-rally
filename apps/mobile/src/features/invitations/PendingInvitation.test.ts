import { describe, expect, it, vi } from 'vitest';
import { PendingInvitation } from './PendingInvitation';

const token = 'a'.repeat(43);
function storage() {
  let value: string | null = null;
  return {
    get: vi.fn(async () => value),
    set: vi.fn(async (next: string) => {
      value = next;
    }),
    clear: vi.fn(async () => {
      value = null;
    }),
  };
}
describe('Pending invitation through authentication', () => {
  it('restores the invitation after process restart without submitting it', async () => {
    const disk = storage();
    const before = new PendingInvitation(disk);
    await before.capture(token);
    const after = new PendingInvitation(disk);
    await after.restore();
    expect(after.snapshot()).toEqual({ ready: true, token, error: null });
  });
  it('never resurrects an invitation when an old restore completes after cancellation', async () => {
    const disk = storage();
    let finish!: (value: string) => void;
    disk.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = new PendingInvitation(disk);
    const restoring = pending.restore();
    await Promise.resolve();
    await pending.clear();
    finish(JSON.stringify({ token, expiresAt: Date.now() + 60000 }));
    await restoring;
    expect(pending.snapshot().token).toBeNull();
  });
  it('serializes capture and logout, so the next launch has no pending invitation', async () => {
    const disk = storage();
    const pending = new PendingInvitation(disk);
    await Promise.all([pending.capture(token), pending.clear()]);
    const next = new PendingInvitation(disk);
    await next.restore();
    expect(next.snapshot().token).toBeNull();
    expect(disk.set).toHaveBeenCalledOnce();
    expect(disk.clear).toHaveBeenCalledOnce();
  });
  it('uses the newest incoming link and discards invalid/expired saved tokens', async () => {
    const disk = storage();
    const pending = new PendingInvitation(disk);
    const next = 'b'.repeat(43);
    await Promise.all([pending.capture(token), pending.capture(next)]);
    await pending.capture('invalid');
    const restarted = new PendingInvitation(disk);
    await restarted.restore();
    expect(restarted.snapshot().token).toBe(next);
    await disk.set(JSON.stringify({ token, expiresAt: Date.now() - 1 }));
    await restarted.restore();
    expect(restarted.snapshot().token).toBeNull();
    expect(await disk.get()).toBeNull();
  });
  it('keeps the current invite usable and reports persistence failure', async () => {
    const disk = storage();
    disk.set.mockRejectedValueOnce(new Error('storage unavailable'));
    const pending = new PendingInvitation(disk);
    await expect(pending.capture(token)).rejects.toThrow('storage unavailable');
    expect(pending.snapshot().token).toBe(token);
    expect(pending.snapshot().error).toBeTruthy();
  });
});
