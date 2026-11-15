import React from 'react';
import { NOTATE_DB } from '@background/background.js'
import { NotateContext } from '@notate/Notate.jsx';
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx';
import NotebookCard from '@universal/Components/NotebookCard.jsx';
import { tokensOf, volumeMatches } from '@notate/Components/Search/matching.js';

// The notebooks, as a table of contents under the masthead. Volume numbers follow creation order.
export default function Volumes() {
	const { NOTATE_DB_CONTEXT, NOTE_CONTEXT, NOTEBOOK_CONTEXT, MODAL_STATE_CONTEXT, REQUEST_CONTEXT, SEARCH_TERM_CONTEXT, RECENT_NOTES_STATE_CONTEXT, THEME_CONTEXT } = React.useContext(NotateContext)
	const [ database ] = NOTATE_DB_CONTEXT
	const [ selectedNote ] = NOTE_CONTEXT
	const [ , setSelectedNotebook ] = NOTEBOOK_CONTEXT
	const [ , setModalState ] = MODAL_STATE_CONTEXT
	const [ , makeRequest ] = REQUEST_CONTEXT
	const [ searchTerm ] = SEARCH_TERM_CONTEXT
	const [ , setUpdateState ] = RECENT_NOTES_STATE_CONTEXT
	const [ notification, setNotification ] = React.useContext(NotificationContext)
	const theme = THEME_CONTEXT

	const inventory = database?.inventory
	const volumes = React.useMemo(() => (inventory?.NOTEBOOKS ?? [])
		.slice().sort((a, b) => a.id - b.id)
		.map((notebook, i) => ({ notebook, volume: i + 1 })),
		[inventory])

	// A search fades the volumes that do not match; it never removes them.
	const tokens = React.useMemo(() => tokensOf(searchTerm), [searchTerm])

	const handleNotebookClick = (notebook) => {
		if (!selectedNote) {
			setSelectedNotebook(notebook)
			setModalState(true)
		}
	}

	const handleDrop = async (notebook, note) => {
		if (notebook.collection.includes(note.id)) return
		try {
			await makeRequest({
				type: 'POST_DATABASE',
				data: { ...notebook, collection: [...notebook.collection, note.id] },
				store: 'NOTEBOOKS',
				database: NOTATE_DB
			})
			setUpdateState(true)
		} catch (e) {
			console.error(`Error making changes: ${e}`)
			setNotification(notification.showError())
		}
	}

	return (
		<section id="volumes" className="mt-10 xl:mt-12 flex flex-col min-h-0 xl:flex-1 max-xl:order-last animate-rise" style={{ animationDelay: '800ms' }}>
			<header className="flex items-baseline justify-between gap-4 pb-2 border-b border-ink">
				<h2 className="smallcaps">Volumes</h2>
				<span className={`text-[14px] italic ${theme.text.sub || ""}`}>Drag a note onto a volume to file it.</span>
			</header>
			<div id="volumes-list" className="min-h-0 xl:min-h-[8rem] xl:flex-1 xl:overflow-y-auto">
				{ volumes.length > 0 ? volumes.map(({ notebook, volume }) => (
					<NotebookCard
					 key={notebook.id}
					 notebook={notebook}
					 volume={volume}
					 tokens={tokens}
					 faded={tokens.length > 0 && !volumeMatches(notebook, inventory?.NOTES, tokens)}
					 inventory={inventory?.NOTES}
					 onNotebookClick={() => handleNotebookClick(notebook)}
					 updatesDispatcher={handleDrop}
					/>
				)) : (
					<p className={`py-4 text-[16px] italic ${theme.text.sub || ""}`}>
						No volumes yet. Type <span className="not-italic smallcaps text-vermilion-ink">/notebook</span> in the search bar.
					</p>
				)}
			</div>
		</section>
	)
}
