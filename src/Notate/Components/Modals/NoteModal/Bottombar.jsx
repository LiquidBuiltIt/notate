import React from 'react';
import { NOTATE_DB, ERROR_LOGGING_DB, USER_CONFIGURATION_DB } from '@background/background.js'
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx';
import ConfirmationMsgHandler from '../ConfirmationModal/ConfimrationMsgHandler.js'
import ConfirmationMsg, { ConfirmationMsgContext } from '../ConfirmationModal/ConfirmationMsg.jsx';
import { NotateContext  } from '@notate/Notate.jsx';

import { sanitizeHtml } from '@universal/Components/TextEditor/Components/TextInput/InputFormatters.js'
import TrashLogo from '@assets/Designs/trash-logo.svg';
import { NoteModalContext } from './NoteModal.jsx'

export default function NoteModalBottombar({onExit}) {
	const { NOTE_CONTEXT, REQUEST_CONTEXT } = React.useContext(NotateContext)
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
  	      await makeRequest({ 
		      type: 'POST_DATABASE', 
		      data: note, 
		      store: 'NOTES', 
		      database: NOTATE_DB
	      })

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
			className="flex mt-2 space-x-3">
	
		        <button id="save-btn" 
		  	className={`${ permittedToSave ? "bg-green-600" : "bg-gray-500"  } h-12 text-white py-3 px-4 border-none rounded cursor-pointer w-full text-base ${permittedToSave ? "hover:bg-green-700" : ""} trans-ease`}
		  	disabled={permittedToSave ? false : true}
		  	onClick={handleSaveClick}>Save
			</button>

			<button id="delete-btn"
			className={`size-12 ${ disabledState ? "bg-gray-500" : " bg-red-400" } rounded flex items-center justify-center`}
			onClick={handleDeleteClick}
			disabled={disabledState}>
				<TrashLogo className="size-10 fill-transparent stroke-gray-50 stroke-[1.5]"/>
			</button>
	
		</div>

	)
}
