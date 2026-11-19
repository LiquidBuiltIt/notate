// Markdown import. New tab page only: files are read here, parsed by our own parser and sanitized before they are stored.
import { parseMarkdown } from '@universal/Utils/mdParse.js'
import { sanitizeHtml } from '@universal/Components/TextEditor/Components/TextInput/InputFormatters.js'
import NoteHandler from '@universal/Handlers/NoteHandler.js'

export const MAX_FILES = 500
export const MAX_FILE = 1_000_000
export const MAX_TOTAL = 10_000_000
const TYPE = /^(text\/(plain|markdown|x-markdown))?$/
const NAME = /\.(md|markdown|txt)$/i

// Title: front matter `title`, else the first top-level H1 (taken out of the body), else the file name. `colors` maps a color name to its stored styles.
export const noteFromMarkdown = (text, fileName, colors = {}) => {
	const { html, meta } = parseMarkdown(text, { front: true })
	const body = new DOMParser().parseFromString(html, 'text/html').body
	let title = String(meta.title ?? '').trim()
	if (!title) {
		const h1 = Array.from(body.children).find((e) => e.localName === 'h1' && e.textContent.trim())
		if (h1) { title = h1.textContent.trim(); h1.remove() }
	}
	title = (title || fileName.replace(NAME, '').trim() || 'Untitled').slice(0, 200)
	const note = new NoteHandler.Note(title, sanitizeHtml(body.innerHTML), null)
	const color = String(meta.color ?? '').toLowerCase()
	if (Object.hasOwn(colors, color)) note.color = { name: color, styles: colors[color] }
	return note
}

// Returns { notes, skipped: [[name, reason]] }. Non-text files, invalid UTF-8, NUL bytes and files over the limits are skipped.
export const readMarkdownFiles = async (files, colors) => {
	const notes = [], skipped = []
	let total = 0
	const list = Array.from(files)
	for (const file of list.slice(0, MAX_FILES)) {
		try {
			if (!NAME.test(file.name) || !TYPE.test(file.type)) throw 'not a Markdown or text file'
			if (file.size > MAX_FILE) throw 'file is too large'
			if (total + file.size > MAX_TOTAL) throw 'over the total size limit'
			total += file.size
			const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^﻿/, '')
			if (text.includes('\u0000')) throw 'not text'
			notes.push(noteFromMarkdown(text, file.name, colors))
		} catch (error) {
			skipped.push([file.name, typeof error === 'string' ? error : 'could not be read as text'])
		}
	}
	for (const file of list.slice(MAX_FILES)) skipped.push([file.name, 'too many files'])
	return { notes, skipped }
}
