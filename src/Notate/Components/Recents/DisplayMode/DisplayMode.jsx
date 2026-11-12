import React from 'react';
import { RecentNotesContext } from './../RecentNotes.jsx'
import { NotateContext } from '@notate/Notate.jsx';
import NoteCard from '@universal/Components/NoteCard.jsx';
import { NoItemsFound, EmptyRecentsContent } from './Displays.jsx'


export default function DisplayMode() {
	const { NOTATE_DB_CONTEXT } = React.useContext(NotateContext)
	const [ database ] = NOTATE_DB_CONTEXT 

	const { SORTED_ITEMS_CONTEXT, 
		ACTIVE_SEARCH_CONTEXT, 
		NOTE_LIST_CONTEXT, 
		NOTEBOOK_LIST_CONTEXT, 
		SEARCH_TERM_CONTEXT,
		FUNCTIONS } = React.useContext(RecentNotesContext)

	const [ noteList ] = NOTE_LIST_CONTEXT
	const [ notebookList ] = NOTEBOOK_LIST_CONTEXT
	const [ searchTerm ] = SEARCH_TERM_CONTEXT
	const [ sortedItemsNotEmpty, setSortedItemsState ] = SORTED_ITEMS_CONTEXT
	const [ activeSearch, setActiveSearch ] = ACTIVE_SEARCH_CONTEXT


	const [ sortedNotes, setSortedNotes ] = React.useState([])
	const [ sortedNotebooks, setSortedNotebooks ] = React.useState([])


	const filterItems = (notes, notebooks) => {
		const results = {
			note: [],
			notebook: []
		}

		if (notes) results.note = notes.filter(
			(note) => note.title.toLowerCase().includes(searchTerm.toLowerCase())
		);
		
		if (notebooks) results.notebook = notebooks.filter(
			(notebook) => notebook.title.toLowerCase().includes(searchTerm.toLowerCase())
		);
		
		return results
	}

	const sortItems = (notes, notebooks) => {
		const results = {
			note: [],
			notebook: []
		}

		if (notes) {
			
			const sortedNotes = notes.sort((noteA, noteB) => {
				const dateA = new Date(noteA.modified)
				const dateB = new Date(noteB.modified)
				return dateB - dateA
  			})

			results.note = sortedNotes
		}

		if (notebooks) {
  			
			const sortedNotebooks = notebooks.sort((bookA, bookB) => {
				const dateA = new Date(bookA.modified)
				const dateB = new Date(bookB.modified)
				return dateB - dateA
  			}) 

			results.notebook = sortedNotebooks
		}

		return results
	}


	const removeNoteCardsFromRender = (noteList, notebookList) => {
		if (noteList && notebookList) {
			const noteCardDupesExtractedFromCollections = []

			notebookList.forEach(notebook => notebook.collection.forEach(
				id => noteCardDupesExtractedFromCollections.push(id)) 
			)

			const dupeFreeNoteList = noteList.filter(
				note => !noteCardDupesExtractedFromCollections.includes(note.id)
			)

			return dupeFreeNoteList

		} else return [] 

	}


	// First useEffect hook ran to initialize component. Populates item list hooks
	// and sets the sortedItemsNotEmpty && activeSearch booleans.
	React.useEffect(()=>{
		const results = sortItems(noteList, notebookList)

		const dupeFreeNoteList = removeNoteCardsFromRender(results?.note, results?.notebook)


		if (dupeFreeNoteList) setSortedNotes(dupeFreeNoteList)
		if (results?.notebook) setSortedNotebooks(results.notebook)

		const sortedBoolean = sortedNotes.length > 0
		setSortedItemsState(sortedBoolean)

		const activeSearchBoolean = searchTerm !== ''
		setActiveSearch(activeSearchBoolean)	

	},[noteList, notebookList])



	// Second useEffect hook to run that is responsible for updating the 
	// sortedItemsNotEmpty && activeSearch booleans. All re-renders are only triggerred when
	// re-sorting the item list hooks
	React.useEffect(()=>{
  		// These booleans are used to compare what should be displayed within the #recent-notes-container
  		// section. If there are no notes/notebooks and no active search term, the EmptyRecentsContent Component
  		// displays, NoItemsFound Component if there is an active search term but no items returned, and the items 
  		// in all other cases.
		//
		const sortedBoolean = sortedNotes.length > 0
		setSortedItemsState(sortedBoolean)

		const activeSearchBoolean = searchTerm !== ''
		setActiveSearch(activeSearchBoolean)	
		
	}, [sortedNotes, sortedNotebooks])



	// Third useEffect hook to run that updates the item lists && display booleans
	// to filter the item lists based on the search term. Otherwise returning the 
	// originally provided item list sets. All re-renders triggered only when searchTerm 
	// updates.
	React.useEffect(()=>{
		if (searchTerm !== '') {
			const filterResults = filterItems(noteList, notebookList)
			const sortResults = sortItems(filterResults.note, filterResults.notebook)


			setSortedNotes(sortResults.note)
			setSortedNotebooks(sortResults.notebook)
		} else {
			const dupeFreeNoteList = removeNoteCardsFromRender(noteList, notebookList)

			setSortedNotes(dupeFreeNoteList)
			setSortedNotebooks(notebookList)
		}
	},[searchTerm])



	return (
		
    		<div id="recent-notes-container" 
	  	className="w-full">
			{
				sortedItemsNotEmpty ? (
					<div id="recent-notes-grid" 
					className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-6 gap-y-10 items-start">
						{
							sortedNotes.map((note, index) => {
								return (
									<div key={index} 
									 className="animate-rise min-w-0 [&:nth-child(even)]:mt-6"
									 style={{ animationDelay: `${Math.min(index, 11) * 40 + 120}ms` }}>
										<NoteCard 
										 note={note} 
										 onClick={() => FUNCTIONS.HANDLE_NOTE_CLICK(note)}
										/> 
									</div>
								)
							})
						}
					</div>
				) : ( activeSearch ? <NoItemsFound/> : <EmptyRecentsContent filed={notebookList.length > 0}/> ) 
			}
    		</div>
	)
}
