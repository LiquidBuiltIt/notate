import React from 'react';
import NotebookInfoSection from './NotebookInfoSection.jsx'
import NotebookCollection from './NotebookCollection/NotebookCollection.jsx'
import Topbar from './Topbar/Topbar.jsx'
import Bottombar from './Bottombar/Bottombar.jsx'
import { NotateContext } from '@notate/Notate.jsx'
import RightSection from './RightSection/RightSection.jsx';
import { data } from 'autoprefixer';

export const ExitModalContext = React.createContext()
export const NotebookModalContext = React.createContext()

export default function NotebookModal() {
	const { NOTEBOOK_CONTEXT, RECENT_NOTES_STATE_CONTEXT, NOTATE_DB_CONTEXT } = React.useContext(NotateContext)
	const [ notebook, setNotebook ] = NOTEBOOK_CONTEXT
	const [ recentNotesState, updateRecentNotesState ] = RECENT_NOTES_STATE_CONTEXT
	const [ database ] = NOTATE_DB_CONTEXT


	//TODO: see if its possible to cram these useState hooks into a single Context.Provider call
	const NOTEBOOK_MODAL_STATE = {
		TITLE_CONTEXT: React.useState(notebook?.title),
		DESCRIPTION_CONTEXT: React.useState(notebook?.description),
		COLLECTION_CONTEXT: React.useState(notebook?.collection),
		STATUS_CONTEXT: React.useState(false),
		EXIT_MODAL: undefined // <- Where exitModal() will be populated  
	}

	const [ status, setStatus ] = NOTEBOOK_MODAL_STATE.STATUS_CONTEXT


	const disableSelectFeatures = (state) => {
		const toBeDisabled = {
			newItemButton: document.getElementById("new-item-btn-container"),
			searchBar: document.getElementById("search-bar-container"),
			dragToTrash: document.getElementById("drag-to-trash-event-listener")
		} 

		Object.values(toBeDisabled).forEach((feature) => { 
			if (state) feature.classList.add('pointer-events-none')
			else feature.classList.remove('pointer-events-none')})

		
	}


	const exitModal = async () => {
		setStatus(false)

		await new Promise (resolve => setTimeout(resolve, 300))
		setNotebook(null)
		disableSelectFeatures(false)

	}

	NOTEBOOK_MODAL_STATE.EXIT_MODAL = exitModal


	//TODO in the future need to decide if these 2 functions 
	//will be utilized for clicking outside of the modal
	const handleOutsideClick = (e) => { if (e.target === e.currentTarget) exitModal() } 


	const handlePreventingEventPropagation = (e) => { e.stopPropagation() }


	React.useEffect(()=>{
		disableSelectFeatures(true)

		if (notebook) setStatus(true)
	},[])

	React.useEffect(()=> {
		if (notebook?.id) {
			const id = notebook.id

			const [ updatedNotebook ] = database.inventory.NOTEBOOKS
				.filter( notebook => notebook.id === id )

			setNotebook(updatedNotebook)
		}
	},[database])


  return (
	<div 
	 id="notebook-modal-container" 
	 className={`
	 	pointer-events-none trans-ease fixed flex items-end justify-center z-modal left-0 top-0 w-full h-full 
		${ status ? "bg-paper/75" : "bg-transparent" }
	 `}
	 onClick={handleOutsideClick}
	>
		<div 
		 id="notebook-modal" 
	  	 className={`
			pointer-events-auto trans-ease flex w-[95%] max-w-[76rem] h-[85%] paper-grain border-x border-t border-ink shadow-print-lg overflow-hidden
			${ status ? "translate-y-[0%]" : "translate-y-full" }
		 `}
	  	 onClick={handlePreventingEventPropagation}
		>

	  	<NotebookModalContext.Provider value={NOTEBOOK_MODAL_STATE}>
	  		<ExitModalContext.Provider value={[exitModal]}>

	  			<NotebookInfoSection/>	
	  			<main id="notebook-modal-main-section"
	  			className="flex flex-col flex-grow min-w-0 h-full overflow-hidden py-5 px-8 gap-3">
	  				<Topbar/>	
 					<NotebookCollection/>
	  				<Bottombar/>
	  			</main>

				<RightSection/>
	  		</ExitModalContext.Provider>
	  	</NotebookModalContext.Provider>
	  	</div>
	</div>
  );
}
