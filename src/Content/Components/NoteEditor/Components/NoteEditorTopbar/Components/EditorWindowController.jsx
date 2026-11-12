import React from 'react';
import { WebContentContext } from '@content/content.jsx'


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

	const ctrl = `
		focus-ink flex w-8 items-center justify-center border-l border-paper-edge font-serif
		text-[1.35rem] leading-none text-ink-soft cursor-pointer transition-colors duration-150
	`

	return (
		<div id="editor-window-ctrl-center"
			className="flex items-stretch pointer-events-auto border-l border-ink">	
				
			<button
				aria-label="Minimize"
				title="Minimize"
				className={`${ctrl} hover:bg-ink hover:text-paper`}
				onClick={runMinimizeWindow}>&ndash;</button>
			<button
				aria-label="Maximize"
				title="Maximize"
				className={`${ctrl} hover:bg-ink hover:text-paper`}
				onClick={runMaximizeWindow}>
				<span aria-hidden="true" className="block size-[0.65rem] border border-current"/>
			</button>
			<button 
				aria-label="Close"
				title="Close"
				className={`${ctrl} hover:bg-vermilion hover:text-paper`}
				onClick={runCloseWindow}>&times;</button>
		</div>
	)
}
