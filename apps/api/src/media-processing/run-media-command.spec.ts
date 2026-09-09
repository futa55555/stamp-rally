import { runMediaCommand } from './run-media-command.js';

describe('media subprocess bounds', () => {
  it('passes arguments literally without shell interpretation', async () => {
    const result = await runMediaCommand(
      process.execPath,
      [
        '-e',
        'process.stdout.write(process.argv[1])',
        '$(echo dangerous); cat /etc/passwd',
      ],
      3000,
    );
    expect(result).toBe('$(echo dangerous); cat /etc/passwd');
  });
  it('kills a stalled subprocess at the deadline', async () => {
    await expect(
      runMediaCommand(
        process.execPath,
        ['-e', 'setInterval(()=>{},1000)'],
        100,
      ),
    ).rejects.toThrow('timed out');
  });
  it('rejects excessive diagnostic output', async () => {
    await expect(
      runMediaCommand(
        process.execPath,
        ['-e', 'process.stdout.write("a".repeat(3000000))'],
        3000,
      ),
    ).rejects.toThrow('output limit');
  });
});
