import React from 'react';
import NoteCard from './NoteCard.jsx';

export default function NotebookCard({ notebook, onNoteClick, onNotebookClick, updatesDispatcher, inventory }) {

 	const [showNotes, setShowNotes] = React.useState(false);
	const [noteList, populate] = React.useState([]);

	/* Function that grabs notes via StorageHandler which requires
	using a Promise object */
	const populateNotebook = async () => {
		if (inventory?.NOTES) {
			const notes = inventory.NOTES

			const filteredNotes = notes.filter(note => notebook.collection.includes(note.id)) 
	
			populate(filteredNotes)
		}

	}

	const handleNoteDrop = async (event) => {
		event.preventDefault();
		const fetchedData = event.dataTransfer.getData('text/plain')
		const parsedData = JSON.parse(fetchedData) 
		const note = sanitizeNoteData(parsedData) 
		await updatesDispatcher(notebook, note)
	}

	const sanitizeNoteData = (note) => {
		// add more props if any parts of application
		// attach props for specific use cases
		delete note?.hits
		return note
	}

	const dragHandler = (event) => {
		if (event.target.id === 'notebook-card-container') {
			const JSONified = JSON.stringify(notebook)
			event.dataTransfer.setData('text/plain', JSONified)
		}
	}


	// update this to add more visual functionality
	const handleNoteDragOver = (event) => {
		// Needed for event propagation | onDrop event to fire
		event.preventDefault();
	}

	React.useEffect(()=> {populateNotebook()},[inventory])



  	return (
		<div 
		 id="notebook-card-container" 
		 className={`
			 relative group z-0 w-[76px] shrink-0 transition duration-150 ease-out transform hover:-translate-y-2 
			 font-serif cursor-pointer
		 `}
		 onDragStart={dragHandler}
		 draggable
		>
		
			  {/* Notebook Cover Designs: a book seen by its spine */}
			<div 
			 id={`notebook-card-${notebook.id}`} 
			 data-notebook-id={notebook.id}
			 title={notebook.description ? `${notebook.title}: ${notebook.description}` : notebook.title}
			 className="relative flex flex-col items-center justify-between w-[76px] min-h-[232px] max-h-[232px] py-3 rounded-none bg-ink text-paper border-x border-t border-ink shadow-print-sm z-[5] hover:z-[20] hover:shadow-print" 
			 onClick={onNotebookClick}
			 onDrop={handleNoteDrop}
			 onDragOver={handleNoteDragOver}
		    	>
				{/* Gilt bands, top and bottom, as on a bound spine */}
				<div id="notebook-cover-side" className="absolute inset-x-[7px] top-[10px] bottom-[10px] border-y border-paper/40 pointer-events-none" aria-hidden="true"/>
				<span id="notebook-count" className="oldstyle text-[13px] leading-none text-vermilion-wash mt-[10px]">{noteList.length}</span>
			      	<h3 
				 id="notebook-title" 
				 className="font-display italic text-[22px] leading-none font-semibold text-paper overflow-hidden text-ellipsis whitespace-nowrap max-h-[150px]"
				 style={{ writingMode: 'vertical-rl' }}
				>{notebook.title}</h3>
			      	<p 
				 id="notebook-description" 
				 className="smallcaps text-paper/60 overflow-hidden text-ellipsis whitespace-nowrap max-h-[48px] mb-[10px]"
				 style={{ writingMode: 'vertical-rl' }}
				>{notebook.description}</p>
		    	</div>
		
			  {/* Where NoteCard Components are populated */}
			<div 
			 id="note-card-group" 
			 className="absolute w-full top-0 z-0 max-h-[170px] opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto"
			>
		        {			
				noteList.slice(0, 4).map((note, index) => {
					// group-hover:z-[6] group-hover:z-[7] group-hover:z-[8] group-hover:z-[9]
					const pos = (((index+1)*(-1))+10).toString() 
			
					//  group-hover:-translate-y-[40px] group-hover:-translate-y-[80px] group-hover:-translate-y-[120px] group-hover:-translate-y-[160px]
					const stack = ((index*40)+40).toString() 
							
					return (
						<div id="note-card-stack-item" 
						 key={index}
			     			 className={`relative group-hover:z-[${pos}] transition duration-200 ease-in-out transform hover:-translate-y-5`}
						> 
							<NoteCard 
							 note={note}  
							 stackClass={`absolute top-full left-0 transition duration-200 ease-in-out transform group-hover:-translate-y-[${stack}px]`} 
							 onClick={() => onNoteClick(note)} 
							/>
						</div>
					)
				})
			}
			</div>
		</div>
  );
}
