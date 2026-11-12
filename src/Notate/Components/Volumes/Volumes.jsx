import React from 'react';
import { NOTATE_DB } from '@background/background.js'
import { NotateContext } from '@notate/Notate.jsx';
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx';
import NotebookCard from '@universal/Components/NotebookCard.jsx';

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
		.map((notebook, i) => ({ notebook, volume: i + 1 }))
		.filter(({ notebook }) => notebook.title.toLowerCase().includes(searchTerm.toLowerCase())),
		[inventory, searchTerm])

	const handleNotebookClick = (notebook) => {
		if (!selectedNote) {
			setSelectedNotebook(notebook)
			setModalState(true)
		}
	}

	const handleDrop = async (notebook, note) => {
		if (notebook.collection.includes(note.id)) return
		try {
			notebook.collection.push(note.id)
			await makeRequest({
				type: 'POST_DATABASE',
				data: notebook,
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
		<section id="volumes" className="mt-10 xl:mt-12 flex flex-col min-h-0 xl:flex-1 animate-rise" style={{ animationDelay: '800ms' }}>
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
					 inventory={inventory?.NOTES}
					 onNotebookClick={() => handleNotebookClick(notebook)}
					 updatesDispatcher={handleDrop}
					/>
				)) : (
					<p className={`py-4 text-[16px] italic ${theme.text.sub || ""}`}>
						{ searchTerm ? 'No volume matches that search.' : <>No volumes yet. Choose <span className="not-italic smallcaps text-vermilion-ink">+ New</span>, then Notebook.</> }
					</p>
				)}
			</div>
		</section>
	)
}
