import React from 'react';
import { NotebookModalContext } from '../NotebookModal.jsx'


export default function Header() {
	const { TITLE_CONTEXT, DESCRIPTION_CONTEXT, EXIT_MODAL } = React.useContext(NotebookModalContext)
	const [ title, setTitle ] = TITLE_CONTEXT
	const [ description, setDescription ] = DESCRIPTION_CONTEXT

	return (
		<header id="notebook-modal-topbar" className="shrink-0 pb-3 mb-4 border-b border-ink">
			<div className="flex items-baseline justify-between">
				<p className="smallcaps text-vermilion-ink">Notebook</p>
				<button id="close-modal-button"
				type="button"
				aria-label="Close notebook"
				title="Close"
				className="focus-ink trans-ease font-serif text-[34px] leading-none text-ink-soft hover:text-vermilion-ink cursor-pointer"
				onClick={EXIT_MODAL}>
					&times;
				</button>
			</div>

			<input
			 id="notebook-title"
			 aria-label="Notebook title"
			 className="w-full mt-1 font-display italic text-[28px] leading-tight text-ink caret-vermilion bg-transparent border-b border-ink rounded-none pb-1 outline-none placeholder:text-ink-faint focus:border-vermilion"
			 value={title}
			 placeholder="Name this notebook"
			 onChange={(e) => setTitle(e.target.value)}
			/>

			<textarea
			 id="notebook-description"
			 aria-label="Notebook description"
			 rows={2}
			 className="w-full mt-3 resize-none outline-none bg-transparent font-serif italic text-[17px] leading-relaxed text-ink-soft caret-vermilion placeholder:text-ink-faint"
			 placeholder="Organize your thoughts..."
			 value={description}
			 onChange={(e) => setDescription(e.target.value)}
			/>
		</header>
	)
}
