# dsh-rightclick-open

A [DeepSeek Harness](https://deepseek.com/harness/en/) plugin that adds a
**Windows Explorer right-click** menu item — **"Open DeepSeek Harness here"** —
which boots `dsh` in the folder you right-clicked.

- Zero plugin dependencies: it only uses Node's built-in modules + the dsh host.
- No admin rights needed: the menu lives under your user's registry hive.
- Windows-only; on macOS/Linux it logs a notice and does nothing.

---

## What it does

When installed into a profile and that profile boots, the plugin writes two
Windows registry entries:

| Right-click spot | Explorer variable | Meaning |
|---|---|---|
| empty area inside a folder window | `%V` | that folder's path |
| a folder's icon | `%1` | that folder's path |

Clicking the new menu item opens a **persistent terminal window** that starts
`dsh` (default mode: `web`, the browser UI) **with the clicked folder as the
working directory**. Since *"the invoking directory is the default workspace
root"*, the Web UI opens with that folder as its workspace, and your browser
opens `http://127.0.0.1:3080` automatically.

> **Stopping dsh:** the terminal window is the server. Close it (or press
> `Ctrl+C` inside it) to stop dsh. The browser is only a client — closing the
> tab does **not** stop the server; it will still be running in that window.

## Requirements

- Windows
- Node.js ≥ 20.10
- [DeepSeek Harness](https://deepseek.com/harness/en/) installed:
  `npm install -g @deepseek-ai/dsh`
- An API key configured once (the dsh Web UI will ask on first run).

## Install

Add the plugin to a profile and boot it once:

```bash
# from a local checkout (dev)
dsh plugin --profile web add link:C:/path/to/dsh-rightclick-open

# or, once published to npm
dsh plugin --profile web add dsh-rightclick-open

# boot the profile so the plugin's install step runs
dsh web
```

Right-click a folder — you should see **Open DeepSeek Harness here**.
If it doesn't show up immediately, restart Explorer (Task Manager → Windows
Explorer → Restart) or log off/on.

> The plugin re-applies the menu on every boot (it's a single fast `reg add`,
> so it's harmless). Removing the menu for good = remove the plugin from the
> profile **and** run the uninstall command below.

### Manual CLI

The package also ships a small command so you can manage the menu without a
running dsh:

```bash
dsh-rightclick-open install      # create the menu items
dsh-rightclick-open uninstall    # delete them
dsh-rightclick-open status       # show whether each item exists
```

From a local checkout use `node bin/dsh-rightclick-open.mjs <cmd>` instead.

## How it works — the code, part by part

```
.
├── package.json                  # the npm "ID card" + dsh metadata
├── cordis.patch.yml              # tells the harness where to insert this plugin
├── lib/
│   ├── index.js                  # the plugin: name + apply(ctx)
│   └── registry.js               # all Windows registry logic
├── bin/
│   └── dsh-rightclick-open.mjs   # standalone install/uninstall/status CLI
└── test/
    └── registry.test.js          # unit tests for the pure functions
```

### `package.json`

The package manifest. Three groups of fields matter:

- **npm identity**: `name`, `version`, `description`, `license`, `keywords`,
  `files` (what gets published), `engines` (which Node versions).
- **Module wiring**: `"type": "module"` makes `.js` files ESM
  (so `import`/`export` work); `main`/`exports` say "this package's entry is
  `lib/index.js`"; `bin` says "installing this package gives you a command
  called `dsh-rightclick-open`".
- **dsh integration**: `peerDependencies` (`@deepseek-ai/cordis` is provided
  by dsh, we just use its `ctx` type), and `dsh.bundle.patch`, which points the
  harness at `cordis.patch.yml`.

### `cordis.patch.yml`

DeepSeek Harness is built on Cordis: everything is a *row* in a composition
tree. This patch file inserts our plugin as one row (`id` + `name`), which is
how the loader knows to load it. `package.json` references it via
`dsh.bundle.patch`.

### `lib/registry.js`

All the Windows-specific work. The important idea is splitting **pure
functions** (inputs in → same output out, no side effects) from **side
effects** (actually running `reg.exe`):

- `buildShellCommand(...)` — **pure**. Turns `{nodePath, dshCliPath, folderVar, mode}`
  into the command string stored in the registry:
  `cmd /k cd /d "%V" && "<node>" "<dsh>" web` — a persistent window that runs
  dsh in the foreground (close it / Ctrl+C to stop the server).
- `install(...)` / `uninstall()` / `status()` — **side effects**. They call
  `reg.exe` via `child_process.execFile` to add/delete/query the registry keys.
- `TARGETS`, `MENU_LABEL`, `LAUNCH_MODE` — constants you can edit to change
  the label, the mode, or add a drive-icon entry.

### `lib/index.js`

The plugin contract. DSH reads two named exports:

```js
export const name = 'dsh-rightclick-open'   // plugin id
export function apply(ctx) { ... }          // runs when the plugin loads
```

Inside `apply`, `ctx.on('ready', ...)` runs our install once the app has
booted. We use `ctx.logger` for messages. Errors are caught and logged rather
than crashing dsh.

### `bin/dsh-rightclick-open.mjs`

A second, independent entry point that **reuses** `lib/registry.js`. This is
why the pure/side-effect split pays off: the same `install`/`uninstall`/`status`
functions power both the plugin and the CLI. It also shows Node basics:
`process.argv` (command-line arguments), a `switch` statement, and top-level
`await`.

### `test/registry.test.js`

Unit tests using Node's built-in test runner (`node --test`). Because
`buildShellCommand` is pure, we can assert its exact output with no real
registry access. Run with `npm test`.

## JavaScript / Node concepts this project teaches

| Concept | Where to see it |
|---|---|
| ES modules (`import` / `export`) | every `.js` file |
| Node built-in modules | `node:child_process`, `node:util`, `node:path` in `registry.js` |
| `promisify` (callback → promise) | top of `registry.js` |
| `async` / `await` + error handling | `install`/`uninstall`, `main()` in the CLI |
| `process` globals | `process.platform`, `process.execPath`, `process.argv`, `process.env` |
| Template literals (backticks) | `buildShellCommand` |
| `switch` statements | the CLI's `main()` |
| Built-in tests (`node:test` + `assert`) | `test/registry.test.js` |

## Publish to the community

1. Push this repo to GitHub.
2. Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to the repo.
3. `npm publish` (from the repo root — the `files` list controls what ships).
4. Optionally list it in a marketplace such as
   [dshmarketplace.dev](https://dshmarketplace.dev).

## Uninstall

```bash
dsh plugin --profile web remove dsh-rightclick-open
dsh-rightclick-open uninstall      # removes the menu items
```

## Notes / limitations

- The menu launches `dsh web`. To change the mode, edit `LAUNCH_MODE` in
  `lib/registry.js` (e.g. to `headless`) and reinstall.
- The command bakes in the current `node.exe` + dsh script paths at install
  time, so if you move/update Node, re-run the plugin boot (or the CLI) to
  refresh them.
- Folder names containing `&` work fine — the paths are double-quoted in the
  command line.
