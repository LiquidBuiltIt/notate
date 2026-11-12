import React from 'react';
import NoteHandler from '@universal/Handlers/NoteHandler.js'

import  { NotebookModalContext } from '../NotebookModal.jsx'
import { NotateContext } from '@notate/Notate.jsx'



export default function AddNewNoteButton () {
	const { NOTE_CONTEXT, NOTEBOOK_CONTEXT } = React.useContext(NotateContext)
	const [ note, setNote ] = NOTE_CONTEXT 
	const [ notebook, setNotebook ] = NOTEBOOK_CONTEXT 

	const { EXIT_MODAL } = React.useContext(NotebookModalContext)





	const handleAddNewNoteClick = async () => {
		const newNote = new NoteHandler.Note

		await EXIT_MODAL()
		setNote(newNote)
	}

	return (
		<div id="add-new-note-container"
		className="flex shrink-0 items-center justify-center">
			<button id="add-new-note-button"
			className="smallcaps focus-ink trans-ease flex flex-col items-center justify-center gap-2 w-[9rem] h-[170px] border border-dashed border-ink-faint text-ink-soft hover:border-vermilion hover:text-vermilion-ink hover:bg-vermilion-wash/40"
			onClick={handleAddNewNoteClick}>
				<span className="font-display italic text-[34px] leading-none normal-case tracking-normal" aria-hidden="true">+</span>
				New note
			</button>
		</div>

	)
}
