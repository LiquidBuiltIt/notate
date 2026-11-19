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

	const [ status, setStatus ] = React.useState('')

	const handleChange = async (event) => {
		const files = Array.from(event.target.files ?? [])
		event.target.value = ''
		if (!files.length) return
		try {
			const { notes, skipped } = await readMarkdownFiles(files, NoteColors, (done, count) => setStatus(`Reading ${done} of ${count} files...`))
			// One request and one database transaction for all notes. Then the page asks for the new list.
			if (notes.length) {
				setStatus(`Saving ${notes.length} notes...`)
				if (!(await sendRequest({ type: 'POST_DATABASE_BATCH', data: notes, store: 'NOTES', database: NOTATE_DB }))) throw new Error('The notes were not stored')
				makeRequest({ type: 'RELOAD_DATABASE', database: NOTATE_DB })
			}
			const skip = skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 3).map(([name, why]) => `${name} (${why})`).join(', ')}${skipped.length > 3 ? ', ...' : ''}.` : ''
			setNotification(notification.showInfo(`Imported ${notes.length} note${notes.length === 1 ? '' : 's'}.${skip}`))
		} catch (error) {
			console.error('Error importing notes:', error)
			setNotification(notification.showError())
		}
		setStatus('')
	}

	return (
		<li id="import-markdown" className="list-none py-3 flex items-baseline justify-between gap-6">
			<span id="import-markdown-status" className="text-[16px] italic text-ink-soft">{status || 'Add notes from Markdown files. Each file becomes one note.'}</span>
			<input id="import-markdown-input" ref={input} type="file" multiple accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={handleChange} className="hidden"/>
			<button id="import-markdown-button" disabled={!!status} onClick={() => input.current?.click()} className="smallcaps focus-ink whitespace-nowrap border-b border-ink trans-ease hover:text-vermilion-ink hover:border-vermilion">Import Markdown</button>
		</li>
	)
}
