import React from 'react';
import { mastheadParts } from './dateWords.js'

// The showpiece: today's date written out in giant italic type.
export default function Masthead({ theme, noteCount, notebookCount }) {
	const { weekday, day, month, year } = React.useMemo(() => mastheadParts(), [])

	return (
		<header id="page-header" className="xl:col-span-5 xl:sticky xl:top-0 xl:self-start pt-10 xl:pt-16">
			<p id="page-wordmark" className="smallcaps flex items-center gap-2 animate-rise">
				<span className="block size-[7px] rounded-full bg-vermilion" aria-hidden="true"></span>
				Notate
			</p>

			<h1
			 id="page-title"
			 className={`mt-8 xl:mt-14 font-display italic tracking-tight leading-[.92] ${theme.text.h1 || ""}`}
			 style={{ fontSize: 'clamp(56px, 7.6vw, 128px)' }}
			>
				<span className="block font-normal animate-rise" style={{ animationDelay: '80ms' }}>{weekday},</span>
				<span
				 className={`block ml-[.7em] my-[.12em] font-serif font-medium text-[.3em] leading-none tracking-normal animate-rise ${theme.text.sub || ""}`}
				 style={{ animationDelay: '200ms' }}
				>{day}</span>
				<span className="block font-black animate-rise" style={{ animationDelay: '320ms' }}>
					{month}<span className="text-vermilion">.</span>
				</span>
			</h1>

			<div className="mt-9 h-px w-32 bg-ink origin-left animate-draw" style={{ animationDelay: '560ms' }}></div>

			<p
			 id="page-subtitle"
			 className={`mt-5 max-w-[24rem] text-lg italic leading-snug animate-rise ${theme.text.sub || ""}`}
			 style={{ animationDelay: '640ms' }}
			>Combining the worlds of searches &amp; note taking.</p>

			<p className={`smallcaps oldstyle mt-6 animate-rise ${theme.text.muted || ""}`} style={{ animationDelay: '720ms' }}>
				{year} &nbsp;&middot;&nbsp; {noteCount} {noteCount === 1 ? 'note' : 'notes'} &nbsp;&middot;&nbsp; {notebookCount} {notebookCount === 1 ? 'notebook' : 'notebooks'}
			</p>
		</header>
	)
}
