import React from 'react';
import noteSwatch from '@universal/Utils/noteSwatch.js';
import plainText from '@universal/Utils/plainText.js';
import Marked from '@universal/Components/Marked.jsx';

// faded: a search is active and this note does not match. tokens: the search words to mark.
export default function NoteCard({ note, stackClass=false, onClick, onDragStart, faded=false, tokens=[] }) {
	const NOTE_CONTENT_ELEMENT = `note-${note?.id}-content`


	const dragHandler = (event) => {
		const JSONified = JSON.stringify(note)
		event.dataTransfer.setData('text/plain', JSONified);
	}

	const handleKey = (event) => {
		if (onClick && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault()
			onClick(event)
		}
	}

	const swatch = noteSwatch(note?.color)

	// Origin is stored as host + path; the card shows the host only.
	const host = (note?.origin ?? '').replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0].replace(/^www\./, '')
	const stamp = new Date(note?.modified ?? note?.created)
	// The year is shown only for older notes, so the host keeps its room.
	const sameYear = stamp.getFullYear() === new Date().getFullYear()
	const date = isNaN(stamp) ? '' : stamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
	const text = plainText(note?.content ?? '')
	const number = String(note?.id ?? '').padStart(2, '0')

  return (
 
	<div  
	 id={`note-card-${note.id}`} 
	 className={`
		 ${ stackClass ? stackClass : '' }  
		 group relative flex flex-col min-h-[170px] max-h-[170px] w-full min-w-0 
		 rounded-none bg-paper-deep hairline overflow-hidden font-serif text-ink
		 focus-ink transition duration-150 ease-out transform cursor-pointer
		 ${ faded ? "opacity-[.17] grayscale-[.7]" : "hover:-translate-y-1 hover:shadow-lift focus-visible:-translate-y-1 focus-visible:shadow-lift" }
	 `} 
	 role="button"
	 tabIndex={faded ? -1 : 0}
	 data-match={tokens.length > 0 && !faded ? "true" : undefined}
	 onClick={onClick}
	 onKeyDown={handleKey}
	 onDragStart={dragHandler}
	 draggable
	>
		<header 
	  	 id="note-top" 
	  	 className={`absolute left-0 top-0 bottom-0 w-[6px] ${swatch.bg}`}
		 aria-hidden="true"
		/>
	  	<div 
	  	 id="note-card" 
	  	 className="pt-3 pl-[22px] pr-4 pb-3 flex flex-col flex-grow overflow-hidden"
	  	>
			<span
			 id="note-number"
			 className={`oldstyle text-[13px] font-semibold leading-none tracking-wider ${swatch.text}`}
			>&sect; {number}</span>

      			<h3 
	  		 id="note-title" 
	  		 className="mt-[6px] text-[19px] leading-[1.15] font-semibold text-ink overflow-hidden text-ellipsis whitespace-nowrap decoration-vermilion decoration-2 underline-offset-4 group-hover:underline"
	  		>
	  			<Marked text={note.title} tokens={tokens}/>
	  		</h3>

	  		<div 
	  		 id={NOTE_CONTENT_ELEMENT} 
	  		 className="mt-[6px] text-[15px] leading-[1.3] italic text-ink-soft line-clamp-3 whitespace-pre-line break-words min-h-0"
	  		>
				<Marked text={text} tokens={tokens}/>
			</div>

			<footer 
			 id="note-meta" 
			 className="mt-auto pt-2 flex items-baseline justify-between gap-2 border-t border-paper-edge"
			>
				<span className="smallcaps tracking-[.06em] min-w-0 flex-1 text-ink-soft overflow-hidden text-ellipsis whitespace-nowrap" title={host}>{host ? <Marked text={host} tokens={tokens}/> : '\u2014'}</span>
				<span className="oldstyle text-[12px] leading-none text-ink-soft whitespace-nowrap shrink-0">{date}</span>
			</footer>
	 	</div>
    </div>

  );
}
