import React from 'react';
import { NotateContext } from '@notate/Notate.jsx'
import { NotebookModalContext } from './NotebookModal.jsx'



export default function NotebookInfoSection () {
	const { NOTEBOOK_CONTEXT } = React.useContext(NotateContext)
	const [ notebook, setNotebook ] = NOTEBOOK_CONTEXT

	const { TITLE_CONTEXT, DESCRIPTION_CONTEXT, COLLECTION_CONTEXT } = React.useContext(NotebookModalContext)
	const [ title, setTitle ] = TITLE_CONTEXT 
	const [ description, setDescription ] = DESCRIPTION_CONTEXT 





	const handleTitleChange = (e) => { setTitle(e.target.value) }


	const handleDescriptionChange = (e) => { setDescription(e.target.value) }


	React.useEffect(()=>{ },[])


	return (
		<div id="notebook-info-section" className="flex flex-col h-full w-[18rem] shrink-0 py-5 pl-8 pr-6 gap-4 border-r border-ink">
			<p className="smallcaps text-vermilion-ink">Notebook</p>
			<input 
			 id="notebook-title" 
			 aria-label="Notebook title"
			 className="font-display italic text-[30px] leading-tight text-ink caret-vermilion bg-transparent border-b border-ink rounded-none pb-1 outline-none placeholder:text-ink-faint focus:border-vermilion"
			 value={title}
			 placeholder="Name this notebook"
			 onChange={handleTitleChange}
			/>

			<textarea 
			 id="notebook-description" 
			 aria-label="Notebook description"
			 className="flex-grow resize-none outline-none bg-transparent font-serif italic text-[17px] leading-relaxed text-ink-soft caret-vermilion placeholder:text-ink-faint"
			 placeholder="Organize your thoughts..."
			 type="text"
			 value={description}
			 onChange={handleDescriptionChange}
			/>
		</div>
	)
}
