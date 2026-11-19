import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { launch, waitFor } from './helper.mjs'

let b
beforeEach(async () => { b = await launch() })
afterEach(async () => { await b.close() })

// Sends one request on the data port from the new tab world and resolves with a summary of the reply ({ type, hasData }), or 'no reply'.
// The reply itself can be 60 MB, so it is not carried through the debugger.
// `content` is JavaScript that runs in the page, so a 20 MB note is built there and not sent through the debugger.
const ask = async (type, content) => (await b.reader()).eval(`new Promise((res) => {
	const port = chrome.runtime.connect({ name: 'DATABASE_CONNECTION' })
	port.onMessage.addListener((m) => { m = typeof m === 'string' ? JSON.parse(m) : m; res({ type: m.type, hasData: !!m.content?.data }) })
	port.postMessage({ type: ${JSON.stringify(type)}, content: ${content} })
	setTimeout(() => res('no reply'), 20000)
})`)

test('a reply that is too big for the port still gets an answer: an error reply, not silence', async () => {
	await b.serviceWorker()
	await waitFor(async () => (await b.idb()).USER_CONFIGURATION_DB?.USER_CONFIGURATION?.length, 'seeded config')
	// Four notes of 20 MB: the stored database no longer fits in one port message (about 64 MB).
	for (let i = 0; i < 4; i++) {
		const reply = await ask('POST_DATABASE', `{ database: 'notate', store: 'NOTES', data: { title: 'big ${i}', content: 'a'.repeat(20e6), origin: null, created: '', modified: '' } }`)
		assert.notEqual(reply, 'no reply', `post ${i}`)
		assert.equal(reply.type, 'DATABASE')
		if (i < 3) assert.ok(reply.hasData, `post ${i} is answered with the database`)
		else assert.equal(reply.hasData, false, 'the reply that cannot be sent is replaced by an error reply')
	}
	// b.idb() would carry 80 MB through the debugger, so only count the notes.
	const stored = await (await b.reader()).eval(`new Promise((res, rej) => {
		const q = indexedDB.open('NOTATE_DB'); q.onerror = () => rej(q.error)
		q.onsuccess = () => { const c = q.result.transaction('NOTES').objectStore('NOTES').count(); c.onsuccess = () => res(c.result) }
	})`)
	assert.equal(stored, 4, 'the notes were stored')
})
