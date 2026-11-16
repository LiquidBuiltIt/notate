import React from 'react';
import { ContextMenuHoverRegionContext } from '@content/Components/HoverRegions/ContextMenuHoverRegion.jsx'


// The seal: the hand-drawn Notate logo on a paper disc with an ink ring.
export default function ContextMenuButton () {
	const { CONTEXT_MENU_CONTEXT, HOVER_CONTEXT, CORNER_CONTEXT } = React.useContext(ContextMenuHoverRegionContext)
	const [ contextMenuState, setContextMenuState ] = CONTEXT_MENU_CONTEXT 
	const [ isHovered, setIsHovered ] = HOVER_CONTEXT
	const [ corner, setCorner ] = CORNER_CONTEXT

	// Drag the seal to move it; on release it snaps to the nearest corner.
	const drag = React.useRef(null)
	const [ offset, setOffset ] = React.useState(null)

	const handlePointerDown = (event) => {
		if (event.button !== 0) return
		drag.current = { x: event.clientX, y: event.clientY, moved: false }
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	const handlePointerMove = (event) => {
		const d = drag.current
		if (!d || !event.currentTarget.hasPointerCapture(event.pointerId)) return
		const dx = event.clientX - d.x, dy = event.clientY - d.y
		if (!d.moved && Math.hypot(dx, dy) < 6) return
		d.moved = true
		setOffset({ dx, dy })
	}

	const handlePointerUp = (event) => {
		if (!drag.current?.moved) return
		setOffset(null)
		setIsHovered(true)
		moveTo(`${event.clientY < window.innerHeight / 2 ? 'top' : 'bottom'}-${event.clientX < window.innerWidth / 2 ? 'left' : 'right'}`)
	}

	const moveTo = (next) => {
		setCorner(next)
		chrome.storage.local.set({ sealCorner: next })
	}

	// Arrow keys move the seal to the adjacent corner; the button stays mounted, so focus stays on it.
	const handleKeyDown = (event) => {
		const [ v, h ] = corner.split('-')
		const next = {
			ArrowUp: `top-${h}`, ArrowDown: `bottom-${h}`,
			ArrowLeft: `${v}-left`, ArrowRight: `${v}-right`
		}[event.key]
		if (!next) return
		event.preventDefault()
		moveTo(next)
	}

	const handleMenuClick = (event) => {
		// The click that ends a drag must not open the menu.
		if (drag.current?.moved) { drag.current = null; return }
		setContextMenuState(true)	
	}

	// Keyboard focus reveals the seal, so focus is never on an invisible control.
	const [ focused, setFocused ] = React.useState(false)
	const shown = isHovered || contextMenuState || focused
	const hidden = corner.startsWith('top') ? '-translate-y-[250%]' : 'translate-y-[250%]'
	// Tailwind runs with important: true, so while dragging the translate and transition
	// classes are dropped; otherwise they beat the inline drag transform.

	return (
			<button 
			 id="context-menu-btn"
			 aria-label="Open the Notate menu. Arrow keys move it."
			 title="Notate. Arrow keys move it."
			 className={`
				focus-ink group pointer-events-auto relative flex items-center justify-center rounded-full
				size-[3.25rem]
				${ offset ? 'cursor-grabbing' : shown ? 'translate-y-[0%]' : hidden }
				${ offset || drag.current?.moved ? '' /* also no slide from the drag offset on drop */ : 'transition-transform duration-300 ease-out' }
			 `}
			 style={ offset ? { transform: `translate(${offset.dx}px, ${offset.dy}px)` } : undefined }
			 onPointerDown={handlePointerDown}
			 onPointerMove={handlePointerMove}
			 onPointerUp={handlePointerUp}
			 onPointerCancel={() => { drag.current = null; setOffset(null) }}
			 onClick={handleMenuClick}
			 onKeyDown={handleKeyDown}
			 onFocus={() => setFocused(true)}
			 onBlur={() => setFocused(false)}
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
