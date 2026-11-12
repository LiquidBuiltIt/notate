import React from 'react'

export default function Loading() {
	console.log('loading')

	return (
		<div role="status" className="flex flex-col items-start gap-3 font-serif text-ink">
			<span className="smallcaps text-ink-soft">Gathering notes</span>
			<h1 className="font-display italic text-[40px] leading-none">Loading&hellip;</h1>
			<div className="h-px w-40 bg-ink origin-left animate-draw"/>
		</div>
	)
}
