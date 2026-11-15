import React from 'react';
import { NOTATE_DB, ERROR_LOGGING_DB, USER_CONFIGURATION_DB } from '@background/background.js'
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx';
import ConfirmationMsgHandler from '../ConfirmationModal/ConfimrationMsgHandler.js'
import ConfirmationMsg, { ConfirmationMsgContext } from '../ConfirmationModal/ConfirmationMsg.jsx';
import { NotateContext  } from '@notate/Notate.jsx';

import { sanitizeHtml } from '@universal/Components/TextEditor/Components/TextInput/InputFormatters.js'
import { NoteModalContext } from './NoteModal.jsx'

export default function NoteModalBottombar({onExit}) {
	const { NOTE_CONTEXT, REQUEST_CONTEXT, BOARD_API_CONTEXT } = React.useContext(NotateContext)
	const [note, setNote ] = NOTE_CONTEXT
	const [ request, makeRequest ] = REQUEST_CONTEXT 


	const { TITLE_CONTEXT, CONTENT_CONTEXT, COLOR_CONTEXT } = React.useContext(NoteModalContext)
	const [ title, setTitle ] = TITLE_CONTEXT
	const [ content, setContent ] = CONTENT_CONTEXT
	const [ color, setColor ] = COLOR_CONTEXT

  	const [notification, setNotification] = React.useContext(NotificationContext)
	const [ confMsgState, setConfMsgState ] = React.useContext(ConfirmationMsgContext)

	const [ disabledState, setDisabledState ] = React.useState(false)


	const initialNoteState = React.useRef({
		content: content,
		title: title,
		color: color
	})


	//React.useEffect(()=>{color; initialNoteState; debugger},[color])	


  	const handleSaveClick = async () => {
  	  try {
  	      note.title = title;
  	      note.content = sanitizeHtml(content);	

  	      await onExit();
	      if (!note.id) BOARD_API_CONTEXT.current?.expectPlace()   // on the board, a new note follows the cursor until it is placed
	      // An existing note patches only what the editor owns, so a position saved from the board meanwhile is kept.
  	      await makeRequest(note.id
		      ? { type: 'PATCH_DATABASE', id: note.id, data: { title: note.title, content: note.content, ...(note.color && { color: note.color }) }, store: 'NOTES', database: NOTATE_DB }
		      : { type: 'POST_DATABASE', data: note, store: 'NOTES', database: NOTATE_DB })

  	      setNotification(notification.showInfo('Note Saved'))

  	  } catch (error) {
  	    	console.error('Error saving note:', error);
  	      setNotification(notification.showError())
  	  }
  	};

	const handleDeleteClick = () => {
		const confirmNoteDelete = async () => {
			await onExit()
			makeRequest({ 
				type: 'DELETE_DATABASE', 
				data: note, 
				store: 'NOTES', 
				database: NOTATE_DB 
			})

			setNotification(notification.showInfo('Note Deleted!'))

		}

		setConfMsgState(new ConfirmationMsgHandler('Delete Note?',
								'Are you sure you want to delete this note? This is a permanent action!',
								'Delete',
								confirmNoteDelete,
								false))
	}


	

	/* permittedToSave compares 2 conditions: 
	   	- noteChange: compares differences between initial state of note vs current state of note 
		- valuesEmpty: compares if either note properties provided are empty
	   
	   If the 1st and inverse of the 2nd condition is met, the user can Save */
	const noteChange = !(title == initialNoteState.current.title && content == initialNoteState.current.content) || !(color == initialNoteState.current.color) 
	const valuesEmpty = ((content == "" || content == undefined) || (title == "" || title == undefined))
	const permittedToSave = (noteChange && !valuesEmpty)


	React.useEffect(()=>{
		if (!note.id) setDisabledState(true)
	})

	return (
		<div id="btn-ctrl-center"
			className="flex items-center gap-6 mt-4 pt-4 border-t border-ink">
	
		        <button id="save-btn" 
		  	className={`smallcaps focus-ink h-12 px-10 trans-ease ${ permittedToSave ? "bg-ink text-paper hover:bg-vermilion" : "bg-transparent hairline text-ink-faint cursor-not-allowed" }`}
		  	disabled={permittedToSave ? false : true}
		  	onClick={handleSaveClick}>Save
			</button>

			<button id="delete-btn"
			className={`smallcaps focus-ink ml-auto pb-1 border-b trans-ease ${ disabledState ? "border-paper-edge text-ink-faint cursor-not-allowed" : "border-ink text-ink hover:text-vermilion-ink hover:border-vermilion" }`}
			onClick={handleDeleteClick}
			disabled={disabledState}>
				Delete note
			</button>
	
		</div>

	)
}
