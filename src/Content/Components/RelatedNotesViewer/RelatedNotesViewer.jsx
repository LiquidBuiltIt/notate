import React from 'react';


import { WebContentContext } from '@content/content.jsx'
import RelatedNotesProcessor from './RelatedNotesProcessor.jsx'
import ViewSelector from './ViewSelector.jsx';
import ViewNavigator from './ViewNavigator.jsx';


export const views = [
	{
		type: 'related-by-url',
		name: 'Related By URL'
	},{
		type: 'related-by-suggestion',
		name: 'Notate\'s Suggestion'
	},
]


export const RelatedNotesContext = React.createContext()



export default function RelatedNotesHeader() {

	const { NOTATE_DB_CONTEXT, RELATED_NOTES_CONTEXT, MENU_DISMISSED_CONTEXT } = React.useContext(WebContentContext)

	const NOTE_VIEWER_CONTEXT = {
		NAV_STATE: React.useState(false),
		VIEW_STATE: React.useState(views[0]),
		HOVER_STATE: React.useState(false),
		HEADER_STATE: RELATED_NOTES_CONTEXT,
		NAV_POS_STATE: React.useState(0),
		END_REACHED: React.useState(false)
	}

	const [ database ] = NOTATE_DB_CONTEXT
	const [ headerState, setHeaderState ] = NOTE_VIEWER_CONTEXT.HEADER_STATE 
	const [ hoverState, setHoverState ] = NOTE_VIEWER_CONTEXT.HOVER_STATE 
	const [ navState, setNavState ] = NOTE_VIEWER_CONTEXT.NAV_STATE
	const [ view, setView ] = NOTE_VIEWER_CONTEXT.VIEW_STATE 
	const [ position, setPosition ] = NOTE_VIEWER_CONTEXT.NAV_POS_STATE
	const [ endReached, setEndReached ] = NOTE_VIEWER_CONTEXT.END_REACHED
	const [ isMenuDismissed ] = MENU_DISMISSED_CONTEXT


	const [ viewNavEnabled, setViewNavEnabled ] = React.useState(false)
	const [ enabled, setEnabled ] = React.useState(true)

	const viewerLengthRef = React.useRef(null)



	const handleHoverEvent = (e) => {
		if (e.type === "mouseenter") {
			setHoverState(true)	
		}
		else if (e.type === "mouseleave") {
			setHoverState(false)
		}	
	}

	const handleRelatedNotesUnfocus = (e) => {
		const target = e.target.id
		if (target !== 'content-script-entry-point') {
			setHeaderState(false)
			document.removeEventListener('click', handleRelatedNotesUnfocus)
		} 
	}

	// Effect for when menu is dismissed, also dismiss the related notes viewer
	React.useEffect(() => {
		if (isMenuDismissed) {
			setEnabled(false)
		}
	}, [isMenuDismissed])

	React.useEffect(()=>{
		if (headerState) {
			document.addEventListener('click', handleRelatedNotesUnfocus)	
		}

	},[headerState])


	React.useEffect(()=>{
		setNavState(headerState)
	},[headerState])




	React.useEffect(()=>{
		if (!viewNavEnabled) {
			setPosition(0)
		}
	},[viewNavEnabled])



	React.useEffect(()=> {
		const viewer = viewerLengthRef.current

		if (viewer) {
			const intersectionObserver = new IntersectionObserver( ([entry]) => {
				setViewNavEnabled(!entry.isIntersecting)
			},{
				root: null,
				rootMargin: '0px',
				threshold: 1.0
			})

			intersectionObserver.observe(viewer)

			return () => intersectionObserver.disconnect()
		}

	},[viewerLengthRef.current])

	if (!enabled) return null
	
	return (
		<div 
		 id="related-notes-hover-region"
		 className={`
			 fixed flex top-0 h-[2rem] font-serif text-ink
			 ${ headerState ? "min-w-full paper-grain border-b border-ink" : "" }
		 `}
		 onMouseEnter={handleHoverEvent}
		 onMouseLeave={handleHoverEvent}
		 ref={viewerLengthRef}
		>
			<RelatedNotesContext.Provider value={NOTE_VIEWER_CONTEXT}>
				<ViewSelector/>

				{headerState && (
					<
					 RelatedNotesProcessor 
					 database={database} 
					 view={view}
					/>
				)}

				{ viewNavEnabled && <ViewNavigator/>}

			</RelatedNotesContext.Provider>
		</div>
	)
}

// -translate-x-[0%] -translate-x-[20%] -translate-x-[40%] -translate-x-[60%] -translate-x-[80%] -translate-x-[100%]
