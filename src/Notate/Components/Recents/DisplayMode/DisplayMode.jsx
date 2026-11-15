import React from 'react';
import { RecentNotesContext } from './../RecentNotes.jsx'
import { NotateContext } from '@notate/Notate.jsx';
import NoteCard from '@universal/Components/NoteCard.jsx';
import { NoItemsFound, EmptyRecentsContent } from './Displays.jsx'
import { tokensOf, noteMatches, volumeMatches, looseNotes as withoutFiled } from '@notate/Components/Search/matching.js'


export default function DisplayMode() {
	const { SEARCH_TERM_CONTEXT } = React.useContext(NotateContext)
	const [ searchTerm ] = SEARCH_TERM_CONTEXT

	const { NOTE_LIST_CONTEXT, NOTEBOOK_LIST_CONTEXT, FUNCTIONS } = React.useContext(RecentNotesContext)
	const [ noteList ] = NOTE_LIST_CONTEXT
	const [ notebookList ] = NOTEBOOK_LIST_CONTEXT

	const tokens = React.useMemo(() => tokensOf(searchTerm), [searchTerm])

	// Everything below is derived from the stored lists and the term, so a saved edit
	// can never reset the search, and the notes and volumes always agree on a match.
	const looseNotes = React.useMemo(
		() => withoutFiled(noteList, notebookList).sort((a, b) => new Date(b.modified) - new Date(a.modified)),
		[noteList, notebookList]
	)

	const matchedIds = React.useMemo(
		() => new Set(looseNotes.filter(note => noteMatches(note, tokens)).map(note => note.id)),
		[looseNotes, tokens]
	)

	const volumeHit = React.useMemo(
		() => notebookList.some(notebook => volumeMatches(notebook, noteList, tokens)),
		[notebookList, noteList, tokens]
	)

	// "No notes found" is only true when neither the notes nor the volumes match.
	const nothingFound = tokens.length > 0 && matchedIds.size === 0 && !volumeHit

	// Arrow keys move between the cards that match; up from the first one returns to the bar.
	const handleKeys = (event) => {
		const cards = [...event.currentTarget.querySelectorAll('[id^="note-card-"][tabindex="0"]')]
		const i = cards.indexOf(event.target)
		if (i < 0) return

		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
			event.preventDefault()
			;(cards[i + 1] ?? cards[i]).focus()
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
			event.preventDefault()
			if (i > 0) cards[i - 1].focus()
			else document.getElementById('searchInput')?.focus()
		}
	}


	return (
    		<div id="recent-notes-container" 
	  	className="relative w-full">
			{ nothingFound && <NoItemsFound term={searchTerm.trim()} overlay={looseNotes.length > 0}/> }
			{
				looseNotes.length > 0 ? (
					<div id="recent-notes-grid" 
					className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-6 gap-y-10 items-start"
					onKeyDown={handleKeys}>
						{
							looseNotes.map((note, index) => {
								return (
									<div key={note.id} 
									 className="animate-rise min-w-0 [&:nth-child(even)]:mt-6"
									 style={{ animationDelay: `${Math.min(index, 11) * 40 + 120}ms` }}>
										<NoteCard 
										 note={note} 
										 tokens={tokens}
										 faded={tokens.length > 0 && !matchedIds.has(note.id)}
										 onClick={() => FUNCTIONS.HANDLE_NOTE_CLICK(note)}
										/> 
									</div>
								)
							})
						}
					</div>
				) : ( !nothingFound && <EmptyRecentsContent filed={notebookList.length > 0}/> ) 
			}
    		</div>
	)
}
