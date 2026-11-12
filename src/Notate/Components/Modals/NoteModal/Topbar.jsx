import React from 'react';
import { NotateContext } from '@notate/Notate.jsx';

export default function NoteModalTopbar({onExit}) {
	const [ note ] = React.useContext(NotateContext).NOTE_CONTEXT

	return (
		<>
	  		<div 
			 id="modal-topbar" 
			 className="flex items-baseline justify-between pb-3 mb-4 border-b border-ink"
			>
          			<h2 
				 id="modal-title" 
				 className="font-display italic text-[28px] leading-none text-ink"
				>{ note?.id ? 'Edit Note' : 'New Note' }</h2>

          			<button id="close" 
				type="button"
				aria-label="Close" 
				title="Close"
				className="focus-ink trans-ease font-serif text-[34px] leading-none text-ink-soft hover:text-vermilion-ink cursor-pointer" 
				onClick={onExit}>
					&times;
				</button>
	  		</div>
		</>
	)
}
