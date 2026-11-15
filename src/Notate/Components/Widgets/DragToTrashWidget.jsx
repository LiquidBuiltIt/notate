import React from 'react';
import { NOTATE_DB, ERROR_LOGGING_DB, USER_CONFIGURATION_DB } from '@background/background.js'

import ConfirmationMsg, { ConfirmationMsgContext } from '../Modals/ConfirmationModal/ConfirmationMsg.jsx'
import ConfirmationMsgHandler from '../Modals/ConfirmationModal/ConfimrationMsgHandler.js'
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx'
import { NotateContext } from '@notate/Notate.jsx'

let RECENT_NOTES_ELEMENT




export const DragToTrashStateContext = React.createContext()


export default function DragToTrashHandler() {
	const { NOTE_CONTEXT, SCROLL_STATE_CONTEXT, REQUEST_CONTEXT, DRAG_TO_TRASH_STATE_CONTEXT } = React.useContext(NotateContext)
	const [ note, setNote ] = NOTE_CONTEXT
	const [ scrollState, setScrollState ] = SCROLL_STATE_CONTEXT 
	const [ request, makeRequest ] = REQUEST_CONTEXT
	// Shared with the search bar: while true the bar tucks away and the trash rises.
	const [ hoverState, setHoverState ] = DRAG_TO_TRASH_STATE_CONTEXT


	const [ confMsgState, setConfMsgState ] = React.useContext(ConfirmationMsgContext)
	const [ notification, setNotification ] = React.useContext(NotificationContext)

	const [ selfState, setSelfState ] = React.useState(false)
	const zoneRef = React.useRef(null)
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
		setSelfState(false)
		setDeleteHoverState(false)
		setTarget(false)
	}


	const handleDeleteAction = (e) => {
		e.preventDefault()

		const item = JSON.parse(e.dataTransfer.getData("text/plain"))
		const noun = target === 'NOTEBOOKS' ? 'notebook' : 'note'
		const message = `Are you sure you want to delete this ${noun}? This is a permanent action!`

		setSelfState(false)
		setDeleteHoverState(false)
		setHoverState(false)

		const deleteAction = async () => {
			await makeRequest({ 
				type: 'DELETE_DATABASE', 
				data: item, 
				store: target, 
				database: NOTATE_DB 
			})

			setNotification(notification.showInfo(`${noun === 'note' ? 'Note' : 'Notebook'} Deleted!`))
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

	// "Near" is the pointer being inside the trash region, which takes no events of its own.
	React.useEffect(()=>{
		if (!hoverState) return

		const handleOver = (e) => {
			const box = zoneRef.current?.getBoundingClientRect()
			setSelfState(!!box && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom)
		}

		window.addEventListener('dragover', handleOver)
		return () => window.removeEventListener('dragover', handleOver)
	},[hoverState])

	return (
		<div id="drag-to-trash-event-listener"
			className="fixed flex flex-col left-0 w-full items-center">
			<div id="drag-to-trash-hover-region"
				ref={zoneRef}
				aria-hidden="true"
				className={`trash-zone ${ hoverState ? "on" : "" } ${ deleteHoverState ? "over" : "" }`}>

				<div className="trash-box">
					<div id="drag-to-trash-handler" 
						className="relative h-full"
						onDragOver={(e) => {e.preventDefault() ;setDeleteHoverState(true)}}
						onDragLeave={() => setDeleteHoverState(false)}
						onDrop={handleDeleteAction}
					>
						<div id="external" 
							className={`trans-ease-all absolute inset-0 translate-x-2 translate-y-2 bg-ink ${ deleteHoverState ? "opacity-100" : "opacity-0" } `}></div>
						<div id="internal" 
							className={`
								trash-slip flex items-center justify-center gap-3 hairline
								${ deleteHoverState ? "bg-vermilion text-paper" : ( selfState ? "paper-grain text-ink" : "paper-grain text-ink-soft" ) }
							`}>
							<span className="font-display italic text-[28px] leading-none" aria-hidden="true">&times;</span>
							<span className="smallcaps">{ deleteHoverState ? "Release to delete" : "Drag here to delete" }</span>
							<span className="trash-draw"/>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
