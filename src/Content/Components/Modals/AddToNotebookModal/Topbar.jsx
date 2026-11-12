import React from 'react'
import { ModalControllerContext } from '../Modal.jsx'


export default function Topbar() {
	const { EXIT_MODAL: exitModal } = React.useContext(ModalControllerContext)

	return (
		<header
		 id="add-to-notebook-topbar"
		 className={`
			w-full flex flex-col 
		`}>
			<section id="top-section" className={`flex items-start justify-between`}>
				<h2 
				 id="title" 
				 className={`
				 	font-display italic font-semibold text-ink
					text-[1.7rem] leading-tight
				`}>
				{`Add To Your Notebook Collection`}
				</h2>

				<button 
				 id="exit-btn" 
				 aria-label="Close"
				 title="Close"
				 className={`
					focus-ink font-serif text-[2rem] leading-none px-2 -mt-1 text-ink-soft
					hover:text-vermilion-ink transition-colors duration-150
				 `}
				 onClick={exitModal}
				>
				&times;
				</button>
			</section>
			<div className="mt-2 h-px w-full origin-left bg-ink animate-draw"/>
			<section className="mt-2">
				<label id="help-message" className={`
					font-serif italic text-[15px] text-ink-soft
				`}>{`
					Drag a note from the ribbon above onto a volume, then press Save.
				`}</label>
			</section>
		</header>
	)
}
