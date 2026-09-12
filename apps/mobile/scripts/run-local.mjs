import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { watchAndroidPorts } from './android-local-ports.mjs';

const require = createRequire(import.meta.url);
const expoCli = require.resolve('expo/bin/cli');
const environment = { ...process.env, APP_VARIANT: 'local' };
const stopForwarding = watchAndroidPorts(environment);
const expo = spawn(process.execPath, [expoCli, ...process.argv.slice(2)], {
  env: environment,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopForwarding();
    expo.kill(signal);
  });
}
process.on('exit', stopForwarding);
expo.on('error', (error) => {
  stopForwarding();
  console.error(error.message);
  process.exitCode = 1;
});
expo.on('exit', (code, signal) => {
  stopForwarding();
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
