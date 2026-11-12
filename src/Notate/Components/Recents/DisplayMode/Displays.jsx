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

export const EmptyRecentsContent = () => {
	const { THEME_CONTEXT } = React.useContext(NotateContext)
	const theme = THEME_CONTEXT

	return (
		<div id="empty-recents" className="relative py-8 overflow-hidden">
			<span className="absolute -top-10 right-0 font-display italic font-black text-[16rem] leading-none text-ink/[.06] select-none" aria-hidden="true">&para;</span>
			<h3 className={`relative font-display italic font-semibold text-[40px] leading-tight ${theme.text.h3 || ""}`}>The page is blank.</h3>
			<p className={`relative mt-3 max-w-[26rem] text-lg italic ${theme.text.sub || ""}`}>
				Nothing is filed yet. Choose <span className="not-italic smallcaps text-vermilion-ink">+ New</span> above to write your first note.
			</p>
		</div>
	) 
}
