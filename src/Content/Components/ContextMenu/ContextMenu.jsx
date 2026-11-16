import React from 'react'
import { ContextMenuHoverRegionContext } from '@content/Components/HoverRegions/ContextMenuHoverRegion.jsx'
import ContextItem from './ContextItem.jsx'
import NewNoteButton from './Buttons/NewNoteButton.jsx' 
import DismissButton, { DismissOption, useDismissOptions } from './Buttons/DismissButton.jsx'

import AddToNotebookModal from '@content/Components/Modals/AddToNotebookModal/AddToNotebookModal.jsx'
import SettingsModal from '@content/Components/Modals/SettingsModal/SettingsModal.jsx'


/**
 * Root component for the content script's Context Menu. Stores
 * menu items as objects in the 'items' array that is supplied to
 * the ContextItem component. The tags fan out from the seal, above it
 * in the bottom corners and below it in the top corners.
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

	const { CONTEXT_MENU_CONTEXT, CORNER_CONTEXT } = React.useContext(ContextMenuHoverRegionContext)
	const [ contextMenuState, setContextMenuState ] = CONTEXT_MENU_CONTEXT
	const [ corner ] = CORNER_CONTEXT
	const top = corner.startsWith('top'), left = corner.endsWith('left')

	// Dismiss swaps the other tags for the dismiss options, in the same column.
	const [ dismissOpen, setDismissOpen ] = React.useState(false)
	const dismissOptions = useDismissOptions()
	React.useEffect(() => { if (!contextMenuState) setDismissOpen(false) }, [contextMenuState])

	// New note, the items, then dismiss. The tag nearest the seal appears first.
	const tags = [
		...(dismissOpen
			? [...dismissOptions].reverse().map( (option) => <DismissOption key={option.title} {...option}/> )
			: [
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
			]),
		<DismissButton key="dismiss" open={dismissOpen} onToggle={() => setDismissOpen(!dismissOpen)}/>
	]

	return (
		<div 
		 id="context-menu" 
		 className={`
		 	absolute w-max flex gap-2 font-serif text-ink
			${ top ? 'top-[calc(50%+2.1rem)] flex-col-reverse' : 'bottom-[calc(50%+2.1rem)] flex-col' }
			${ left ? 'left-3.5 items-start' : 'right-3.5 items-end' }
			${ contextMenuState ? "pointer-events-auto" : "pointer-events-none" }
		`}>
		{tags.map( (tag, i) => (
			<div
			 key={tag.key}
			 style={{ transitionDelay: contextMenuState ? `${(tags.length - 1 - i) * 50}ms` : '0ms' }}
			 className={`
				transition-[opacity,transform] duration-300 ease-out
				${ contextMenuState ? "opacity-100 translate-y-0" : `opacity-0 ${ top ? '-translate-y-3' : 'translate-y-3' } pointer-events-none` }
			`}>
				{tag}
			</div>
		))}
		</div>	
	)
}
