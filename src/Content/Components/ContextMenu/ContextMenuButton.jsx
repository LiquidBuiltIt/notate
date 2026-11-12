import React from 'react';
import { ContextMenuHoverRegionContext } from '@content/Components/HoverRegions/ContextMenuHoverRegion.jsx'


// The vermilion seal: a round stamp with an italic N and a paper-coloured inner ring.
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
					pointer-events-none absolute -inset-[7px] rounded-full border border-ink
					opacity-0 scale-90 transition duration-200 group-hover:opacity-60 group-hover:scale-100
				`}/>
				<span 
				 className={`
					relative flex size-full items-center justify-center rounded-full
					bg-vermilion shadow-print-sm rotate-[-6deg]
					transition-transform duration-150 group-hover:rotate-[-2deg] group-active:scale-95
					${ shown ? 'animate-stamp' : '' }
				`}>
					<span className="pointer-events-none absolute inset-[4px] rounded-full border border-paper opacity-70"/>
					<span className="font-display italic font-semibold text-[27px] leading-none text-paper pr-[2px] pb-[2px]">
						N
					</span>
				</span>
			</button>
	)
}
