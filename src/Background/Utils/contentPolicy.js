import { ConfigurationTemplate } from '@universal/Handlers/ConfigurationHandlers/ConfigurationTemplate.js'
import { isSiteNote, originHost } from '@universal/Utils/site.js'

// What a content script (code that runs on web pages) may ask of the database.
// Extension pages (the new tab) are trusted and skip all of this. Pure functions, no browser APIs.

const MAX_TITLE = 1000
const MAX_CONTENT = 20_000_000   // pictures are stored inside the note as data URLs
const MAX_ORIGIN = 2048
const MAX_SITE_NOTES = 1000      // one site cannot fill the database
const MAX_IDS = 1000

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const str = (v, max) => typeof v === 'string' && v.length <= max
const id = (v) => Number.isSafeInteger(v) && v > 0
const keysIn = (obj, allowed) => plain(obj) && Object.keys(obj).every((k) => allowed.includes(k))

// 'page' for the extension's own pages, 'content' for a content script on a web page, null for anything else.
export const senderKind = (sender, runtime) => {
	if (!sender || sender.id !== runtime.id) return null
	if (typeof sender.url === 'string' && sender.url.startsWith(runtime.getURL(''))) return 'page'
	return sender.tab && typeof sender.url === 'string' ? 'content' : null
}

// The site of the page that sent the request, from the browser's sender record and never from the request body.
export const siteOf = (sender) => {
	try { return new URL(sender.url).hostname } catch { return null }
}

// Settings: every key must exist in the stored template and every value must be one of that setting's options.
const settingOk = (tpl, patch) => keysIn(patch, ['value']) && typeof patch.value === 'string' && tpl.options.map(String).includes(patch.value)

const list = (v, max) => v === undefined || (Array.isArray(v) && v.length <= max)

const dismissedOk = (op, host) => keysIn(op, ['$add', '$remove']) && list(op.$add, 1) && list(op.$remove, MAX_IDS)
	&& (op.$add ?? []).every((s) => s === host)   // the menu only hides its own site
	&& (op.$remove ?? []).every((s) => str(s, 253))

// `path` is the module name one level down (Notate, WebContent), where special keys live, and empty elsewhere.
const walkConfig = (tpl, patch, host, path) => plain(patch) && Object.entries(patch).every(([key, value]) => {
	if (path === 'WebContent' && key === 'dismissedSites') return Array.isArray(value) ? value.length === 0 : dismissedOk(value, host)
	if (!own(tpl, key)) return false
	return own(tpl[key], 'options') ? settingOk(tpl[key], value) : walkConfig(tpl[key], value, host, path ? '' : key)
})

const configOk = (data, host) => plain(data) && Object.keys(data).length > 0 && walkConfig(ConfigurationTemplate, data, host, '')

// Checks the shape of a request. Returns what to do, or null to refuse it. `host` is the sender's site.
export const vetContentRequest = (message, host) => {
	const { type, content } = message ?? {}
	if (host === null || !plain(content)) return null
	const { database, store, data, id: recordId } = content

	if (type === 'GET_DATABASE' || type === 'RELOAD_DATABASE') {
		return database === 'notate' || database === 'userConfiguration' ? { op: 'read', database } : null
	}

	if (database === 'notate' && store === 'NOTES' && type === 'POST_DATABASE') {
		if (!keysIn(data, ['title', 'content', 'origin', 'created', 'modified'])) return null
		if (!str(data.title, MAX_TITLE) || !str(data.content, MAX_CONTENT) || !str(data.created, 100) || !str(data.modified, 100)) return null
		if (!str(data.origin, MAX_ORIGIN) || originHost(data.origin) !== host) return null
		return { op: 'createNote', database, note: { title: data.title, content: data.content, origin: data.origin, created: data.created, modified: data.modified } }
	}

	if (database === 'notate' && store === 'NOTES' && type === 'PATCH_DATABASE') {
		if (!id(recordId) || !keysIn(data, ['title', 'content']) || Object.keys(data).length === 0) return null
		if ((own(data, 'title') && !str(data.title, MAX_TITLE)) || (own(data, 'content') && !str(data.content, MAX_CONTENT))) return null
		return { op: 'editNote', database, id: recordId, patch: { ...data } }
	}

	if (database === 'notate' && store === 'NOTEBOOKS' && type === 'PATCH_DATABASE') {
		const ids = data?.collection?.$add
		if (!id(recordId) || !keysIn(data, ['collection']) || !keysIn(data.collection, ['$add']) || !Array.isArray(ids)) return null
		if (ids.length === 0 || ids.length > MAX_IDS || !ids.every(id)) return null
		return { op: 'fileNotes', database, id: recordId, ids: [...new Set(ids)] }
	}

	if (database === 'userConfiguration' && store === 'USER_CONFIGURATION' && type === 'PATCH_DATABASE') {
		return recordId === undefined && configOk(data, host) ? { op: 'config', database, patch: data } : null
	}

	return null
}

// The part of a database a content script may hold: this site's notes, the notebooks as a list (no note text), the settings.
export const trimForContent = (database, inventory, host) => {
	if (database === 'userConfiguration') return { inventory: { USER_CONFIGURATION: inventory.USER_CONFIGURATION } }
	return { inventory: {
		NOTES: inventory.NOTES.filter((note) => isSiteNote(note, host)),
		NOTEBOOKS: inventory.NOTEBOOKS.map(({ id, title, description, collection }) => ({ id, title, description, collection })),
	} }
}

export const canCreateNote = (inventory, host) => inventory.NOTES.filter((note) => isSiteNote(note, host)).length < MAX_SITE_NOTES
