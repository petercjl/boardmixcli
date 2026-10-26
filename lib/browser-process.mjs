import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const profile = path.join(os.homedir(), '.dianshang-chrome-profile');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdp = 'http://127.0.0.1:9223';
function fail(code, message) { return Object.assign(new Error(message), { code }); }

export function matchesProcess(command, expectedProfile = profile) {
  return command.startsWith(`${chrome} `)
    && /(?:^|\s)--remote-debugging-port=9223(?:\s|$)/.test(command)
    && (command.includes(`--user-data-dir=${expectedProfile} `) || command.endsWith(`--user-data-dir=${expectedProfile}`))
    && !command.includes('--no-sandbox');
}

export async function status() {
  if (process.platform !== 'darwin') throw fail('UNSUPPORTED_PLATFORM', '此安装版只支持 macOS');
  let listeners;
  try { listeners = (await exec('/usr/sbin/lsof', ['-b', '-nP', '-t', '-iTCP:9223', '-sTCP:LISTEN'], { timeout: 5000 })).stdout.trim(); }
  catch (error) { if (error.code === 1 && !error.stderr) listeners = ''; else throw error; }
  if (!listeners) return { ok: false, state: 'stopped', cdp, profile };
  const pids = [...new Set(listeners.split(/\s+/))];
  for (const pid of pids) {
    const command = (await exec('/bin/ps', ['-p', pid, '-o', 'command='])).stdout.trim();
    if (!matchesProcess(command)) throw fail('PORT_CONFLICT', '9223 端口不是指定的安全电商浏览器；未停止或修改任何进程');
  }
  try {
    const response = await fetch(`${cdp}/json/version`, { signal: AbortSignal.timeout(1500), redirect: 'error' });
    const value = await response.json();
    if (!response.ok || !value.Browser?.includes('Chrome/') || !value.webSocketDebuggerUrl) throw new Error('CDP 无效');
    return { ok: true, state: 'ready', cdp, profile, pids, browser: value.Browser };
  } catch { return { ok: false, state: 'starting', cdp, profile, pids }; }
}

export async function open(url, deps = {status, access:fs.access, mkdir:fs.mkdir, spawn, fetch, pause:ms=>new Promise(r=>setTimeout(r,ms))}) {
  let current = await deps.status();
  const started = current.state === 'stopped';
  if (started) {
    await deps.access(chrome);
    await deps.mkdir(profile, { recursive: true, mode: 0o700 });
    const child = deps.spawn(chrome, ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9223', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { detached: true, stdio: 'ignore' });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
  }
  const deadline = Date.now() + 15000;
  while (!current.ok && Date.now() < deadline) {
    await deps.pause(300);
    current = await deps.status();
  }
  if (!current.ok) throw fail('NOT_READY', '浏览器尚未就绪；未清理资料、锁文件或终止其他浏览器');
  if (url) {
    const response = await deps.fetch(`${cdp}/json/new?${encodeURIComponent(url)}`, { method: 'PUT', signal: AbortSignal.timeout(3000), redirect: 'error' });
    if (!response.ok) throw fail('TAB_OPEN_FAILED', `浏览器已就绪，打开页面失败 HTTP ${response.status}`);
  }
  return { ...current, started };
}

