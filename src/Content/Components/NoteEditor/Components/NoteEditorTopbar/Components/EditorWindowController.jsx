import React from 'react';
import { WebContentContext } from '@content/content.jsx'

import CloseBtn from '@assets/Designs/Window-Controls/close-icon.svg';
import MaximizeBtn from '@assets/Designs/Window-Controls/maximize-icon.svg';
import MinimizeBtn from '@assets/Designs/Window-Controls/minimize-icon.svg';


export const NoteEditorWindowDisplayContext = React.createContext()


export default function EditorWindowController() {
	const MAXIMIZED = true
	const MINIMIZED = false

	const { NOTE_WINDOW_CONTEXT, NOTE_CONTEXT  } = React.useContext(WebContentContext)
	const [ noteWindowState, updateNoteWindowState ] = NOTE_WINDOW_CONTEXT
	const [ note, setNote ] = NOTE_CONTEXT

	const [ displayState, updateDisplayState ] = React.useContext(NoteEditorWindowDisplayContext)

	const runCloseWindow = (event) => {
		if (!event.isTrusted) return
		updateNoteWindowState(false)
	}

	const runMaximizeWindow = (event) => {
		if (!event.isTrusted) return
		updateDisplayState(MAXIMIZED)
	}

	const runMinimizeWindow = (event) => {
		if (!event.isTrusted) return
		updateDisplayState(MINIMIZED)
	}

	React.useEffect(()=>{
		if (!noteWindowState) {
			setNote(false)
		}
	},[noteWindowState])

	return (
		<div id="editor-window-ctrl-center"
			className="flex px-2 items-center pointer-events-auto">	
				
			<MinimizeBtn
				className="trans-ease size-8 rounded fill-black opacity-35 cursor-pointer hover:opacity-50"
				onClick={runMinimizeWindow}/>
			<MaximizeBtn
				className="trans-ease size-8 rounded fill-black opacity-35 cursor-pointer hover:opacity-50"
				onClick={runMaximizeWindow}/>
			<CloseBtn 
				className="trans-ease size-8 rounded fill-black opacity-35 cursor-pointer hover:fill-red-400 hover:opacity-100"
				onClick={runCloseWindow}/>
		</div>
	)
}
