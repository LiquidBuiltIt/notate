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

	const [ notebooks, setNotebooks ] = React.useState([])
	const [ isEmpty, setIsEmpty ] = React.useState(false)

	const handleNoteDrop = (notebook, note) => {
		try {
			const id = note.id
			const dupe = notebook.collection.some( (item) => item === id )

			if (!dupe) {
				notebook.collection.push(id)
				add2Queue(queue => ([...queue, notebook]))
			}
		} catch(error) {

		}
	}


	React.useEffect(()=>{
		const asyncProcessor = async () => {
			if (notatedb.inventory) {
				const inventory = notatedb.inventory

				setNotebooks(inventory.NOTEBOOKS)

			} 
		}

		asyncProcessor()
	},[notatedb])

	React.useEffect(()=>{
		setIsEmpty(notebooks.length <= 0)
	},[notebooks])

	return (
		<main 
		 id="notebook-collection" 
		 className={`
		 	flex items-center  space-x-[1rem] 
			${ isEmpty ? "justify-center" : "" }
			overflow-x-auto px-[1rem] flex-grow
		`}>

		{isEmpty ? <NoNotebooksFound/> 
		: notebooks.map( (notebook, key) => {
			return (
				<
				 NotebookCard
				 key={key}
				 notebook={notebook}
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
