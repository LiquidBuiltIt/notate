import React from 'react';
import { ModalControllerContext } from '../Modal.jsx'
import { WebContentContext } from '@content/content.jsx'
import RelatedNote from '@content/Components/RelatedNotesViewer/RelatedNote.jsx'
import { getNoteURLComparison } from '@content/Components/RelatedNotesViewer/algorithms/RelatedNotesAlgoritm.js'

// Notes saved on this page, then notes saved elsewhere on this site.
export function usePageNotes() {
	const { NOTATE_DB_CONTEXT } = React.useContext(WebContentContext)
	const [ database ] = NOTATE_DB_CONTEXT
	const { fullMatchList, domainMatchList } = React.useMemo(() => getNoteURLComparison(database), [database, window.location.href])
	return [
		{ label: 'This Page', notes: fullMatchList },
		{ label: `Elsewhere on ${window.location.hostname.replace(/^www\./, '')}`, notes: domainMatchList },
	].filter( (group) => group.notes.length )
}

// The notes as rows: click one to open it in the editor, or drag it onto a notebook.
export function PageNoteList({ onOpen }) {
	const groups = usePageNotes()

	if (!groups.length) return (
		<p id="no-page-notes" className="smallcaps py-3 text-ink-soft">No notes from this site yet</p>
	)

	return groups.map( (group) => (
		<section key={group.label} className="flex flex-col">
			<h3 className="smallcaps pt-2 pb-1 text-ink-soft">{group.label}</h3>
			<div className="flex flex-wrap">
				{group.notes.map( (note, i) => (
					<div key={note.id} className="h-10 border-b border-paper-edge">
						<RelatedNote note={note} tagId={note.id} index={i} onOpen={onOpen}/>
					</div>
				))}
			</div>
		</section>
	))
}

export default function PageNotesModal() {
	const { TRANSITION, EXIT_MODAL: exitModal } = React.useContext(ModalControllerContext)
	const [ isActive, setIsActive ] = TRANSITION

	React.useEffect(() => setIsActive(true), [])

	return (
		<div
		 id="page-notes-modal"
		 className={`
			trans-ease-all fixed bottom-0 h-auto max-h-[70%] md:w-[70%] w-[95%]
			flex flex-col pt-[1.25rem] pb-[1rem] px-[2rem]
			paper-grain border border-b-0 border-ink shadow-print-lg
			font-serif text-ink pointer-events-auto
			${ isActive ? "translate-y-[0%]" : "translate-y-[100%]" }
		`}
		>
			<header className="flex items-start justify-between">
				<h2 className="font-display italic font-semibold text-ink text-[1.7rem] leading-tight">
				{`Notes From This Site`}
				</h2>
				<button
				 id="page-notes-exit-btn"
				 aria-label="Close"
				 title="Close"
				 className="focus-ink font-serif text-[2rem] leading-none px-2 -mt-1 text-ink-soft hover:text-vermilion-ink transition-colors duration-150"
				 onClick={exitModal}
				>
				&times;
				</button>
			</header>
			<div className="mt-2 h-px w-full origin-left bg-ink animate-draw"/>
			<main id="page-notes-list" className="min-h-0 overflow-y-auto">
				<PageNoteList onOpen={exitModal}/>
			</main>
		</div>
	)
}
