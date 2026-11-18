import React from 'react'

import { WebContentContext } from '@content/content.jsx'
import { fromOurUI } from '@universal/Utils/trusted.js'


export const ModalControllerContext = React.createContext()


const MODAL_CONTAINER_ID = "modal-container"



/**
 * Expects following props:
 * @param 'modal': Modal component to be mounted
 *
 * Root component & main controller for all modals in the content script
 * context. Centralizes app event handling for all modals in content.jsx.
 */
export default function Modal({modal}) {
	const { 
		MODAL_STATE_CONTEXT, 
		SHADOW_ROOT_ELEMENT, 
		NOTE_WINDOW_CONTEXT,
		CONTEXT_MENU_CONTEXT,
		NOTATE_DB_CONTEXT,
		USER_CONFIGURATION_DB_CONTEXT,
		REQUEST_CONTEXT
		} = React.useContext(WebContentContext)
	const [ modalState, setModalState ] = MODAL_STATE_CONTEXT
	const [ shadow ] = SHADOW_ROOT_ELEMENT
	const [ noteWindowState, setNoteWindowState ] = NOTE_WINDOW_CONTEXT
	const [ contextMenuState, setContextMenuState ] = CONTEXT_MENU_CONTEXT

	const MODAL_CONTROLLER_CONTEXT = {
		TRANSITION: React.useState(false),
		WHITELISTED: React.useState([]),
		QUEUE: React.useState([]),
		NOTATE_DB: NOTATE_DB_CONTEXT,
		USER_CONFIGURATION_DB: USER_CONFIGURATION_DB_CONTEXT,
		REQUEST: REQUEST_CONTEXT
	}

	const [ transition, setTransition ] = MODAL_CONTROLLER_CONTEXT.TRANSITION 


	const exitModal = () => {
		setTransition(false)
		setTimeout(()=> setModalState(false), 400)

	}

	MODAL_CONTROLLER_CONTEXT.EXIT_MODAL = exitModal


	const handleContainerClick = (event) => {
		if (!event.isTrusted) return

		// A real click outside our own UI closes the modal. A page cannot fake being inside by giving an element our id.
		if (!fromOurUI(event, shadow)) {
			event.preventDefault()
			exitModal()
		}
	}


	React.useEffect(()=>{
		document.addEventListener('click', handleContainerClick)

		return () => document.removeEventListener('click', handleContainerClick)
	},[])


	React.useEffect(()=>{
		if (modalState) {
			setContextMenuState(false)
		}
	}, [modalState])
	

	React.useEffect(()=> {
		setTransition(true)
	},[])


	return (
		<div
		 id={MODAL_CONTAINER_ID}
		 className={`
			 trans-ease-all fixed left-0 top-0 flex flex-col
			 w-full h-full bg-paper z-[90] font-serif text-ink
			 ${ transition ? "bg-opacity-60" : "bg-opacity-0" }
			 items-center justify-center pointer-events-none
		`}>
		<ModalControllerContext.Provider value={MODAL_CONTROLLER_CONTEXT}>
			{modal}
		</ModalControllerContext.Provider>
		</div>
	)
}
