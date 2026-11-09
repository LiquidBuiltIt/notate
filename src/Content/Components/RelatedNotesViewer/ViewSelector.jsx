import React from 'react'
import { RelatedNotesContext, views } from './RelatedNotesViewer.jsx'
import DropdownArrow from '@assets/Designs/Arrows/dropdown-arrow.svg'


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


	return headerState ? (
		<span
		 id="related-notes-navigation"
		 className={`
			trans-ease flex min-w-[15rem] h-[1.5rem] 
			rounded-b-2xl bg-zinc-700 z-10
			font-extrabold text-white
			${ navState ? "-translate-y-[0%]" : "-translate-y-[100%]" }
		`}>
			<button 
			 id="cycle-backwards-btn" 
			 onClick={(e)=>{handleViewCycle(e, 'backward')}}
			 className={`
				w-[15%] text-zinc-300
				hover:bg-zinc-600 trans-ease
				rounded-bl-2xl
			`}>{`<`}</button>

			<span 
			 id="divider" 
			 className={`
				flex-grow h-full bg-zinc-700 
				alice-regular text-[.8rem] text-center font-bold
			`}>
			{`${view.name} View`}
			</span>

			<button 
			 id="cycle-forwards-btn" 
			 onClick={(e)=>{handleViewCycle(e, 'forward')}}
			 className={`
				w-[15%] text-zinc-300
				hover:bg-zinc-600 trans-ease
				rounded-br-2xl
			`}>{`>`}</button>
		</span>

		) : (

		<button 
		 id="reveal-related-notes-btn"
		 onClick={(e)=>{ if (e.isTrusted) setHeaderState(true) }}
		 className={`
			 trans-ease flex w-[3rem] h-[1.5rem] rounded-b-2xl
			 ${ headerState ? "-translate-y-[100%] pointer-events-none" : "bg-zinc-500" }  
			 ${ hoverState ? "-translate-y-[0%]" : "-translate-y-[100%]" }
		`}>
			<DropdownArrow className="h-[inherit] w-[inherit] fill-zinc-300"/>
		</button>
	)	
}
