import { spawn } from 'node:child_process';

/** No shell, bounded output, and a hard kill deadline for hostile/corrupt media. */
export function runMediaCommand(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let failure: Error | undefined;
    const timer = setTimeout(() => {
      failure = new Error('Media command timed out');
      child.kill('SIGKILL');
    }, timeoutMs);
    timer.unref();
    const collect = (chunks: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 2_000_000) {
        failure = new Error('Media command output limit exceeded');
        child.kill('SIGKILL');
      } else chunks.push(chunk);
    };
    child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          new Error(
            `Media command exited ${code}: ${Buffer.concat(stderr).toString('utf8').slice(-1000)}`,
          ),
        );
      else resolve(Buffer.concat(stdout).toString('utf8'));
    });
  });
}
