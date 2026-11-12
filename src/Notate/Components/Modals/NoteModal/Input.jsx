import React from 'react';
import TextEditor, { TextInputContext } from '@universal/Components/TextEditor/TextEditor.jsx'
import NoteColorPicker from './Components/NoteColorPicker.jsx';

import { NoteModalContext } from './NoteModal.jsx'

export default function NoteModalInput() {
	const { TITLE_CONTEXT, CONTENT_CONTEXT } = React.useContext(NoteModalContext)

	const [ title, setTitle ] = TITLE_CONTEXT
	const [ content, setContent ] = CONTENT_CONTEXT
	
  	const handleTitleChange = (event) => { setTitle(event.target.value) };


	return (

	<TextInputContext.Provider value={[ content, setContent ]}>

		<div 
		 id="title-n-color-section"
		 className="flex items-end gap-6 mb-4"
		>
	       		 <input
	       		   type="text"
	       		   id="edit-note-title"
	       		   className="flex-grow min-w-0 pb-1 bg-transparent border-b border-ink rounded-none font-display italic text-[30px] leading-tight text-ink caret-vermilion outline-none placeholder:text-ink-faint focus:border-vermilion"
	       		   placeholder="What's on your mind...?"
	       		   value={title}
	       		   onChange={handleTitleChange}
	       		 />

			<NoteColorPicker/>
		</div>

			<TextEditor TailwindClassNames={"fill-ink stroke-ink"}/>	
	</TextInputContext.Provider>

	)
}
