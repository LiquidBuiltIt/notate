import React from 'react';
import { NotateContext } from '@notate/Notate.jsx'
import { NOTATE_DB } from '@background/background.js'
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx'
import { NoteColors } from '@notate/Components/Modals/NoteModal/Components/NoteColorProvider.js'
import { readMarkdownFiles } from '@notate/importNotes.js'
import { sendRequest } from '@universal/Hooks/useRequest/useRequest.jsx'

// New tab Settings only: the web page Settings has no import, so a page never reaches a file picker.
export default function ImportMarkdownItem() {
	const [ , makeRequest ] = React.useContext(NotateContext).REQUEST_CONTEXT
	const [ notification, setNotification ] = React.useContext(NotificationContext)
	const input = React.useRef(null)

	const handleChange = async (event) => {
		const files = Array.from(event.target.files ?? [])
		event.target.value = ''
		if (!files.length) return
		try {
			const { notes, skipped } = await readMarkdownFiles(files, NoteColors)
			// makeRequest keeps one request at a time, so all notes but the last go straight to the background; the last one refreshes the page.
			const post = (note) => ({ type: 'POST_DATABASE', data: note, store: 'NOTES', database: NOTATE_DB })
			for (const note of notes.slice(0, -1)) if (!(await sendRequest(post(note)))) throw new Error('A note was not stored')
			if (notes.length) makeRequest(post(notes[notes.length - 1]))
			const skip = skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 3).map(([name, why]) => `${name} (${why})`).join(', ')}${skipped.length > 3 ? ', ...' : ''}.` : ''
			setNotification(notification.showInfo(`Imported ${notes.length} note${notes.length === 1 ? '' : 's'}.${skip}`))
		} catch (error) {
			console.error('Error importing notes:', error)
			setNotification(notification.showError())
		}
	}

	return (
		<li id="import-markdown" className="list-none py-3 flex items-baseline justify-between gap-6">
			<span className="text-[16px] italic text-ink-soft">Add notes from Markdown files. Each file becomes one note.</span>
			<input id="import-markdown-input" ref={input} type="file" multiple accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={handleChange} className="hidden"/>
			<button id="import-markdown-button" onClick={() => input.current?.click()} className="smallcaps focus-ink whitespace-nowrap border-b border-ink trans-ease hover:text-vermilion-ink hover:border-vermilion">Import Markdown</button>
		</li>
	)
}
