import React from 'react';
import { NOTATE_DB, ERROR_LOGGING_DB, USER_CONFIGURATION_DB } from '@background/background.js'
import { NotebookModalContext } from '../NotebookModal.jsx'
import { NotateContext } from '@notate/Notate.jsx'
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx'

export default function SaveNotebookButton() {
	const { NOTEBOOK_CONTEXT, REQUEST_CONTEXT } = React.useContext(NotateContext)
	const [ notebook, setNotebook ] = NOTEBOOK_CONTEXT
	const [ request, makeRequest ] = REQUEST_CONTEXT 

	const { TITLE_CONTEXT, DESCRIPTION_CONTEXT, COLLECTION_CONTEXT, EXIT_MODAL } = React.useContext(NotebookModalContext)
	const [ title, setTitle ] = TITLE_CONTEXT
	const [ description, setDescription ] = DESCRIPTION_CONTEXT
	const [ collection, setCollection ] = COLLECTION_CONTEXT

	const [ notification, setNotification ] = React.useContext(NotificationContext)


	const initialNotebookState = React.useRef({
		title: notebook?.title || '',
		description: notebook?.description || '',
		collection: notebook?.collection || []
	})

	
	const handleSaveClick = async () => {
		try {
			notebook.title = title
			notebook.description = description
			notebook.collection = collection
			setNotification(notification.showInfo('Notebook Saved'))
			// An existing notebook patches only what the editor owns, so a frame position saved from the board meanwhile is kept.
			await makeRequest(notebook.id
				? { type: 'PATCH_DATABASE', id: notebook.id, data: { title, description, collection: { $add: collection.filter(id => !initialNotebookState.current.collection.includes(id)), $remove: initialNotebookState.current.collection.filter(id => !collection.includes(id)) } }, store: 'NOTEBOOKS', database: NOTATE_DB }
				: { type: 'POST_DATABASE', data: notebook, store: 'NOTEBOOKS', database: NOTATE_DB })
			await EXIT_MODAL()
		} catch (e) {
			console.error(`Error saving notebook: ${e}`)
			setNotification(notification.showError())
		}

		
	}


	const collectionChanged = () => {
    		if (!notebook.id) return true; // New notebook, always allow save
    		const initialCollection = notebook.collection || [];
    		return JSON.stringify(initialCollection) !== JSON.stringify(collection);
	};

	const notebookChanged = title !== initialNotebookState.current.title || 
                        description !== initialNotebookState.current.description ||
                        collectionChanged();
	
	const valuesNotEmpty = title.trim() !== '' && description.trim() !== '';
	const isExistingNotebook = !!notebook.id;
	const permittedToSave = (isExistingNotebook ? notebookChanged : valuesNotEmpty);

	// Removals are staged with the x buttons: show how many Save will apply.
	const removed = (notebook.collection ?? []).filter(id => !collection.includes(id)).length

	return (
		<button id="save-notebook-button"
		className={`smallcaps focus-ink trans-ease h-12 px-10 ${ permittedToSave ? "bg-ink text-paper hover:bg-vermilion" : "bg-transparent hairline text-ink-faint cursor-not-allowed" }`}
		onClick={handleSaveClick}
		disabled={!permittedToSave}>Save{ removed > 0 && ` · ${removed} removed` }</button>
	)
}
