import React from 'react';
import NoteHandler from '@universal/Handlers/NoteHandler.js';
import NotebookHandler from '@universal/Handlers/NotebookHandler.js';
import { NotateContext } from '@notate/Notate.jsx';



export default function NewItemButton(){
	const { NOTE_CONTEXT, NOTEBOOK_CONTEXT } = React.useContext(NotateContext)
	const [ note, setNote ] = NOTE_CONTEXT
	const [ notebook, setNotebook ] = NOTEBOOK_CONTEXT

	const [ newButtonState, setNewButtonState ] = React.useState(false)
	const [ styleState, setStyleState ] = React.useState(false)


	const handleMouseOver =  () => {
		setNewButtonState(true)
		setStyleState(true)
	}

	const handleMouseLeave = () => {
		setNewButtonState(false)
		setStyleState(false)
	}

	const handleNewNoteClick = () => {
		const newNote = new NoteHandler.Note
		setNote(newNote)
	}

	const handleNewNotebookClick = () => {
		const newNotebook = new NotebookHandler.Notebook
		setNotebook(newNotebook)
	}


	return (
		<div id="new-item-btn-container"
		className="relative self-stretch shrink-0"	
		onMouseOver={handleMouseOver}
		onMouseLeave={handleMouseLeave}>
			<div id="new-note-button"
			className="group h-full">
				<button 
				 type="button"
				 aria-haspopup="true"
				 title="Create a note or notebook"
				 className="smallcaps focus-ink h-full flex items-center gap-3 px-5 bg-ink text-paper trans-ease hover:bg-vermilion">
					<span id="btn-logo" className="text-[20px] leading-none font-medium" aria-hidden="true">+</span>New

				</button>

				<div id="new-options" 
				 className={`
				 	absolute right-0 top-full z-button w-60 flex flex-col paper-grain hairline border-t-0 shadow-print-sm
					transition-all duration-150 ease-out group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0
					${ styleState ? "visible opacity-100 translate-y-0" : "invisible opacity-0 -translate-y-1" }
				`}>
					<button 
					 id="new-note-button" 
					 type="button"
					 className="smallcaps focus-ink flex justify-between items-center gap-4 px-4 py-4 text-left border-b border-paper-edge trans-ease hover:bg-paper-deep hover:text-vermilion-ink"
					 onClick={handleNewNoteClick}
					>
						<span className="whitespace-nowrap">+ Note</span><span className="font-display italic normal-case tracking-normal text-sm text-ink-soft whitespace-nowrap">a loose page</span>
					</button>

					<button 
					 id="new-notebook-button" 
					 type="button"
					 className="smallcaps focus-ink flex justify-between items-center gap-4 px-4 py-4 text-left trans-ease hover:bg-paper-deep hover:text-vermilion-ink"
					 onClick={handleNewNotebookClick}
					>
						<span className="whitespace-nowrap">+ Notebook</span><span className="font-display italic normal-case tracking-normal text-sm text-ink-soft whitespace-nowrap">a bound set</span>
					</button>
				</div>
				
			</div>

		</div>
	)
}
