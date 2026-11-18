import React from 'react';

export const NoteEditorTitleContext = React.createContext()


export default function NoteEditorTitle() {
	const [ title, setTitle ] = React.useContext(NoteEditorTitleContext)

	const handleChange = (event) => {
		setTitle(event.target.value)	
	}

	return (
		<input 
		 id="edit-title" 
		 className={`
			 font-display italic font-semibold text-[1.3rem] text-ink caret-vermilion
			 placeholder:font-normal placeholder:text-ink-faint
			 h-full min-w-0 bg-transparent flex-grow border-none px-3 outline-none
			 transition-colors duration-150 focus:bg-paper-deep/60
		 `}
		 type="text"
		 placeholder="What are we Researching...?"
		 value={title}
		 onChange={handleChange}
		/>
	)
}
