import React from 'react';
import { WebContentContext } from '@content/content.jsx'
import noteSwatch from '@universal/Utils/noteSwatch.js'

// A footnote entry in the ribbon: superscript number in the note's colour, title, host.
export default function RelatedNote({note, tagId, index = 0, onOpen}) {
	const { NOTE_WINDOW_CONTEXT, NOTE_CONTEXT } = React.useContext(WebContentContext)
	const [ noteWindowState, setNoteWindowState ] = NOTE_WINDOW_CONTEXT 
	const [ targetNote, setTargetNote ] = NOTE_CONTEXT
	const swatch = noteSwatch(note?.color)
	const host = typeof note?.origin === 'string' ? note.origin.split('/')[0].replace(/^www\./, '') : ''

	const handleNoteClick = (event) => {
		if (!event.isTrusted) return

		setNoteWindowState(false)
		setTimeout( () => setNoteWindowState(true), 50 )
		
		setTargetNote(note)
		onOpen?.()
	}

	const handleDragStart = (e) => {
		const JSONified = JSON.stringify(note)
		e.dataTransfer.setData('text/plain', JSONified);
	}


	return (
		<header 
		 id={ `related-note-heading-${tagId}` }
		 className={`
			 group flex shrink-0 items-center gap-2 h-full min-w-[14rem] max-w-[14rem] pr-3
			 border-r border-paper-edge cursor-pointer font-serif text-ink
			 transition-colors duration-150 hover:bg-paper-deep animate-rise
		 `}
		 style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }}
		 onClick={handleNoteClick}
		 onDragStart={handleDragStart}
		 draggable
		>
			<div id="related-note" className={`self-stretch my-1.5 w-[3px] ${swatch.bg}`}></div>
			<span aria-hidden="true" className={`oldstyle self-start mt-[7px] text-[0.95rem] font-semibold leading-none ${swatch.text}`}>{index + 1}</span>
			<p 
			 id="related-note-title"
			 className={`
			 	min-w-0 text-[15px] leading-none font-medium
				overflow-hidden text-ellipsis whitespace-nowrap
				decoration-vermilion decoration-2 underline-offset-4 group-hover:underline
			`}>{note.title}</p>
			{host && <span className="smallcaps max-w-[5.5rem] shrink-0 truncate text-ink-soft" title={host}>{host}</span>}
		</header>

	)
}
