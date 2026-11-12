import React from 'react';
import { WebContentContext } from '@content/content.jsx'

// One paper tag of the fan-out menu: a numbered glyph cell, then the label.
export const TAG_CLASS = `
	focus-ink group flex items-stretch h-9 paper-grain border border-ink shadow-print-sm
	font-serif text-ink cursor-pointer transition-[background-color,color,transform] duration-150
	hover:bg-ink hover:text-paper hover:-translate-x-0.5 active:translate-x-0 active:shadow-none
`
export const TAG_GLYPH_CLASS = `
	flex items-center justify-center w-9 border-r border-current font-serif text-[17px] leading-none
`
export const TAG_LABEL_CLASS = `smallcaps flex items-center px-3 whitespace-nowrap`


/**
 * Expects the following props:
 * @param 'modal': Component that will be passed to Modal.jsx
 * @param 'callerId': assigned to the 'id' attr
 * @param 'infoMessage': Label of the tag
 * @param 'icon' : Typographic glyph shown in the tag's first cell.
 * 	
 * This component stores the expected modal component that is passed to 
 * Modal.jsx when clicked. 
*/
export default function ContextItem({
	modal: modal,
	callerId: callerId,
	infoMessage: infoMessage,
	icon: icon,
}){
	const { MODAL_STATE_CONTEXT } = React.useContext(WebContentContext)
	const [ ,setSelectedModal ] = MODAL_STATE_CONTEXT

	const [ itemSelected, setItemSelected ] = React.useState(false)


	const handleEventDelegation = (e) => {
		setItemSelected(true)
		setSelectedModal(modal)
	}


	return (
			<button 
			 id={`context-item-${callerId}`}
			 className={TAG_CLASS}
			 onClick={handleEventDelegation}
			>
				<span id="svg-icon" aria-hidden="true" className={TAG_GLYPH_CLASS}>
					{icon}
				</span>
				<label id="info-msg" className={`${TAG_LABEL_CLASS} cursor-pointer`}>
				{infoMessage}
				</label>	
			</button>	
	)
}
