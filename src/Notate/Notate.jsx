import React  from 'react';
import useTheme from '@universal/Hooks/useTheme/useTheme.jsx'
import useRequest from '@universal/Hooks/useRequest/useRequest.jsx'

import Helper from './helper.js'
import { NOTATE_DB, ERROR_LOGGING_DB, USER_CONFIGURATION_DB } from '@background/background.js'
import Masthead from './Masthead.jsx';
import Volumes from './Components/Volumes/Volumes.jsx';
import SearchBar from './Components/Search/SearchBar.jsx';
import RecentNotes from './Components/Recents/RecentNotes.jsx';
import NotebookModal from './Components/Modals/NotebookModal/NotebookModal.jsx';
import NoteModal from './Components/Modals/NoteModal/NoteModal.jsx';
import NotificationMsg, { NotificationContext } from '@universal/Components/NotificationMessenger.jsx';
import NotificationHandler from '@universal/Handlers/NotificationHandler.js';
import ConfirmationMsg, { ConfirmationMsgContext }  from './Components/Modals/ConfirmationModal/ConfirmationMsg.jsx';
import DragToTrashWidget from './Components/Widgets/DragToTrashWidget.jsx';
import SettingsWidget from './Components/Widgets/SettingsWidget.jsx'
import Board from './Components/Board/Board.jsx'
import { isBoardOn } from './Components/Board/boardMath.js'

import DevActionButton from './dev-action-button.jsx'


/* Constants */


/* Global Scope Variables */
const helper = new Helper


/* React Context Declarations  */
export const NotateContext = React.createContext()


/* Event Listeners */



/* App Component */
export default function Notate(){
	const [ wallpaperTheme, setWallpaperTheme ] = React.useState(false)

	  /* React useState Hooks */
	const NOTATE_CONTEXT = {
		NOTE_CONTEXT: React.useState(null),
		NOTEBOOK_CONTEXT: React.useState(null),
		SEARCH_TERM_CONTEXT: React.useState(''),
		RECENT_NOTES_STATE_CONTEXT: React.useState(true),
		DRAG_TO_TRASH_STATE_CONTEXT: React.useState(false),
		NOTATE_DB_CONTEXT: React.useState(null),
		USER_CONFIGURATION_DB_CONTEXT: React.useState(null),
		SCROLL_STATE_CONTEXT: React.useState(true),
		SETTINGS_OPEN_CONTEXT: React.useState(false),
		WHATS_NEW_OPEN_CONTEXT: React.useState(false),
		BOARD_API_CONTEXT: React.useRef(null),
		CONF_MSG_CONTEXT: React.useState(false),
		MODAL_STATE_CONTEXT: React.useState(false),
		REQUEST_CONTEXT: useRequest(),
		THEME_CONTEXT: useTheme(wallpaperTheme)
	}

	const [selectedNote, setSelectedNote] = NOTATE_CONTEXT.NOTE_CONTEXT 
	const [selectedNotebook, setSelectedNotebook] = NOTATE_CONTEXT.NOTEBOOK_CONTEXT 
	const [searchTerm] = NOTATE_CONTEXT.SEARCH_TERM_CONTEXT 
	const [ notatedb, setNotate ] = NOTATE_CONTEXT.NOTATE_DB_CONTEXT
	const [ userconfigurationdb, setUserConfiguration ] = NOTATE_CONTEXT.USER_CONFIGURATION_DB_CONTEXT
	const [ scrollState, setScrollState ] = NOTATE_CONTEXT.SCROLL_STATE_CONTEXT 
	const [ confMsgState, setConfMsgState ] = NOTATE_CONTEXT.CONF_MSG_CONTEXT
	const [ recentsState, setRecentsState ] = NOTATE_CONTEXT.RECENT_NOTES_STATE_CONTEXT

	// Nothing is drawn until the saved settings are in, so the layout never flashes the wrong one.
	const configReady = !!userconfigurationdb?.inventory
	const boardOn = isBoardOn(userconfigurationdb)

	const theme = NOTATE_CONTEXT.THEME_CONTEXT 
	const [ response, makeRequest, processing ] = NOTATE_CONTEXT.REQUEST_CONTEXT 

	const [ notification, setNotification ] = React.useState(new NotificationHandler);

	const [ devbool, setDevbool ] = React.useState(false)
	
	const failures = React.useRef(0)
	const notateInitialized = React.useRef(false)
	const userconfigurationIntialized = React.useRef(false)
	

	/* useEffect Hooks */
  	React.useEffect(() => {
		const asyncProcessor = async () => {
    			// Initial data fetch
			if (!notatedb?.inventory) {
    				await makeRequest({ type: 'GET_DATABASE', database: NOTATE_DB })
			}

			if (!userconfigurationdb?.inventory) {
    				await makeRequest({ type: 'GET_DATABASE', database: USER_CONFIGURATION_DB })
			}

		}

		asyncProcessor()

  	}, [response])


	React.useEffect(()=>{
		helper.visual.changeScrollState(scrollState)
	}, [scrollState])


	React.useEffect(() =>{
		const asyncProcessor = async () => {
			if (userconfigurationdb ) {
				setWallpaperTheme(userconfigurationdb?.inventory?.USER_CONFIGURATION[0]?.Notate?.page?.backgroundWallpaper?.value)	
			} else {
				await makeRequest({
					type: 'GET_DATABASE',
					database: USER_CONFIGURATION_DB 	
				})
			}
		}

		asyncProcessor()
	},[userconfigurationdb, wallpaperTheme])


	React.useEffect(() => {
		const responseHandler = async () => {
			if (response.type === 'RESULT') {
      				if (response.status === '200') {
        				const result = response.content;
        				failures.current = 0

        				if (result?.data && result?.database) {
        	  				const db = result.data;

        	  				switch (result.database) {
        	    					case NOTATE_DB:
        	      						setNotate(db);
        	      						break;

        	    					case USER_CONFIGURATION_DB:
        	      						setUserConfiguration(db);
        	      						break;
        	  				}

        	  				setRecentsState(true);
						
        				}
      				} else if (response.status === '400') {
					console.error('response: ', response)
        				console.error('Request failed');

        				// Retry a few times; a request that keeps failing (the background now reports errors) must not loop.
        				if (++failures.current > 3) return
        				await makeRequest({ 
						type: response.content.type == 'GET_DATABASE' 
							? 'RELOAD_DATABASE' 
							: response.content.type, 
						database: response.content.database,
						data: response.content?.data,
						store: response.content?.store,
						id: response.content?.id
					})
      				}
    			}
		}

		if (!processing) {
			responseHandler()
		}
  	},[response])


	  /* Component */
	  return (
		<div 
		  id="app" 
		  className="w-full min-h-screen flex flex-col flex-grow"
		>
		  	<NotateContext.Provider value={NOTATE_CONTEXT}>
		  	<div 
		  	 id="wallpaper-theme" 
		  	 className={`
				 relative min-w-full min-h-screen xl:h-screen xl:overflow-hidden flex flex-col flex-grow top-0 left-0 trans-ease
				 ${ theme.background || "" }
			`}>
					<ShadeComponent direction={"top"}/>
		  			<main 
		  			 id="notate" 
		  			 className="w-full flex-grow pb-28 xl:pb-0 xl:min-h-0 px-6 sm:px-12 xl:px-16 flex flex-col xl:grid xl:grid-cols-12 xl:grid-rows-[minmax(0,1fr)] xl:gap-x-14"
		  			>
						<NotificationContext.Provider value={[ notification, setNotification ]}>
					  	<ConfirmationMsgContext.Provider value={[confMsgState, setConfMsgState]}>

						{ configReady && !boardOn && <>
						<Masthead 
						 theme={theme} 
						 noteCount={notatedb?.inventory?.NOTES?.length ?? 0} 
						 notebookCount={notatedb?.inventory?.NOTEBOOKS?.length ?? 0}
						>
							<Volumes/>
						</Masthead>

						{/* wide screens: the page is locked and only the notes scroll, in their own box */}
						<div id="notate-content" className="xl:col-span-7 pt-14 xl:pt-24 min-w-0 xl:flex xl:flex-col xl:min-h-0">
							<div id="notate-scroll" className="xl:flex-1 xl:min-h-0 xl:overflow-y-auto xl:-mr-16 xl:pr-16 xl:pb-28">
								<RecentNotes searchTerm={searchTerm} />
							</div>
						</div>
						</> }
						{ configReady && boardOn && <Board/> }

						{selectedNote && !selectedNotebook && <NoteModal/>}
						{ confMsgState && <ConfirmationMsg/> }
					  	{ selectedNotebook && !selectedNote && <NotebookModal/> }

					  	<SearchBar/>
					  	<DragToTrashWidget key={`${configReady}-${boardOn}`}/>
						<NotificationMsg/>

					
						<SettingsWidget/>
						
					  	
					  	</ConfirmationMsgContext.Provider>
						</NotificationContext.Provider>		
		  			</main>
					<ShadeComponent direction={"bottom"}/>
		  	</div>
		  	</NotateContext.Provider>
		</div>
	  );
}



// Page edge rules: a heavy rule at the top, a hairline at the foot.
const ShadeComponent = ({direction}) => {
	const style = direction === 'top' ? "h-[3px]" : "h-px"

	return (
		<div id={`shader-${direction}`} className={`w-full ${style} bg-ink`}></div>
	)
}
