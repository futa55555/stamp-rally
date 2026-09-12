import { execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';

// Expo forwards Metro's port itself. These are the local API and invitation Web.
const ports = [3000, 5173];

/** @param {Record<string, string | undefined>} environment */
export function watchAndroidPorts(environment = process.env) {
  const sdk = environment.ANDROID_HOME || environment.ANDROID_SDK_ROOT;
  const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const adb = sdk ? join(sdk, 'platform-tools', adbName) : adbName;
  const options = {
    env: environment,
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  let stopped = false;
  let tracker;
  let retry;
  let lastError;

  function report(error) {
    const message = error.message;
    if (message !== lastError) {
      console.warn('[Android local ports] ' + message);
      lastError = message;
    }
  }

  function forward() {
    if (stopped) return;
    try {
      const devices = execFileSync(adb, ['devices'], options);
      for (const line of devices.split('\n')) {
        const serial = line.match(/^(\S+)\s+device\s*$/)?.[1];
        if (
          !serial ||
          (environment.ANDROID_SERIAL && environment.ANDROID_SERIAL !== serial)
        )
          continue;
        for (const port of ports)
          execFileSync(
            adb,
            ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`],
            options,
          );
      }
      lastError = undefined;
    } catch (error) {
      report(error);
    }
  }

  function watch() {
    if (stopped) return;
    let unavailable = false;
    tracker = spawn(adb, ['track-devices'], {
      env: environment,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    // A notification may arrive in chunks; re-reading the current device list
    // also handles a disconnect/reconnect with the same serial number.
    tracker.stdout.on('data', forward);
    tracker.on('error', (error) => {
      unavailable = error.code === 'ENOENT';
      report(error);
    });
    tracker.on('close', () => {
      if (!stopped && !unavailable) retry = setTimeout(watch, 1000);
    });
  }

  watch();
  return () => {
    stopped = true;
    clearTimeout(retry);
    tracker?.kill();
  };
}
