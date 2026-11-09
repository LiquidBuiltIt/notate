// Drives headless Chromium over raw CDP. Zero dependencies: node:http, fetch, WebSocket.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const EXT_DIR = resolve(here, '../../../dist/chrome')
// The manifest pins a key, so the extension id is stable.
export const EXT_ID = 'mienhcnmknnplcaheeelfggdagmighap'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function waitFor(fn, what, timeout = 15000) {
	const end = Date.now() + timeout
	let last
	while (Date.now() < end) {
		try { last = await fn(); if (last) return last } catch (e) { last = e }
		await sleep(150)
	}
	throw new Error(`timed out waiting for ${what}${last instanceof Error ? ': ' + last.message : ''}`)
}

class Cdp {
	constructor(ws) {
		this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = []
		ws.addEventListener('message', (m) => {
			const msg = JSON.parse(m.data)
			if (msg.id) {
				const p = this.pending.get(msg.id); this.pending.delete(msg.id)
				msg.error ? p.reject(new Error(`${p.method}: ${msg.error.message}`)) : p.resolve(msg.result)
			} else this.listeners.forEach((l) => l(msg))
		})
	}
	send(method, params = {}, sessionId) {
		const id = ++this.id
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject, method })
			this.ws.send(JSON.stringify({ id, method, params, sessionId }))
		})
	}
	on(fn) { this.listeners.push(fn) }
}

export async function startFixture() {
	const server = createServer((req, res) => {
		res.setHeader('content-type', 'text/html')
		res.end('<!doctype html><title>fixture</title><body><h1>fixture page</h1><p>hello</p></body>')
	})
	await new Promise((r) => server.listen(0, '127.0.0.1', r))
	return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }
}

// A target session: evaluate JS and collect errors.
class Session {
	constructor(cdp, sessionId, info, errors) { Object.assign(this, { cdp, sessionId, info, errors }) }
	send(method, params) { return this.cdp.send(method, params, this.sessionId) }
	async eval(expression) {
		const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
		if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`)
		return r.result.value
	}
	async mouse(type, x, y, extra = {}) {
		await this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra })
	}
	async click(x, y) {
		await this.mouse('mouseMoved', x, y)
		await this.mouse('mousePressed', x, y)
		await this.mouse('mouseReleased', x, y)
	}
	async type(text) { await this.send('Input.insertText', { text }) }
}

export async function launch() {
	const profile = mkdtempSync(join(tmpdir(), 'notate-profile-'))
	const proc = spawn('/usr/bin/chromium', [
		'--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
		'--window-size=1440,900', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
		`--load-extension=${EXT_DIR}`, `--disable-extensions-except=${EXT_DIR}`, 'about:blank',
	], { stdio: 'ignore' })
	const portFile = join(profile, 'DevToolsActivePort')
	const [port] = (await waitFor(() => existsSync(portFile) && readFileSync(portFile, 'utf8'), 'DevToolsActivePort')).split('\n')
	const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
	const ws = new WebSocket(webSocketDebuggerUrl)
	await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
	const cdp = new Cdp(ws)
	const errors = [] // page errors, uncaught exceptions and console.error from every attached target
	const sessions = new Map()

	const attach = async (targetInfo) => {
		const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: targetInfo.targetId, flatten: true })
		const s = new Session(cdp, sessionId, targetInfo, errors)
		sessions.set(targetInfo.targetId, s)
		await s.send('Runtime.enable'); await s.send('Log.enable'); await s.send('Page.enable').catch(() => {})
		return s
	}
	cdp.on((m) => {
		const where = m.sessionId
		if (m.method === 'Runtime.exceptionThrown') {
			const d = m.params.exceptionDetails
			errors.push(`${where}: exception ${d.exception?.description || d.text}`)
		} else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
			errors.push(`${where}: console.error ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
		} else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
			errors.push(`${where}: log ${m.params.entry.text} ${m.params.entry.url || ''}`)
		}
	})

	const targets = async () => (await cdp.send('Target.getTargets')).targetInfos
	const api = {
		cdp, errors, profile,
		targets,
		// Attach to the extension service worker (waits for it to exist). Replays its buffered console.
		async serviceWorker() {
			const t = await waitFor(async () => (await targets()).find((x) => x.type === 'service_worker' && x.url.includes(EXT_ID)), 'extension service worker')
			return sessions.get(t.targetId) || attach(t)
		},
		async openPage(url) {
			const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
			const s = await attach((await targets()).find((t) => t.targetId === targetId))
			await s.send('Page.navigate', { url })
			await waitFor(async () => (await s.eval('document.readyState')) === 'complete', `load ${url}`)
			return s
		},
		// Neutral extension-origin document, used to read IndexedDB without running the app.
		async reader() {
			return api._reader ||= await api.openPage(`chrome-extension://${EXT_ID}/global.css`)
		},
		// All records of every store in the extension's databases: { NOTATE_DB: { NOTES: [...], NOTEBOOKS: [...] }, ... }
		async idb() {
			const r = await api.reader()
			return r.eval(`(async () => {
				const out = {}
				for (const name of ['NOTATE_DB', 'USER_CONFIGURATION_DB', 'ERROR_LOGGING_DB']) {
					if (!(await indexedDB.databases()).some((d) => d.name === name)) continue
					const db = await new Promise((res, rej) => { const q = indexedDB.open(name); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
					out[name] = {}
					for (const store of db.objectStoreNames) {
						out[name][store] = await new Promise((res, rej) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
					}
					db.close()
				}
				return out
			})()`)
		},
		async close() {
			try { ws.close() } catch {}
			proc.kill('SIGKILL')
			await sleep(200)
			rmSync(profile, { recursive: true, force: true })
		},
	}
	return api
}

// UI driver for one document root. `rootExpr` is a JS expression yielding a Document or ShadowRoot.
export const CONTENT_ROOT = `document.querySelector('#content-script-entry-point').shadowRoot`
async function stable(read, what) {
	let prev = ''
	return waitFor(async () => {
		const cur = await read()
		const key = JSON.stringify(cur)
		const same = cur && key === prev
		prev = key
		if (!same) await sleep(100)
		return same && cur
	}, what)
}

export function ui(page, rootExpr = 'document') {
	const find = (sel) => `(${rootExpr}).querySelector(${JSON.stringify(sel)})`
	const api = {
		exists: (sel) => page.eval(`!!${find(sel)}`),
		text: () => page.eval(`(${rootExpr}).body?.innerText ?? (${rootExpr}).textContent`),
		appear: (sel, t) => waitFor(() => api.exists(sel), `element ${sel}`, t),
		gone: (sel, t) => waitFor(async () => !(await api.exists(sel)), `${sel} to disappear`, t),
		// Centre of the element, once it is enabled, on screen, not covered, and no longer moving (CSS transitions).
		center: (sel) => stable(() => page.eval(`(() => {
			const el = ${find(sel)}; if (!el || el.disabled) return null
			const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2
			const hit = (${rootExpr}).elementFromPoint(x, y)
			return hit && (hit === el || el.contains(hit)) ? { x, y } : null
		})()`), `${sel} to be clickable`),
		async hover(sel) { const { x, y } = await api.center(sel); await page.mouse('mouseMoved', x, y) },
		async click(sel) { const { x, y } = await api.center(sel); await page.click(x, y) },
		// Focus a text field or contenteditable and type into it with real input events.
		async fill(sel, text) {
			await api.appear(sel)
			await page.eval(`${find(sel)}.focus()`)
			await page.type(text)
		},
	}
	return api
}

// Page with the content script loaded and mounted.
export async function openFixture(b, fx) {
	const page = await b.openPage(fx.url)
	const c = ui(page, CONTENT_ROOT)
	await waitFor(() => page.eval(`!!document.querySelector('#content-script-entry-point')`), 'content script root')
	await c.appear('#context-menu-hover-region')
	return { page, c }
}

// Hover the bottom-right corner, click the Notate button, wait for the menu to slide in.
export async function openContextMenu(c) {
	await c.hover('#context-menu-hover-region')
	await c.click('#context-menu-btn')
}
