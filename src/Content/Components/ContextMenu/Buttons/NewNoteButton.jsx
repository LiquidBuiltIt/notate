import React from 'react';
import { WebContentContext } from '@content/content.jsx';
import NoteHandler from '@universal/Handlers/NoteHandler.js';
import { TAG_CLASS, TAG_GLYPH_CLASS, TAG_LABEL_CLASS } from '../ContextItem.jsx';


export default function NewNoteButton() {
	const { 
		NOTE_WINDOW_CONTEXT, 
		NOTE_CONTEXT, 
		CONTEXT_MENU_CONTEXT } = React.useContext(WebContentContext)
	const [ windowState, triggerWindowState ] = NOTE_WINDOW_CONTEXT
	const [ contextMenuState, setContextMenuState ] = CONTEXT_MENU_CONTEXT
	const [ note, setNote ] = NOTE_CONTEXT


	const handleContextMenuButtonClick = () => {
		triggerWindowState(!windowState)
		setNote(new NoteHandler.Note)
		setContextMenuState(false)
	}
	

	return (
			<button 
			 id="new-note-btn"
			 className={TAG_CLASS}
			 onClick={handleContextMenuButtonClick}
			>
				<span id="svg-icon" aria-hidden="true" className={TAG_GLYPH_CLASS}>
					&para;
				</span>

				<label id="info-msg" className={`${TAG_LABEL_CLASS} cursor-pointer`}>
				{`Create a New Note`}
				</label>	
			</button>

	)
}
