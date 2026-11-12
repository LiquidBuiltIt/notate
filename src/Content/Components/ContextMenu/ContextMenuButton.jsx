import React from 'react';
import { ContextMenuHoverRegionContext } from '@content/Components/HoverRegions/ContextMenuHoverRegion.jsx'


// The seal: the hand-drawn Notate logo on a paper disc with an ink ring.
export default function ContextMenuButton () {
	const { CONTEXT_MENU_CONTEXT, HOVER_CONTEXT } = React.useContext(ContextMenuHoverRegionContext)
	const [ contextMenuState, setContextMenuState ] = CONTEXT_MENU_CONTEXT 
	const [ isHovered, setIsHovered ] = HOVER_CONTEXT

	const handleMenuClick = (event) => {
		setContextMenuState(true)	
	}

	const shown = isHovered || contextMenuState

	return (
			<button 
			 id="context-menu-btn"
			 aria-label="Open the Notate menu"
			 title="Notate"
			 className={`
				focus-ink group relative flex items-center justify-center rounded-full
				size-[3.25rem] transition-transform duration-300 ease-out
				${ shown ? 'translate-y-[0%]' : 'translate-y-[250%]'}
			 `}
			 onClick={handleMenuClick}
			 onMouseEnter={()=> setIsHovered(true)}
			 onMouseLeave={()=> setIsHovered(false)}
			>
				<span 
				 id="glow-effect" 
				 className={`
					pointer-events-none absolute -inset-[7px] rounded-full border border-vermilion
					opacity-0 scale-90 transition duration-200 group-hover:opacity-100 group-hover:scale-100
				`}/>
				<span 
				 className={`
					relative flex size-full items-center justify-center rounded-full
					paper-grain border border-ink shadow-print-sm rotate-[-6deg]
					transition-transform duration-150 group-hover:rotate-[-2deg] group-active:scale-95
					${ shown ? 'animate-stamp' : '' }
				`}>
					{/* multiply turns the logo's white scroll into the paper colour */}
					<img src={chrome.runtime.getURL('Designs/notate-logo.svg')} alt=""
					 className="pointer-events-none w-[118%] max-w-none h-auto mix-blend-multiply"/>
				</span>
			</button>
	)
}
