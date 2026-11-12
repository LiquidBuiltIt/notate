import React from 'react';
import { ModalControllerContext } from '../Modal.jsx'
import { WebContentContext } from '@content/content.jsx'

import Topbar from './Topbar.jsx'
import NotebookCollection from './NotebookCollection.jsx'
import Bottombar from './Bottombar.jsx'

export default function AddToNotebookModal() {
	const { RELATED_NOTES_CONTEXT } = React.useContext(WebContentContext)
	const [ headerState, setHeaderState ] = RELATED_NOTES_CONTEXT 

	const { 
		TRANSITION, 
		WHITELISTED, } = React.useContext(ModalControllerContext)
	const [ isActive, setIsActive ] = TRANSITION 
	const [ , setWhitelisted ] = WHITELISTED




	React.useEffect(()=> {
		setIsActive(true)
		setHeaderState(true)
		setWhitelisted(["related-notes-viewer"])
	}, [])

	return (
		<div
		 id="add-to-notebook-modal"
		 className={`
			trans-ease-all fixed bottom-0 h-[70%] md:w-[70%] w-[95%]
			flex flex-col pt-[1.25rem] pb-[1rem] px-[2rem] space-y-[1rem]
			paper-grain border border-b-0 border-ink shadow-print-lg
			font-serif text-ink pointer-events-auto
			${ isActive ? "translate-y-[0%]" : "translate-y-[100%]" }
		`}
		>
			<header id="modal-topbar" className={`flex-shrink w-full`}>
				<Topbar/>
			</header>
			<main 
			 id="modal-centerpiece" 
			 className={`
			 	flex w-full flex-grow min-h-0 border-y border-paper-edge bg-paper-deep/50
			`}>
				<NotebookCollection/>	
			</main>
			<footer id="modal-bottombar">
				<Bottombar/>
			</footer>
		</div>
	)
}
