// lib/registry.js
// ---------------------------------------------------------------------------
// All the Windows Explorer right-click logic lives in this one module.
//
// Windows stores right-click menu items in the *registry* (its settings
// database). We add two small entries under the current user's part of the
// registry, which needs NO admin rights. When you uninstall the plugin we
// delete them again.
//
// Design note: we keep the pure "build a command string" helpers separate
// from the side effects (running reg.exe). Pure functions are easy to test
// and easy to reason about — that separation is the thing that makes this
// file teachable and safe.
// ---------------------------------------------------------------------------

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

// `execFile` runs an external program. Its callback style is:
//   execFile('reg', [...args], (err, stdout) => {...})
// `promisify` wraps it so we can write `await execFileAsync(...)` instead.
const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Only Windows has a registry. Everything in this file is Windows-only, so
// we expose a guard the rest of the code can check.
export const IS_WIN32 = process.platform === 'win32'

// The registry hive. `HKCU\Software\Classes` is the per-user "file type
// association" area — the same place Explorer reads for context menus.
// Writing here needs no elevation.
const CLASSES_ROOT = 'HKCU\\Software\\Classes'

// All our menu items share one id. Uninstall can then delete that id's whole
// subtree in one shot.
const MENU_ID = 'dsh-open-here'

// The text shown in the right-click menu.
export const MENU_LABEL = 'Open DeepSeek Harness here'

// The dsh mode to boot when the menu item is clicked ("web" = browser UI).
export const LAUNCH_MODE = 'web'

// Where a right-click menu item can live, and which variable Explorer fills
// with the path you clicked.
//   - Directory\Background\shell → right-click the empty area inside a folder
//     (%V = that folder's path)
//   - Directory\shell             → right-click a folder's icon
//     (%1 = that folder's path)
export const TARGETS = [
  { key: `${CLASSES_ROOT}\\Directory\\Background\\shell\\${MENU_ID}`, folderVar: '%V' },
  { key: `${CLASSES_ROOT}\\Directory\\shell\\${MENU_ID}`, folderVar: '%1' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// reg.exe always lives at <SystemRoot>\System32\reg.exe. Using the full path
// avoids any PATH surprises.
function regExe() {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  return path.join(systemRoot, 'System32', 'reg.exe')
}

// Runs one reg.exe command. Rejects (throws inside async/await) if it fails.
async function runReg(args) {
  await execFileAsync(regExe(), args)
}

// The command string that Explorer runs when the menu item is clicked.
//   `cmd /k`            → KEEP this console window open (don't close it)
//   `cd /d "..."`       → switch to the clicked folder
//   `&&`                → then run dsh in the SAME window, in the foreground
//
// Because dsh runs in the foreground of a persistent window, that window IS
// the server: you watch its logs there, and you stop dsh by pressing Ctrl+C
// or closing the window. (The browser is only a client — closing it does NOT
// stop the server.)
//
// PURE function: given inputs, it always returns the same string. It touches
// no files, no registry, no network — which is why it can be unit-tested.
export function buildShellCommand({ nodePath, dshCliPath, folderVar, mode = LAUNCH_MODE }) {
  return `cmd /k cd /d "${folderVar}" && "${nodePath}" "${dshCliPath}" ${mode}`
}

// ---------------------------------------------------------------------------
// Public API — used by lib/index.js (the plugin) and bin/ (the CLI)
// ---------------------------------------------------------------------------

// Adds the right-click menu items.
export async function install({ nodePath, dshCliPath, mode = LAUNCH_MODE }) {
  if (!IS_WIN32) {
    throw new Error(`This plugin only works on Windows (this machine runs ${process.platform})`)
  }
  for (const { key, folderVar } of TARGETS) {
    const command = buildShellCommand({ nodePath, dshCliPath, folderVar, mode })
    // 1) The menu item itself. `/ve` sets its *default value* (the unnamed
    //    value), and `/d` gives it the data — here, the label Explorer shows.
    await runReg(['add', key, '/ve', '/d', MENU_LABEL, '/f'])
    // 2) A child key named `command` holds what to actually execute.
    await runReg(['add', `${key}\\command`, '/ve', '/d', command, '/f'])
  }
}

// Removes the right-click menu items (deletes the whole subtree per target).
export async function uninstall() {
  if (!IS_WIN32) {
    throw new Error(`This plugin only works on Windows (this machine runs ${process.platform})`)
  }
  for (const { key } of TARGETS) {
    await runReg(['delete', key, '/f'])
  }
}

// Checks which menu items currently exist. reg.exe exits non-zero when a key
// is missing, which makes the promise reject — so we catch it and report
// "missing". Never throws.
export async function status() {
  const rows = []
  for (const { key } of TARGETS) {
    let installed = true
    try {
      await runReg(['query', key])
    } catch {
      installed = false
    }
    rows.push({ key, installed })
  }
  return rows
}
