import React from 'react'
import { RelatedNotesContext } from './RelatedNotesViewer.jsx' 


export default function ViewNavigator() {
	const {  NAV_POS_STATE, END_REACHED  } = React.useContext(RelatedNotesContext)

	const [ position, setPosition ] = NAV_POS_STATE
	const [ endReached, setEndReached ] = END_REACHED

	const handleNavigationClick = (directive) => {
		if ( directive === 'backward' && position > 0 ) {
			setPosition(position - 20)
		} else if ( directive === 'forward' && position < 100 && !endReached ) {
			setPosition(position + 20)
		}
	}

	const arrow = `
		focus-ink w-8 h-full font-serif text-[1.35rem] leading-none text-ink
		hover:bg-ink hover:text-paper transition-colors duration-150
	`

	return  (
		<div
		 id="view-navigator"
		 className={`
			h-[2rem] flex fixed right-0 paper-grain border-l border-b border-ink
		`}>
			<button 
			 aria-label="Scroll back"
			 title="Scroll back"
			 onClick={() => handleNavigationClick('backward')}
			 className={arrow}>
			 {`‹`}
			</button>
			<button 
			 aria-label="Scroll forward"
			 title="Scroll forward"
			 onClick={() => handleNavigationClick('forward')}
			 className={`${arrow} border-l border-paper-edge`}>
			 {`›`}
			</button>
		</div>
	)
}
