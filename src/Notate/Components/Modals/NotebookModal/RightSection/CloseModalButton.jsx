import React from 'react';
import { NotebookModalContext } from '../NotebookModal.jsx'

export default function CloseModalButton() {
	const { EXIT_MODAL } = React.useContext(NotebookModalContext)

	return (
		<button id="close-modal-button"
		type="button"
		aria-label="Close notebook"
		title="Close"
		className="focus-ink trans-ease font-serif text-[34px] leading-none text-ink-soft hover:text-vermilion-ink"
		onClick={EXIT_MODAL}>
			&times;	
		</button>
	)
}
