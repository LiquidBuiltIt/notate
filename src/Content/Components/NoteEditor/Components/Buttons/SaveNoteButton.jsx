import React from 'react';
//import { NOTATE_DB, ERROR_LOGGING_DB, USER_CONFIGURATION_DB } from '@background/background.js'
import NoteHandler from '@universal/Handlers/NoteHandler.js'
import { TextInputContext } from '@universal/Components/TextEditor/TextEditor.jsx';
import { sanitizeHtml } from '@universal/Components/TextEditor/Components/TextInput/InputFormatters.js'
import { NoteEditorTitleContext } from '../NoteEditorTopbar/Components/NoteEditorTitle.jsx' 
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx';
import { WebContentContext } from '@content/content.jsx';

const NOTATE_DB = "notate"
const ERROR_LOGGING_DB = "errorLogging"
const USER_CONFIGURATION_DB = "userConfiguration"

export default function SaveNoteButton() {
	const { REQUEST_CONTEXT, NOTE_CONTEXT, NOTE_WINDOW_CONTEXT } = React.useContext(WebContentContext)
	const [ windowState, updateWindowState ] = NOTE_WINDOW_CONTEXT
	const [ request, makeRequest ] = REQUEST_CONTEXT
	const [ note, setNote ] = NOTE_CONTEXT


	const [ title, setTitle ] = React.useContext(NoteEditorTitleContext)
	const [ content, setContent ] = React.useContext(TextInputContext)
	const [ notification, setNotification ] = React.useContext(NotificationContext)

	
	const handleSave = async (noteTitle, noteContent) => {

		try {
			note.title = title
			note.content = sanitizeHtml(content)

			await makeRequest({ 
				type: 'POST_DATABASE', 
				data: note,
				store: 'NOTES',
				database: NOTATE_DB 
			})
			
			setNotification(notification.showInfo('Note Saved!'))
			updateWindowState(false)
		} catch (e) {
			setNotification(notification.showError(`Error saving note: ${e.message}`))
		}
	}

	const permittedToSave = !(title === '' || content === '')  

	return (
		<button id="save-note-btn"
		className={ `
			focus-ink smallcaps flex h-7 px-3 border items-center justify-center
			transition-colors duration-150
			${ permittedToSave ? "bg-ink text-paper border-ink hover:bg-vermilion hover:border-vermilion" : "bg-transparent text-ink-faint border-paper-edge cursor-not-allowed" } 
		`}
		onClick={(e)=>{ if (e.isTrusted) handleSave(title, content) }}
		disabled={!permittedToSave}>
			{`Save`}
		</button>
	)
}


