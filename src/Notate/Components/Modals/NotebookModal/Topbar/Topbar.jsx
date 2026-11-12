import React from 'react';


export default function TopBar(){
	return (
		<header 
		 id="notebook-modal-topbar"
		 className="w-full flex justify-between items-baseline pb-2 border-b border-ink"
		>
			<aside 
			 id="left-section"
			 className="justify-start"
			>
				<h3 
				 id="title" 
				 className="font-display italic text-[24px] leading-none text-ink"
				>
					Your note collection
				</h3>
			</aside>
			<aside id="right-section"
			className="justify-end">
			</aside>

		</header>
	)
}
