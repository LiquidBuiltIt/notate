import React from 'react';
import browser from 'webextension-polyfill'
import SaveNotebookButton from './SaveNotebookButton.jsx'
import DeleteNotebookButton from './DeleteNotebookButton.jsx'
import { NotateContext } from '@notate/Notate.jsx'
import { NotebookModalContext } from '../NotebookModal.jsx'
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx'
import { notebookExport, download } from '@notate/exportNotes.js'


export default function BottomBar() {
	const { NOTEBOOK_CONTEXT, NOTATE_DB_CONTEXT } = React.useContext(NotateContext)
	const [ notebook ] = NOTEBOOK_CONTEXT
	const [ database ] = NOTATE_DB_CONTEXT
	const { TITLE_CONTEXT, DESCRIPTION_CONTEXT, COLLECTION_CONTEXT } = React.useContext(NotebookModalContext)
	const [ notification, setNotification ] = React.useContext(NotificationContext)

	// A new notebook has nothing saved to export, so the button is greyed like Delete is hidden.
	const handleExportClick = () => {
		try {
			const { name, text } = notebookExport({ ...notebook, title: TITLE_CONTEXT[0], description: DESCRIPTION_CONTEXT[0], collection: COLLECTION_CONTEXT[0] }, database?.inventory?.NOTES ?? [], browser.runtime.id)
			download(name, new Blob([text], { type: 'text/markdown' }))
		} catch (error) {
			console.error('Error exporting notebook:', error)
			setNotification(notification.showError())
		}
	}

	return (
		<div id="notebook-modal-bottombar"
		className="shrink-0 flex items-center gap-6 mt-4 pt-4 border-t border-ink">
			<SaveNotebookButton/>
			<div className="ml-auto flex items-center gap-6">
				<button id="export-notebook-btn"
				className={`smallcaps focus-ink trans-ease whitespace-nowrap pb-1 border-b ${ notebook.id ? "border-ink text-ink hover:text-vermilion-ink hover:border-vermilion" : "border-paper-edge text-ink-faint cursor-not-allowed" }`}
				onClick={handleExportClick}
				disabled={!notebook.id}>
					Export notebook
				</button>
				{ !!notebook.id && <DeleteNotebookButton/> }
			</div>
		</div>
	)
}
