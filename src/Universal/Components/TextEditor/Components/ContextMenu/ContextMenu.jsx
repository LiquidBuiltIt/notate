import React, { useState, useEffect, useContext, useRef } from 'react'
import { createPortal } from 'react-dom'
import { NormalMode, SelectionMode } from './ContextModes.jsx'
import { TEXT_EDITOR_ID } from '../TextInput/TextInput.jsx'
import { ShadowRootContext } from '@universal/Components/TextEditor/TextEditor.jsx'


export const ContextMenuStateContext = React.createContext()


const CONTEXT_MENU_ID = "note-editor-context-menu"

export default function ContextMenu({RefElement}) {
	const [ shadowRootElement ] = useContext(ShadowRootContext)

	const menuRef = useRef(null)

	const [ activated, setActivated ] = useState(false)
	const [ pos, setPos ] = useState({ x: 0, y: 0 })
	const [ root, setRoot ] = useState(null)


	const handleContextMenuAction = (event) => {
		setActivated(false)	
	}


	const handleRightClick = (event) => {
		const target = event.target.closest(`#${TEXT_EDITOR_ID}`)
		const menu = event.target.closest(`#${CONTEXT_MENU_ID}`)
		

		if ( target ) {
			event.preventDefault()

			setPos({ 
				x: event.clientX + window.scrollX, 
				y: event.clientY + window.scrollY
			})

			setActivated(true)
		} else {
			setActivated(false)
		}
	}



	const handleContextMenuUnfocus = (event) => {
		setActivated(false)
	}

	useEffect(()=>{
		setRoot( shadowRootElement || document )
	},[shadowRootElement])

	useEffect(()=>{
		const target = RefElement.current.parentElement

		
		if (target instanceof HTMLElement) {
			target.addEventListener('contextmenu', handleRightClick)	
			
 
			if (activated) target.addEventListener('click', handleContextMenuUnfocus)

			return () => {
				target.removeEventListener('contextmenu', handleRightClick)
				if (activated) target.removeEventListener('click', handleContextMenuUnfocus)
			}
		}

	},[RefElement, activated])

	useEffect(()=>{
		const menu = menuRef?.current

		if (menu && activated) {
			menu.addEventListener('contextmenu', handleContextMenuAction)	
		}	
	},[activated])


	if (!activated) return null

	return  createPortal(
		<ContextMenuStateContext.Provider value={[activated, setActivated]}>
			<menu 
			 id={CONTEXT_MENU_ID}
			 ref={menuRef}
			 className={`
				 fixed flex flex-col  w-[8.5rem]  
				 paper-grain hairline shadow-print-sm rounded-none overflow-hidden
				 font-serif text-ink z-content-script -translate-y-[100%]
			 `}
			 style={{
				 top: `${pos.y}px`,
				 left: `${pos.x}px`
			}}>	
				<NormalMode/>
				{window.getSelection()?.toString() && <SelectionMode/>}
			</menu>
		</ContextMenuStateContext.Provider>,
		root === shadowRootElement ? root : document.body	
	)
}



