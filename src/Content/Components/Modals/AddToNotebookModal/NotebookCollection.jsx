import React from 'react'
import { ModalControllerContext } from '@content/Components/Modals/Modal.jsx'
import NotebookCard from '@universal/Components/NotebookCard.jsx'

const NOTATE_DB = "notate"
const ERROR_LOGGING_DB = "errorLogging"
const USER_CONFIGURATION_DB = "userConfiguration"


export default function NotebookCollection() {
	const { REQUEST, NOTATE_DB, QUEUE } = React.useContext(ModalControllerContext)
	const [ queue, add2Queue ] = QUEUE
	const [ response, makeRequest ] = REQUEST 
	const [ notatedb ] = NOTATE_DB

	const notebooks = React.useMemo(() => (notatedb?.inventory?.NOTEBOOKS ?? []).slice().sort((a, b) => a.id - b.id), [notatedb])
	const isEmpty = notebooks.length <= 0

	// Drops are queued as a copy of the notebook with the note added; Save writes the queue.
	const handleNoteDrop = (notebook, note) => {
		const queued = queue.find( (item) => item.id === notebook.id )
		const current = queued ?? notebook

		if (!current.collection.includes(note.id)) {
			const updated = { ...notebook, collection: [...current.collection, note.id] }
			add2Queue(queue => ([...queue.filter( (item) => item.id !== notebook.id ), updated]))
		}
	}

	const pendingFor = (notebook) => {
		const queued = queue.find( (item) => item.id === notebook.id )
		return queued ? queued.collection.length - notebook.collection.length : 0
	}

	return (
		<main 
		 id="notebook-collection" 
		 className={`
		 	flex flex-col w-full flex-grow min-h-0 overflow-y-auto px-[1rem]
			${ isEmpty ? "justify-center items-center" : "" }
		`}>

		{isEmpty ? <NoNotebooksFound/> 
		: notebooks.map( (notebook, key) => {
			return (
				<
				 NotebookCard
				 key={notebook.id}
				 notebook={notebook}
				 volume={key + 1}
				 inventory={notatedb?.inventory?.NOTES}
				 pending={pendingFor(notebook)}
				 updatesDispatcher={handleNoteDrop}
				/>	
			)
		})}
		</main>
	)
}

function NoNotebooksFound() {
	return (
		<section 
		 id="no-notebooks-found-help-msg" 
		 className={`
		 	text-ink-soft text-center font-serif
			flex flex-col space-y-2
		`}>
			<label className="font-display italic font-semibold text-[1.25rem] text-ink">
			{`You have no notebooks yet... \n`}
			</label>
			<label className="italic text-[15px]">
			{`Go back to your Notate page to create one!`}
			</label>
		</section>
	)
}
