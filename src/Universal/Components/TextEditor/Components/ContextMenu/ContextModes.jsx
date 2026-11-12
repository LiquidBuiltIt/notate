import React, { useContext } from 'react'
import { ContextMenuStateContext } from './ContextMenu.jsx'
import { NormalModeCmds, SelectionModeCmds } from './ContextModeCmds.js'


export function NormalMode() {
	const [ active, setActive ] = useContext(ContextMenuStateContext)	

	const consumeAction = (action) => {
		action()	
		setActive(false)
	}


	return (
		<li 
		 id="normal-mode"
		 className="flex flex-col"
		>
		{NormalModeCmds.map( (cmd, id) => {
			return (
				<button
				 key={id}
				 id={cmd.type}
				 onClick={()=> consumeAction(cmd.action)}
				 className={`
				 	focus-ink smallcaps w-full h-[2rem] px-3 flex items-center justify-start 
					text-left text-ink cursor-default border-b border-paper-edge
					transition duration-150 ease-out hover:bg-ink hover:text-paper
				`}>
				{cmd.name}
				</button>
			)
		})}
		</li>
	)
}



export function SelectionMode() {
	const [ active, setActive ] = useContext(ContextMenuStateContext)	

	const consumeAction = (action) => {
		action()	
		setActive(false)
	}

	return (
		<li 
		 id="selection-mode"
		 className="flex flex-col border-t border-ink"
		>
		{SelectionModeCmds.map( (cmd, id) => {
			return (
				<button
				 key={id}
				 id={cmd.type}
				 onClick={()=> consumeAction(cmd.action)}
				 className={`
				 	focus-ink smallcaps w-full h-[2rem] px-3 flex items-center justify-start 
					text-left text-ink cursor-default border-b border-paper-edge
					transition duration-150 ease-out hover:bg-ink hover:text-paper
				`}>
				{cmd.name}
				</button>
			)
		})}
		</li>
	)
}
