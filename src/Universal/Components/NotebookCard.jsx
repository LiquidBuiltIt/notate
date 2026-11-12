import React from 'react';
import noteSwatch from '@universal/Utils/noteSwatch.js';

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
const toRoman = (n) => ROMAN.reduce((out, [v, s]) => { while (n >= v) { out += s; n -= v } return out }, '')

/* One volume in the table of contents: a ruled row.
   volume:    1-based position, shown as a roman numeral
   inventory: the stored notes, used for the count and the colour ticks
   pending:   notes dropped here but not saved yet (in-page sheet)
   Row and drag payload ids are used by the browser tests; keep them. */
export default function NotebookCard({ notebook, volume = 1, onNotebookClick, updatesDispatcher, inventory, pending = 0 }) {
	const [ over, setOver ] = React.useState(false)

	const notes = React.useMemo(() => {
		const ids = notebook.collection ?? []
		return inventory ? inventory.filter(note => ids.includes(note.id)) : []
	}, [inventory, notebook])
	const count = inventory ? notes.length : (notebook.collection?.length ?? 0)

	const handleNoteDrop = async (event) => {
		event.preventDefault()
		setOver(false)
		try {
			const note = JSON.parse(event.dataTransfer.getData('text/plain'))
			// A dragged notebook carries a collection: it is not a note, so it cannot be filed.
			if (!note || note.id === undefined || Array.isArray(note.collection)) return
			delete note.hits
			await updatesDispatcher(notebook, note)
		} catch (error) {
			console.error(`Could not file the note: ${error}`)
		}
	}

	const dragHandler = (event) => {
		if (event.target.id === 'notebook-card-container') {
			event.dataTransfer.setData('text/plain', JSON.stringify(notebook))
		}
	}

	const handleDragOver = (event) => {
		// Needed for the onDrop event to fire
		event.preventDefault()
		setOver(true)
	}

	const handleDragLeave = (event) => {
		if (!event.currentTarget.contains(event.relatedTarget)) setOver(false)
	}

	const handleKey = (event) => {
		if (onNotebookClick && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault()
			onNotebookClick(event)
		}
	}

	// With a click handler (new tab) the row opens the notebook and can be dragged to the trash.
	// Without one (in-page sheet) it only receives dropped notes.
	const interactive = !!onNotebookClick

	return (
		<div
		 id="notebook-card-container"
		 className={`group font-serif ${ interactive ? "cursor-pointer" : "" }`}
		 onDragStart={dragHandler}
		 draggable={interactive}
		>
			<div
			 id={`notebook-card-${notebook.id}`}
			 data-notebook-id={notebook.id}
			 role={interactive ? "button" : undefined}
			 tabIndex={interactive ? 0 : undefined}
			 className={`
				focus-ink flex gap-4 py-3 pl-3 pr-3 border-l-2 border-b border-b-paper-edge
				transition-colors duration-150
				${ over ? "bg-vermilion-wash border-l-vermilion" : "border-l-transparent hover:bg-paper-deep" }
			 `}
			 onClick={onNotebookClick}
			 onKeyDown={handleKey}
			 onDrop={handleNoteDrop}
			 onDragOver={handleDragOver}
			 onDragLeave={handleDragLeave}
			>
				<span className="smallcaps oldstyle w-[3.25rem] shrink-0 pt-[9px] text-ink-soft whitespace-nowrap">Vol. {toRoman(volume)}</span>

				<div className="min-w-0 flex-grow">
					<div className="flex items-baseline gap-2">
						<h3 className="min-w-0 truncate font-display italic font-semibold text-[22px] leading-tight text-ink decoration-vermilion decoration-2 underline-offset-4 group-hover:underline">{notebook.title}</h3>
						<span className="flex-grow min-w-[1rem] translate-y-[-3px] border-b border-dotted border-ink-soft" aria-hidden="true"></span>
						<span className="oldstyle shrink-0 text-[15px] leading-none text-ink whitespace-nowrap">
							{count} {count === 1 ? 'note' : 'notes'}
							{pending > 0 && <span className="ml-1 font-semibold text-vermilion-ink" title="Not saved yet">+{pending}</span>}
						</span>
					</div>

					{notebook.description && (
						<p className="mt-1 text-[15px] italic leading-snug text-ink-soft line-clamp-2 break-words">{notebook.description}</p>
					)}

					<div className="mt-2 flex items-center justify-between gap-3 h-[14px]">
						<span className="flex items-center gap-[3px]" aria-hidden="true">
							{notes.slice(0, 14).map((note, i) => <i key={i} className={`block w-[5px] h-[11px] ${noteSwatch(note.color).bg}`}></i>)}
						</span>
						{over && <span className="smallcaps text-vermilion-ink">File here</span>}
					</div>
				</div>
			</div>
		</div>
	);
}
