import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const PID_DIR = path.join(os.homedir(), '.tokenburn')
const PID_FILE = path.join(PID_DIR, 'proxy.pid')
const LOG_FILE = path.join(PID_DIR, 'proxy.log')

export function daemonStart(scriptPath: string, port: number): void {
  if (isDaemonRunning()) {
    console.log(`Proxy already running (PID ${readPid()})`)
    return
  }
  if (!fs.existsSync(PID_DIR)) fs.mkdirSync(PID_DIR, { recursive: true })
  const logFd = fs.openSync(LOG_FILE, 'a')
  const child = spawn(process.execPath, [scriptPath, '--daemon-child', '--port', String(port)], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, TOKENBURN_DAEMON: '1' },
  })
  child.unref()
  fs.writeFileSync(PID_FILE, String(child.pid))
  fs.closeSync(logFd)
  console.log(`Proxy started in background (PID ${child.pid}, port ${port})`)
  console.log(`Logs: ${LOG_FILE}`)
}

export function daemonStop(): void {
  const pid = readPid()
  if (!pid) { console.log('No running proxy found'); return }
  try {
    process.kill(pid, 'SIGTERM')
    fs.unlinkSync(PID_FILE)
    console.log(`Proxy stopped (PID ${pid})`)
  } catch {
    fs.unlinkSync(PID_FILE)
    console.log('Proxy was not running, cleaned up stale PID file')
  }
}

export function isDaemonRunning(): boolean {
  const pid = readPid()
  if (!pid) return false
  try { process.kill(pid, 0); return true }
  catch { try { fs.unlinkSync(PID_FILE) } catch {}; return false }
}

function readPid(): number | null {
  try {
    const content = fs.readFileSync(PID_FILE, 'utf8').trim()
    const pid = parseInt(content, 10)
    return isNaN(pid) ? null : pid
  } catch { return null }
}

export function getDaemonStatus(): { running: boolean; pid: number | null; logFile: string } {
  const pid = readPid()
  return { running: isDaemonRunning(), pid, logFile: LOG_FILE }
}
