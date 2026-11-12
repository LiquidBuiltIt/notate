import React from 'react';
import noteSwatch from '@universal/Utils/noteSwatch.js';

export default function NoteCard({ note, stackClass=false, onClick, onDragStart }) {
	const NOTE_CONTENT_ELEMENT = `note-${note?.id}-content`

	//const [ content, setContent ] = React.useState('')

	const noteContentRef = React.useRef(null)


	const dragHandler = (event) => {
		const JSONified = JSON.stringify(note)
		event.dataTransfer.setData('text/plain', JSONified);
	}

	React.useEffect(()=>{
	//	if (note?.content) {
	//		setContent(note.content)
	//		contentTag.textContent = content
	//	}
		const ref = noteContentRef.current

		if (ref) {
			// DOMParser documents are inert: nothing in note.content loads or runs.
			const doc = new DOMParser().parseFromString(note.content ?? '', 'text/html')
			doc.body.querySelectorAll('br, div, p, li').forEach( el => el.append(' ') )
			ref.textContent = doc.body.textContent
		}
	},[note, noteContentRef.current])


	const swatch = noteSwatch(note?.color)

	// Origin is stored as host + path; the card shows the host only.
	const host = (note?.origin ?? '').replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0].replace(/^www\./, '')
	const stamp = new Date(note?.modified ?? note?.created)
	// The year is shown only for older notes, so the host keeps its room.
	const sameYear = stamp.getFullYear() === new Date().getFullYear()
	const date = isNaN(stamp) ? '' : stamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
	const number = String(note?.id ?? '').padStart(2, '0')

  return (
 
	<div  
	 id={`note-card-${note.id}`} 
	 className={`
		 ${ stackClass ? stackClass : '' }  
		 group relative flex flex-col min-h-[170px] max-h-[170px] w-full min-w-0 
		 rounded-none bg-paper-deep hairline overflow-hidden font-serif text-ink
		 transition duration-150 ease-out transform hover:-translate-y-1 hover:shadow-lift cursor-pointer
	 `} 
	 onClick={onClick}
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
	  			{note.title}
	  		</h3>

	  		<div 
	  		 id={NOTE_CONTENT_ELEMENT} 
	  		 className="mt-[6px] text-[15px] leading-[1.3] italic text-ink-soft line-clamp-3 break-words min-h-0"
	  		 ref={noteContentRef}
	  		/>

			<footer 
			 id="note-meta" 
			 className="mt-auto pt-2 flex items-baseline justify-between gap-2 border-t border-paper-edge"
			>
				<span className="smallcaps tracking-[.06em] min-w-0 flex-1 text-ink-soft overflow-hidden text-ellipsis whitespace-nowrap" title={host}>{host || '\u2014'}</span>
				<span className="oldstyle text-[12px] leading-none text-ink-soft whitespace-nowrap shrink-0">{date}</span>
			</footer>
	 	</div>
    </div>

  );
}
