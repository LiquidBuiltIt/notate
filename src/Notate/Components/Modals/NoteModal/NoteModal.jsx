import React from 'react';
import { NotateContext  } from '@notate/Notate.jsx';
import useError from '@universal/Hooks/useError/useError.jsx';

import NoteModalTopbar from './Topbar.jsx'
import NoteModalBottombar from './Bottombar.jsx'
import NoteModalInput from './Input.jsx'
import noteSwatch from '@universal/Utils/noteSwatch.js'
import { sanitizeHtml } from '@universal/Components/TextEditor/Components/TextInput/InputFormatters.js'
import { EditorLinksContext, findByTitle } from '@universal/Components/TextEditor/linksContext.js'
import { ConfirmationMsgContext } from '../ConfirmationModal/ConfirmationMsg.jsx'
import ConfirmationMsgHandler from '../ConfirmationModal/ConfimrationMsgHandler.js'



export const NoteModalContext = React.createContext()


export default function NoteModal() {
	const logError = useError();
	
	const { NOTE_CONTEXT,
		RECENT_NOTES_STATE_CONTEXT,
		NOTATE_DB_CONTEXT,
		USER_CONFIGURATION_DB_CONTEXT,
		SCROLL_STATE_CONTEXT,
		MODAL_STATE_CONTEXT,
		SEARCH_TERM_CONTEXT
	} = React.useContext(NotateContext)
	const [ , setConfMsgState ] = React.useContext(ConfirmationMsgContext)
	const [ database ] = NOTATE_DB_CONTEXT
	const [ , setSearchTerm ] = SEARCH_TERM_CONTEXT

  	const [note, setNote ] = NOTE_CONTEXT
	const [ updateRecentNotesState, triggerRecentNotesUpdateState ] = RECENT_NOTES_STATE_CONTEXT
	const [ userconfigurationdb ] = USER_CONFIGURATION_DB_CONTEXT 
	const [ scrollState, setScrollState ] = SCROLL_STATE_CONTEXT 
	const [ modalState, setModalState ] = MODAL_STATE_CONTEXT

	const NOTE_MODAL_CONTEXT = {
		TITLE_CONTEXT: React.useState(note.title), // on new note, value is undefined
		CONTENT_CONTEXT: React.useState(note.content),	// on new note, value is undefined 

		//TODO : fix color context not defaulting to config value on new note
		COLOR_CONTEXT: React.useState(note?.color?.name || userconfigurationdb?.inventory?.USER_CONFIGURATION[0]?.Notate?.noteModal?.preferredColor?.value)
	}


	// Note links and tags in the text. A change that is not saved asks first, as Delete does.
	const initial = React.useRef({ title: note.title, content: note.content })
	// The editor adds inline styles to the text it loads, so the compare ignores style attributes. A false "changed" only asks once more.
	const plain = (html) => sanitizeHtml(html ?? '').replace(/ style="[^"]*"/g, '')
	const dirty = () => NOTE_MODAL_CONTEXT.TITLE_CONTEXT[0] !== initial.current.title || plain(NOTE_MODAL_CONTEXT.CONTENT_CONTEXT[0]) !== plain(initial.current.content)
	const guarded = (go, handleScroll) => dirty()
		? setConfMsgState(new ConfirmationMsgHandler('Leave this note?', 'Your changes to this note are not saved.', 'Leave', go, handleScroll))
		: go()
	const notes = database?.inventory?.NOTES ?? []
	const EDITOR_LINKS = {
		titles: notes.map((n) => n.title),
		openNote: (title) => {
			const target = findByTitle(notes, title)
			if (target && target !== note && target.id !== note.id) guarded(() => setNote(target), false)
		},
		openTag: (tag) => guarded(async () => { await exitModal(); setSearchTerm('#' + tag) }, true)
	}

	const [transition, setTransition] = React.useState(false)
	const [mouseDownTarget, setMouseDownTarget] = React.useState(null);

	const modalRef = React.useRef(null);

	const handleMouseDown = (e) => {
		setMouseDownTarget(e.target);
	};


	const handleMouseUp = (e) => {
		if (e.target === e.currentTarget && mouseDownTarget && !modalRef.current.contains(mouseDownTarget)) {
			exitModal();
		}
		
		setMouseDownTarget(null);
	};

	const exitModal = async () => {
		try {
			setTransition(false)
			await new Promise(resolve => setTimeout(resolve, 300))
			setScrollState(true)
			setModalState(false)
			triggerRecentNotesUpdateState(true)
		} catch (error) {
			logError(error, {
				component: 'NoteModal',
				action: 'exitModal',
				note: note?.id
			});
			// Still attempt to close the modal even if an error occurs
			setScrollState(true)
			setModalState(false)
		}
	}


	const handlePreventingEventPropagation = (e) => { e.stopPropagation() }


  	React.useEffect(() => {
		try {
			if (note) setTransition(true)
			setScrollState(false)
		} catch (error) {
			logError(error, {
				component: 'NoteModal',
				action: 'useEffect-initialization',
				noteId: note?.id
			});
		}
	}, [note])


	const swatch = noteSwatch(NOTE_MODAL_CONTEXT.COLOR_CONTEXT[0])

	return (
		<div 
		 id="note-modal-container" 
    		 className={`
			 trans-ease fixed flex items-end justify-center z-modal left-0 top-0 w-full h-full
			 ${transition ? "bg-paper/75" : "bg-transparent" }
		 `}
    		 onMouseDown={handleMouseDown}
    		 onMouseUp={handleMouseUp}
		>
      			<div 
			 id="modal" 
      			 ref={modalRef}
      			 className={`
				 trans-ease flex flex-col ${ transition ? "translate-y-0" : "translate-y-full" }
				 paper-grain border-x border-t border-ink shadow-print-lg h-[85%] max-w-[56rem] 
				 py-6 pr-8 pl-10 w-[95%] relative box-border
			 `}
      			 onClick={handlePreventingEventPropagation}
			>
				<span id="modal-spine" className={`absolute left-0 top-0 bottom-0 w-[6px] ${swatch.bg}`} aria-hidden="true"></span>
	  			<NoteModalContext.Provider value={NOTE_MODAL_CONTEXT}>
					<NoteModalTopbar onExit={exitModal} />
					<EditorLinksContext.Provider value={EDITOR_LINKS}>
						<NoteModalInput onExit={exitModal}/>
					</EditorLinksContext.Provider>
					<NoteModalBottombar onExit={exitModal}/> 
	  		</NoteModalContext.Provider>
	  
      			</div>
    		</div>
  );
}
