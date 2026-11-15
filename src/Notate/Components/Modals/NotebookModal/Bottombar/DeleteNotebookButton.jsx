import React from 'react';
import { NOTATE_DB, ERROR_LOGGING_DB, USER_CONFIGURATION_DB } from '@background/background.js'
import { NotebookModalContext } from '../NotebookModal.jsx'
import { NotateContext } from '@notate/Notate.jsx'
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx'

import ConfirmationMsgHandler from '../../ConfirmationModal/ConfimrationMsgHandler.js'
import ConfirmationMsg, {ConfirmationMsgContext} from '../../ConfirmationModal/ConfirmationMsg.jsx'


export default function DeleteNotebookButton() {
	const { REQUEST_CONTEXT, NOTEBOOK_CONTEXT } = React.useContext(NotateContext)
	const [ notebook ] = NOTEBOOK_CONTEXT
	const [ request, makeRequest ] = REQUEST_CONTEXT 
	

	const { STATUS_CONTEXT, EXIT_MODAL } = React.useContext(NotebookModalContext)

	const [ status, setStatus ] = STATUS_CONTEXT

	const [ confMsgState, setConfMsgState ] = React.useContext(ConfirmationMsgContext)
	const [ notification, setNotification ] = React.useContext(NotificationContext)

	const performDeleteAction = async () => {
		await makeRequest({ 
			type: 'DELETE_DATABASE', 
			data: notebook, 
			store: 'NOTEBOOKS', 
			database: NOTATE_DB
		})

		await EXIT_MODAL()
		setNotification(notification.showInfo('Notebook Deleted'))
	
	}

	const handleDeleteClick = () => {
		let warn;
		const title = "Delete Notebook?"
		const message = "The notebook goes, but its notes stay in your Recents."
		const actionName = "Delete"

		setStatus(false)

		const cancelCallback = () => { setStatus(true) }


		setConfMsgState(new ConfirmationMsgHandler(title, message, actionName, performDeleteAction, false, cancelCallback ))	


	}

	return (
		<button id="delete-notebook-btn"
		className="smallcaps focus-ink trans-ease ml-auto whitespace-nowrap pb-1 border-b border-ink text-ink hover:text-vermilion-ink hover:border-vermilion"
		onClick={handleDeleteClick}>
			Delete notebook
		</button>
	)
}
