import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { watchAndroidPorts } from './android-local-ports.mjs';

const commands = vi.hoisted(() => ({ exec: vi.fn(), spawn: vi.fn() }));
vi.mock('node:child_process', () => ({
  execFileSync: commands.exec,
  spawn: commands.spawn,
}));
let devices;
let trackers;
let stop;
function createTracker() {
  const tracker = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    kill: vi.fn(),
  });
  trackers.push(tracker);
  return tracker;
}
const forwards = () =>
  commands.exec.mock.calls
    .map(([, args]) => args)
    .filter((args) => args.includes('reverse'));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  devices = 'List of devices attached\n';
  trackers = [];
  commands.spawn.mockReset().mockImplementation(createTracker);
  commands.exec
    .mockReset()
    .mockImplementation((_command, args) =>
      args[0] === 'devices' ? devices : '',
    );
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('forwards API and Web when Android connects after Expo starts, including reconnection', () => {
  stop = watchAndroidPorts({});
  trackers[0].stdout.emit('data', Buffer.from('0000'));
  expect(forwards()).toEqual([]);
  devices += 'emulator-5554\tdevice\n';
  trackers[0].stdout.emit('data', Buffer.from('0015'));
  expect(forwards()).toEqual([
    ['-s', 'emulator-5554', 'reverse', 'tcp:3000', 'tcp:3000'],
    ['-s', 'emulator-5554', 'reverse', 'tcp:5173', 'tcp:5173'],
  ]);
  devices = 'List of devices attached\nemulator-5554\toffline\n';
  trackers[0].stdout.emit('data', Buffer.from('offline'));
  expect(forwards()).toHaveLength(2);
  devices = 'List of devices attached\nemulator-5554\tdevice\n';
  trackers[0].stdout.emit('data', Buffer.from('device'));
  expect(forwards()).toHaveLength(4);
});

it('uses only authorized devices and honors ANDROID_SERIAL', () => {
  stop = watchAndroidPorts({ ANDROID_SERIAL: 'phone' });
  devices += 'emulator-5554\tdevice\nphone\tdevice\nother\tunauthorized\n';
  trackers[0].stdout.emit('data', Buffer.from('devices'));
  expect(forwards()).toEqual([
    ['-s', 'phone', 'reverse', 'tcp:3000', 'tcp:3000'],
    ['-s', 'phone', 'reverse', 'tcp:5173', 'tcp:5173'],
  ]);
});

it('resumes device monitoring after adb exits and cleans up with Expo', () => {
  stop = watchAndroidPorts({});
  trackers[0].emit('close', 1);
  vi.advanceTimersByTime(1000);
  expect(trackers).toHaveLength(2);
  stop();
  expect(trackers[1].kill).toHaveBeenCalled();
  trackers[1].emit('close', 0);
  trackers[1].stdout.emit('data', Buffer.from('devices'));
  vi.advanceTimersByTime(3000);
  expect(trackers).toHaveLength(2);
  expect(commands.exec).not.toHaveBeenCalled();
});

it('does not prevent iOS development when adb is unavailable', () => {
  stop = watchAndroidPorts({});
  trackers[0].emit(
    'error',
    Object.assign(new Error('adb unavailable'), { code: 'ENOENT' }),
  );
  trackers[0].emit('close', -2);
  vi.advanceTimersByTime(3000);
  expect(trackers).toHaveLength(1);
  expect(console.warn).toHaveBeenCalledWith(
    '[Android local ports] adb unavailable',
  );
});
