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
	// Four notes of 20 MB, stored two at a time (the answer to a batch is short): the stored database no longer fits in one port message (about 64 MB).
	const note = (title) => `{ title: '${title}', content: 'a'.repeat(20e6), origin: null, created: '', modified: '' }`
	for (const titles of [['big 1', 'big 2'], ['big 3', 'big 4']]) {
		const reply = await ask('POST_DATABASE_BATCH', `{ database: 'notate', store: 'NOTES', data: [${titles.map(note)}] }`)
		assert.equal(reply.hasData, true, `${titles}`)
	}
	// This small note is stored, but the answer (the whole database) is too big to send. It still gets an answer, without data.
	const reply = await ask('POST_DATABASE', `{ database: 'notate', store: 'NOTES', data: { title: 'small', content: 'x', origin: null, created: '', modified: '' } }`)
	assert.notEqual(reply, 'no reply')
	assert.equal(reply.type, 'DATABASE')
	assert.equal(reply.hasData, false, 'the reply that cannot be sent is replaced by an error reply')
	// b.idb() would carry 80 MB through the debugger, so only count the notes.
	const stored = await (await b.reader()).eval(`new Promise((res, rej) => {
		const q = indexedDB.open('NOTATE_DB'); q.onerror = () => rej(q.error)
		q.onsuccess = () => { const c = q.result.transaction('NOTES').objectStore('NOTES').count(); c.onsuccess = () => res(c.result) }
	})`)
	assert.equal(stored, 5, 'the notes were stored')
})
