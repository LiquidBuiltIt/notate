import React from 'react'

import { NotateContext } from '@notate/Notate.jsx';


// overlay: a card laid over the faded notes, as in the mockup; otherwise it sits in the page flow.
export const NoItemsFound = ({ term = '', overlay = false }) => {
	return (
		<div id="no-items-found-container" 
		 className={`
			pointer-events-none z-[3] w-[min(26rem,90%)] paper-grain hairline shadow-print px-[30px] py-[22px] text-center
			${ overlay ? "absolute left-1/2 top-24 -translate-x-1/2" : "mx-auto my-10" }
		 `}>
			<h2 id="no-items-found-text" className="font-serif italic text-[22px] leading-tight">Nothing in your notes for &ldquo;{term}&rdquo;</h2>
			<p className="smallcaps mt-[10px] text-vermilion-ink">&crarr; search the web instead</p>
		</div>
	)
}

export const EmptyRecentsContent = ({ filed = false }) => {
	const { THEME_CONTEXT } = React.useContext(NotateContext)
	const theme = THEME_CONTEXT

	return (
		<div id="empty-recents" className="relative flex flex-col justify-center min-h-[17rem] py-8 sm:pr-[10rem] overflow-hidden">
			<span className="absolute right-2 top-1/2 -translate-y-1/2 font-display italic font-black text-[13rem] leading-none text-ink/[.08] select-none" aria-hidden="true">&para;</span>
			<h3 className={`relative font-display italic font-semibold text-[40px] leading-tight ${theme.text.h3 || ""}`}>{ filed ? "No loose notes." : "The page is blank." }</h3>
			<p className={`relative mt-3 max-w-[26rem] text-lg italic ${theme.text.sub || ""}`}>
				{ filed ? "Every note is filed in a volume. Type " : "Nothing is filed yet. Type " }<span className="not-italic smallcaps text-vermilion-ink">/note</span>{ filed ? " in the search bar to write another." : " in the search bar to write your first note." }
			</p>
		</div>
	) 
}
