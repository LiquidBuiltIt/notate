import React from 'react'
import { ContextMenuHoverRegionContext } from '@content/Components/HoverRegions/ContextMenuHoverRegion.jsx'
import ContextItem from './ContextItem.jsx'
import NewNoteButton from './Buttons/NewNoteButton.jsx' 
import DismissButton from './Buttons/DismissButton.jsx'

import AddToNotebookModal from '@content/Components/Modals/AddToNotebookModal/AddToNotebookModal.jsx'
import SettingsModal from '@content/Components/Modals/SettingsModal/SettingsModal.jsx'


/**
 * Root component for the content script's Context Menu. Stores
 * menu items as objects in the 'items' array that is supplied to
 * the ContextItem component. The tags fan out above the seal.
 */
export default function ContextMenu(){
	const items = [{
		name: 'add-to-notebook',
		desc: 'Add to your Notebooks',
		modal: (<AddToNotebookModal/>),
		icon: '§',
	},{
		name: 'settings',
		desc: 'Settings',
		modal: (<SettingsModal/>),
		icon: '†',

	}]

	const { CONTEXT_MENU_CONTEXT } = React.useContext(ContextMenuHoverRegionContext)
	const [ contextMenuState, setContextMenuState ] = CONTEXT_MENU_CONTEXT

	// New note, the items, then dismiss. The tag nearest the seal appears first.
	const tags = [
		<NewNoteButton key="new-note"/>,
		...items.map( (item) => (
			<
			 ContextItem
			 key={item.name}
			 modal={item.modal}
			 callerId={item.name}
			 infoMessage={item.desc}
			 icon={item.icon}
			/>	
		)),
		<DismissButton key="dismiss"/>
	]

	return (
		<div 
		 id="context-menu" 
		 className={`
		 	absolute right-3.5 bottom-[calc(50%+2.1rem)] w-max
			flex flex-col items-end gap-2 font-serif text-ink
			${ contextMenuState ? "" : "pointer-events-none" }
		`}>
		{tags.map( (tag, i) => (
			<div
			 key={tag.key}
			 style={{ transitionDelay: contextMenuState ? `${(tags.length - 1 - i) * 50}ms` : '0ms' }}
			 className={`
				transition-[opacity,transform] duration-300 ease-out
				${ contextMenuState ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none" }
			`}>
				{tag}
			</div>
		))}
		</div>	
	)
}
