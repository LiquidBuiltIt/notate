import React from 'react';
import NoteEditorTopbar from './Components/NoteEditorTopbar/NoteEditorTopbar.jsx';
import TextEditor, { TextInputContext } from '@universal/Components/TextEditor/TextEditor.jsx';
import { NoteEditorWindowDisplayContext } from './Components/NoteEditorTopbar/Components/EditorWindowController.jsx'
import NoteEditorTitle, { NoteEditorTitleContext } from './Components/NoteEditorTopbar/Components/NoteEditorTitle.jsx';
import SaveNoteButton from './Components/Buttons/SaveNoteButton.jsx';

import { WebContentContext } from '@content/content.jsx'
import noteSwatch from '@universal/Utils/noteSwatch.js'
import { sanitizeHtml } from '@universal/Components/TextEditor/Components/TextInput/InputFormatters.js'
import { EditorLinksContext, findByTitle } from '@universal/Components/TextEditor/linksContext.js'



export default function NoteEditor() {
	const MAXIMIZED = true
	const MINIMIZED = false

	const { SHADOW_ROOT_ELEMENT, NOTE_CONTEXT, TEXT_BUFFER_CONTEXT, NOTE_WINDOW_CONTEXT, NOTATE_DB_CONTEXT } = React.useContext(WebContentContext)
	const [ , setNoteWindowState ] = NOTE_WINDOW_CONTEXT
	const [ database ] = NOTATE_DB_CONTEXT
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

	// Open on the side away from the seal, so the editor does not cover it.
	const [ sealLeft, setSealLeft ] = React.useState(false)
	React.useEffect(() => {
		chrome.storage.local.get('sealCorner').then(({ sealCorner }) => setSealLeft(!!sealCorner?.endsWith('left')))
	}, [])

	React.useEffect(()=> {
		if (!note.id) {
			setBuffer({
				title: title,
				content: content
			})
		}
	},[ title, content ])

	// Only the notes this page already has can be opened from a link; tags do nothing here. A note with unsaved changes stays open.
	const pageNotes = database?.inventory?.NOTES ?? []
	const EDITOR_LINKS = {
		titles: pageNotes.map((n) => n.title),
		openNote: (linkTitle) => {
			const target = findByTitle(pageNotes, linkTitle)
			if (!target || target.id === note?.id) return
			const plain = (html) => sanitizeHtml(html ?? '').replace(/ style="[^"]*"/g, '') // the editor adds inline styles to what it loads
			if (note?.id && (title !== note.title || plain(content) !== plain(note.content))) return
			setNoteWindowState(false)
			setTimeout(() => setNoteWindowState(true), 50)
			setNote(target)
		}
	}

	return (
		<NoteEditorWindowDisplayContext.Provider value={[ displayState, updateDisplayState ]}>
			<div 
			 id="note-editor-container"
			 className={`
				 fixed bottom-1.5 max-w-[calc(100vw-4rem)] animate-[unfold_380ms_cubic-bezier(.2,.8,.2,1)_backwards]
				 ${ sealLeft ? 'right-0 mr-10 origin-bottom-left' : 'left-0 ml-10 origin-bottom-right' }
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
							<EditorLinksContext.Provider value={EDITOR_LINKS}>
								<
								 TextEditor 
								 ToolbarComponents={<SaveNoteButton/>} 
								 TailwindClassNames={`
									 fill-ink stroke-ink bg-transparent
								 `}
								 ShadowRootElement={shadowRootElement}
								/>	
							</EditorLinksContext.Provider>
						</TextInputContext.Provider>
					</NoteEditorTitleContext.Provider>
				</div>
			</div>
		</NoteEditorWindowDisplayContext.Provider>
	)
}


