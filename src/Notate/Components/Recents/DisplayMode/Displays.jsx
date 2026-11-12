import React from 'react'

import { NotateContext } from '@notate/Notate.jsx';


export const NoItemsFound = () => {
	const { THEME_CONTEXT } = React.useContext(NotateContext)
	const theme = THEME_CONTEXT

	return (
		<div id="no-items-found-container" className="py-10">
			<h2 id="no-items-found-text" className={`font-display italic text-[28px] leading-tight ${theme.text.h2 || ""}`}>No notes or notebooks found.</h2>
			<p className={`smallcaps mt-3 ${theme.text.muted || ""}`}>Nothing in the index matches that search</p>
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
				{ filed ? "Every note is filed in a volume. Choose " : "Nothing is filed yet. Choose " }<span className="not-italic smallcaps text-vermilion-ink">+ New</span>{ filed ? " above to write another." : " above to write your first note." }
			</p>
		</div>
	) 
}
