import React from 'react'
import { RelatedNotesContext, views } from './RelatedNotesViewer.jsx'


export default function ViewSelector() {
	const { 
		NAV_STATE, 
		VIEW_STATE, 
		HEADER_STATE, 
		HOVER_STATE 
	} = React.useContext(RelatedNotesContext)

	const [ navState, setNavState ] = NAV_STATE
	const [ headerState, setHeaderState ] = HEADER_STATE 
	const [ view, setView ] = VIEW_STATE 
	const [ hoverState, setHoverState ] = HOVER_STATE
	

	const handleViewCycle = (event, directive) => {
		if (!event.isTrusted) return

		const current = views.indexOf(view)

		
		if (directive === 'forward') {
			const next = ( current + 1 ) % views.length
			setView(views[next])
		} else {
			const next = ( (current - 1) + views.length ) % views.length
			setView(views[next])
		}	
	}


	const arrow = `
		focus-ink w-8 h-full font-serif text-[1.35rem] leading-none text-ink-soft
		hover:bg-ink hover:text-paper transition-colors duration-150
	`

	return headerState ? (
		<span
		 id="related-notes-navigation"
		 className={`
			trans-ease flex shrink-0 items-stretch min-w-[17rem] h-full
			border-r border-ink z-10 font-serif text-ink
			${ navState ? "-translate-y-[0%]" : "-translate-y-[100%]" }
		`}>
			<button 
			 id="cycle-backwards-btn" 
			 aria-label="Previous view"
			 title="Previous view"
			 onClick={(e)=>{handleViewCycle(e, 'backward')}}
			 className={arrow}>{`\u2039`}</button>

			<span 
			 id="divider" 
			 className={`flex flex-grow items-center justify-center px-2`}>
				<span className="smallcaps whitespace-nowrap pb-[3px] border-b-2 border-vermilion">
				{`${view.name} View`}
				</span>
			</span>

			<button 
			 id="cycle-forwards-btn" 
			 aria-label="Next view"
			 title="Next view"
			 onClick={(e)=>{handleViewCycle(e, 'forward')}}
			 className={arrow}>{`\u203A`}</button>
		</span>

		) : (

		<button 
		 id="reveal-related-notes-btn"
		 aria-label="Show related notes"
		 title="Show related notes"
		 onClick={(e)=>{ if (e.isTrusted) setHeaderState(true) }}
		 className={`
			 focus-ink smallcaps trans-ease flex items-center h-[1.75rem] px-4 
			 paper-grain border border-t-0 border-ink shadow-print-sm text-ink hover:bg-ink hover:text-paper
			 ${ hoverState ? "-translate-y-[0%]" : "-translate-y-[130%]" }
		`}>
			{`Related \u25BE`}
		</button>
	)	
}
