import React from 'react';
import { NOTATE_DB, ERROR_LOGGING_DB, USER_CONFIGURATION_DB } from '@background/background.js'

import ConfirmationMsg, { ConfirmationMsgContext } from '../Modals/ConfirmationModal/ConfirmationMsg.jsx'
import ConfirmationMsgHandler from '../Modals/ConfirmationModal/ConfimrationMsgHandler.js'
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx'
import { NotateContext } from '@notate/Notate.jsx'

let RECENT_NOTES_ELEMENT




export const DragToTrashStateContext = React.createContext()


export default function DragToTrashHandler() {
	const { NOTE_CONTEXT, SCROLL_STATE_CONTEXT, REQUEST_CONTEXT } = React.useContext(NotateContext)
	const [ note, setNote ] = NOTE_CONTEXT
	const [ scrollState, setScrollState ] = SCROLL_STATE_CONTEXT 
	const [ request, makeRequest ] = REQUEST_CONTEXT


	const [ confMsgState, setConfMsgState ] = React.useContext(ConfirmationMsgContext)
	const [ notification, setNotification ] = React.useContext(NotificationContext)

	const [ selfState, setSelfState ] = React.useState(false)
	const [ hoverState, setHoverState ] = React.useState(false)
	const [ deleteHoverState, setDeleteHoverState ] = React.useState(false)
	const [ target, setTarget ] = React.useState(false)



	const handleDragStart = (e) => {
		const element = e.target.id

		if (element && element.includes("note-card")) {
			const note = e.target.id
			setHoverState(true)
			setTarget('NOTES')

		} else if (element.includes("notebook-card")) {
			const notebook = e.target.id
			setHoverState(true)
			setTarget('NOTEBOOKS')
		}

	}

	const handleDragEnd = (e) => {
		e.preventDefault()
		setHoverState(false)
		setTarget(false)
	}


	const handleDeleteAction = (e) => {
		e.preventDefault()

		const item = JSON.parse(e.dataTransfer.getData("text/plain"))
		const message = 'Are you sure you want to delete this note? This is a permanent action!'

		setSelfState(false)
		setDeleteHoverState(false)

		const deleteAction = async () => {
			await makeRequest({ 
				type: 'DELETE_DATABASE', 
				data: item, 
				store: target, 
				database: NOTATE_DB 
			})

			setNotification(notification.showInfo('Note Deleted!'))
		}

		setConfMsgState(new ConfirmationMsgHandler('Delete Item?',
								message,
								'Delete',
								deleteAction,
								))
	}
	

	React.useEffect(()=>{
		// Notes live in the recents, notebooks in the volumes list.
		for (const id of ["recent-notes", "volumes"]) {
			const element = document.getElementById(id)

			if (element) {
				element.addEventListener("dragstart", handleDragStart)
				element.addEventListener("dragend", handleDragEnd)
			}
		}
	},[])

	return (
		<div id="drag-to-trash-event-listener"
			className="fixed flex flex-col left-0 w-full items-center">
			{
				hoverState && (
					<div id="drag-to-trash-hover-region" 
						className="fixed bottom-0 flex items-end justify-center w-[34rem] max-w-full h-[14rem] pb-8"
						onDragOver={ () => setSelfState(true) }
						onDragLeave={ () => setSelfState(false) }>

						<div id="drag-to-trash-handler" 
							className="relative w-full"
							onDragOver={(e) => {e.preventDefault() ;setDeleteHoverState(true)}}
							onDragLeave={() => setDeleteHoverState(false)}
							onDrop={handleDeleteAction}
					>
							<div id="external" 
								className={`trans-ease-all absolute inset-0 translate-x-2 translate-y-2 bg-ink ${ deleteHoverState ? "opacity-100" : "opacity-0" } `}></div>
							<div id="internal" 
								className={`
									trans-ease-all relative flex items-center justify-center gap-3 h-24 hairline animate-rise
									${ deleteHoverState ? "bg-vermilion text-paper" : ( selfState ? "paper-grain text-ink" : "paper-grain text-ink-soft opacity-80" ) }
								`}>
								<span className="font-display italic text-[28px] leading-none" aria-hidden="true">&times;</span>
								<span className="smallcaps">{ deleteHoverState ? "Release to delete" : "Drag here to delete" }</span>
							</div>
						</div>

					</div>
				)
			}

		</div>
	)
}
