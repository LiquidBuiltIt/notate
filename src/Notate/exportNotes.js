// Markdown export. New tab page only: a download link must never be put into a web page's DOM.
import { toMarkdown, mdText, mdTitle } from '@universal/Utils/markdown.js'
import { zip } from '@universal/Utils/zip.js'
import { sanitizeHtml } from '@universal/Components/TextEditor/Components/TextInput/InputFormatters.js'

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i

// Safe as a file or folder name on every system: no path characters, no control characters, at most 80 characters.
export const fileName = (s, fallback = 'Untitled') => {
	const name = Array.from(String(s ?? '').replace(/[\/\\:*?"<>|\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ''))
		.slice(0, 80).join('').trim().replace(/^\.+|[. ]+$/g, '')
	return !name ? fallback : RESERVED.test(name) ? `_${name}` : name
}

export const download = (name, blob) => {
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = name
	document.body.append(a)
	a.click()
	a.remove()
	setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// Notes made on the new tab page store the extension's own address as their origin: that is not a source.
const source = (origin, ownId) => origin && !String(origin).startsWith(ownId) ? `Source: ${mdText(origin)}` : ''

const section = (note, level, shift, ownId) => [mdTitle(level, note.title), source(note.origin, ownId), toMarkdown(note.content, shift)].filter(Boolean).join('\n\n')

export const noteExport = (note, ownId) => ({ name: `${fileName(note.title)}.md`, text: section(note, 1, 0, ownId) + '\n' })

export const notebookExport = (notebook, notes, ownId) => {
	const byId = new Map(notes.map((n) => [n.id, n]))
	const body = (notebook.collection ?? []).map((id) => byId.get(id)).filter(Boolean).map((n) => section(n, 2, 2, ownId))
	const description = String(notebook.description ?? '').split(/\r?\n/).map(mdText).filter(Boolean).join('\n\n')
	return { name: `${fileName(notebook.title, 'Untitled notebook')}.md`, text: [mdTitle(1, notebook.title), description, ...body].filter(Boolean).join('\n\n') + '\n' }
}

// A JSON string is a valid YAML string, so no value can add a field or leave its line. YAML 1.1 line separators are escaped too.
const q = (v) => JSON.stringify(String(v ?? '')).replace(/[\u007f-\u009f\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))

// Returns { name, blob }: Markdown files by notebook folder, plus notate.json with the full records.
export const backupExport = (notes, notebooks, now = new Date()) => {
	const books = [...notebooks].sort((a, b) => a.id - b.id)
	const home = new Map(), member = new Map()
	for (const bk of books) for (const id of new Set(bk.collection ?? [])) {
		if (!home.has(id)) home.set(id, bk.id) // the lowest notebook id holds the file, as on the board
		member.set(id, [...(member.get(id) ?? []), bk.id])
	}
	const unique = (taken, name, ext = '') => {
		let n = name, i = 1
		while (taken.has((n + ext).toLowerCase())) n = `${name} (${++i})`
		taken.add((n + ext).toLowerCase())
		return n + ext
	}
	const folders = new Set(['unfiled'])
	const folderOf = new Map(books.map((bk) => [bk.id, unique(folders, fileName(bk.title, 'Untitled notebook'))]))
	const taken = new Map()
	const files = []
	for (const n of [...notes].sort((a, b) => a.id - b.id)) {
		const folder = home.has(n.id) ? folderOf.get(home.get(n.id)) : 'Unfiled'
		if (!taken.has(folder)) taken.set(folder, new Set())
		const front = `---\nid: ${q(n.id)}\ntitle: ${q(n.title)}\ncolor: ${q(n.color?.name ?? n.color)}\ncreated: ${q(n.created)}\nmodified: ${q(n.modified)}\norigin: ${q(n.origin)}\nnotebooks: [${(member.get(n.id) ?? []).map(q).join(', ')}]\n---\n\n`
		files.push({ name: `${folder}/${unique(taken.get(folder), fileName(n.title), '.md')}`, data: front + toMarkdown(n.content, 0) + '\n' })
	}
	const data = { format: 'notate-backup', version: 1, exported: now.toISOString(), notes: notes.map((n) => ({ ...n, content: sanitizeHtml(String(n.content ?? '')) })), notebooks }
	files.unshift({ name: 'notate.json', data: JSON.stringify(data, null, 2) })
	return { name: `notate-backup-${now.toLocaleDateString('en-CA')}.notate`, blob: zip(files, now) }
}
