import React from 'react';
import NoteEditorTopbar from './Components/NoteEditorTopbar/NoteEditorTopbar.jsx';
import TextEditor, { TextInputContext } from '@universal/Components/TextEditor/TextEditor.jsx';
import { NoteEditorWindowDisplayContext } from './Components/NoteEditorTopbar/Components/EditorWindowController.jsx'
import NoteEditorTitle, { NoteEditorTitleContext } from './Components/NoteEditorTopbar/Components/NoteEditorTitle.jsx';
import SaveNoteButton from './Components/Buttons/SaveNoteButton.jsx';

import { WebContentContext } from '@content/content.jsx'
import noteSwatch from '@universal/Utils/noteSwatch.js'



export default function NoteEditor() {
	const MAXIMIZED = true
	const MINIMIZED = false

	const { SHADOW_ROOT_ELEMENT, NOTE_CONTEXT, TEXT_BUFFER_CONTEXT } = React.useContext(WebContentContext)
	const [ note, setNote ] = NOTE_CONTEXT
	const [shadowRootElement] = SHADOW_ROOT_ELEMENT
	const [ buffer, setBuffer ] = TEXT_BUFFER_CONTEXT


	const [ displayState, updateDisplayState ] = React.useState(MINIMIZED)
	const [ content,  setContent ] = React.useState(note?.content || buffer?.content)
	const [ title, setTitle ] = React.useState(note?.title || buffer?.title)
	const swatch = noteSwatch(note?.color)


	React.useEffect(()=>{ 
		updateDisplayState(MAXIMIZED) 
	},[])

	React.useEffect(()=> {
		if (!note.id) {
			setBuffer({
				title: title,
				content: content
			})
		}
	},[ title, content ])

	return (
		<NoteEditorWindowDisplayContext.Provider value={[ displayState, updateDisplayState ]}>
			<div 
			 id="note-editor-container"
			 className={`
				 fixed bottom-1.5 left-0 ml-10 max-w-[calc(100vw-4rem)]
				 origin-bottom-right animate-[unfold_380ms_cubic-bezier(.2,.8,.2,1)_backwards]
				 ${ !displayState && "pointer-events-none" }
			`}>

				<div 
				 id="note-editor" 
				 className={`
					relative flex flex-col trans-ease size-[35rem] max-w-full pl-1.5
					paper-grain border border-ink shadow-print font-serif text-ink
					 ${ displayState ? "" : "translate-y-[92.856%]" }
				`}>
					<span id="note-spine" aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${swatch.bg}`}/>

					<NoteEditorTitleContext.Provider value={[ title, setTitle ]}>
						<NoteEditorTopbar/>

						<TextInputContext.Provider value={[ content, setContent ]}>
							<
							 TextEditor 
							 ToolbarComponents={<SaveNoteButton/>} 
							 TailwindClassNames={`
								 fill-ink stroke-ink bg-transparent
							 `}
							 ShadowRootElement={shadowRootElement}
							/>	
						</TextInputContext.Provider>
					</NoteEditorTitleContext.Provider>
				</div>
			</div>
		</NoteEditorWindowDisplayContext.Provider>
	)
}


