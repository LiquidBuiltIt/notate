import React from 'react';
import AddNewNoteButton from './AddNewNoteButton.jsx'
import { NotebookModalContext } from '../NotebookModal.jsx'

import NoteCard from '@universal/Components/NoteCard.jsx'
import { NotateContext } from '@notate/Notate.jsx'



export default function NotebookCollection() {
	const { 
		NOTE_CONTEXT, 
		NOTEBOOK_CONTEXT, 
		NOTATE_DB_CONTEXT 
	} = React.useContext(NotateContext)

	const [ notebook, setNotebook ] = NOTEBOOK_CONTEXT
	const [ note, setNote ] = NOTE_CONTEXT
	const [ database ] = NOTATE_DB_CONTEXT 


	const { COLLECTION_CONTEXT, EXIT_MODAL } = React.useContext(NotebookModalContext)

	const [ collection, setCollection ] = COLLECTION_CONTEXT

	const [ notes, setNotes ] = React.useState([])

	const getNotesById = (collection) => {
		if (database?.inventory?.NOTES && collection) {
			const inventory = database.inventory.NOTES
			
			const notes = inventory.filter((note) => collection.includes(note.id));
			return notes
		} else return []
	}

	const handleNoteClick = async (note) => {
			await EXIT_MODAL()
			setNote(note)
	}

	const handleDragOver = (e) => {
		e.preventDefault()
	}

	const handleNoteDrop = (e) => {
		e.preventDefault()
		const data = e.dataTransfer.getData('text/plain')
		const note = JSON.parse(data)

		const target = note.id
		setCollection(prev => [...prev, target])
	}

	React.useEffect(()=>{
		setNotes(getNotesById(collection))	
	},[collection])

	React.useEffect(()=> {
		setCollection(notebook.collection)
	},[notebook])






	return (
		<div id="notebook-collection" className="flex flex-col flex-grow min-h-0">
			
			<div 
			 id="note-card-collection" 
			 className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] content-start gap-5 flex-grow min-h-0 px-1 py-2 overflow-y-auto"
			 onDragOver={handleDragOver}
			 onDrop={handleNoteDrop}
			>
				{
					notes.map((note)=>{
						return (
							<div key={note.id} className="relative min-w-0">
								<NoteCard
									note={note}
									onClick={()=>{handleNoteClick(note)}}/>
								<button
								 type="button"
								 aria-label={`Remove ${note.title} from this notebook`}
								 title="Remove from notebook (press Save to keep the change)"
								 className="focus-ink absolute right-1 top-1 size-6 leading-none font-serif text-[20px] text-ink-soft bg-paper-deep hover:text-vermilion-ink"
								 onClick={()=>{ setCollection(prev => prev.filter(id => id !== note.id)) }}
								>&times;</button>
							</div>
						)
					})
				}

				<AddNewNoteButton/>

			</div>
		</div>
	)
}
