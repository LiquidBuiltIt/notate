import React from 'react';
import ReactDOM from 'react-dom/client';
import useRequest from '@universal/Hooks/useRequest/useRequest.jsx'

import DevTools from '@dev/devutils.js'

import RelatedNotesViewer from './Components/RelatedNotesViewer/RelatedNotesViewer.jsx'
import Modal from './Components/Modals/Modal.jsx'
import NoteEditor, {NoteEditorContext} from './Components/NoteEditor/NoteEditor.jsx'
import ContextMenuHoverRegion from './Components/HoverRegions/ContextMenuHoverRegion.jsx';
import NotificationMsg, { NotificationContext } from '@universal/Components/NotificationMessenger.jsx';
import NotificationHandler from '@universal/Handlers/NotificationHandler.js';
import notatecss from '@assets/tailwind.css'
import globalcss from '@assets/global.css'


/*
 * DevTool Call
*/
try {
	DevTools()
} catch(e){}


const tailwindStyles = notatecss.toString() + '\n' + globalcss.toString()


const NOTATE_DB = "notate"
const ERROR_LOGGING_DB = "errorLogging"
const USER_CONFIGURATION_DB = "userConfiguration"


const root = document.createElement('div')
root.id = 'content-script-entry-point'


const shadow = root.attachShadow({ mode: "closed" })


const style = document.createElement('style')
style.textContent = tailwindStyles


const content = document.createElement('div')
content.id = 'content-script-load'


document.body.insertAdjacentElement('beforebegin', root)
shadow.prepend(style, content)


export const WebContentContext = React.createContext() 

const ContentScript = () => {
	const CONTENT_SCRIPT_CONTEXT = {
		NOTE_WINDOW_CONTEXT: React.useState(false),
		NOTATE_DB_CONTEXT: React.useState(null),
		USER_CONFIGURATION_DB_CONTEXT: React.useState(null),
		REQUEST_CONTEXT: useRequest(),
		NOTE_CONTEXT: React.useState(null),
		MODAL_STATE_CONTEXT: React.useState(false),
		SHADOW_ROOT_ELEMENT: React.useState(shadow),
		CONTEXT_MENU_CONTEXT: React.useState(false),
		RELATED_NOTES_CONTEXT: React.useState(false),
		TEXT_BUFFER_CONTEXT: React.useState({ 
			title: '' , 
			content: '' 
		}),
		DARK_MODE_CONTEXT: React.useState(window.matchMedia('(prefers-color-scheme: dark)').matches),
		MENU_DISMISSED_CONTEXT: React.useState(false)
	}

	const [ noteWindowState, updateNoteWindowState ] = CONTENT_SCRIPT_CONTEXT.NOTE_WINDOW_CONTEXT 
	const [ note, setNote ] = CONTENT_SCRIPT_CONTEXT.NOTE_CONTEXT
	const [ notatedb, setNotate ] = CONTENT_SCRIPT_CONTEXT.NOTATE_DB_CONTEXT
	const [ userconfigurationdb, setUserConfiguration ] = CONTENT_SCRIPT_CONTEXT.USER_CONFIGURATION_DB_CONTEXT
	const [ response, makeRequest, processing ] = CONTENT_SCRIPT_CONTEXT.REQUEST_CONTEXT 
	const [ selectedModal ] = CONTENT_SCRIPT_CONTEXT.MODAL_STATE_CONTEXT

	const [ notification, setNotification ] = React.useState(new NotificationHandler)
	const [ selectedContextItem, setSelectedContextItem ] = React.useState(false)



	React.useEffect(()=>{
		const asyncProcessor = async () => {
			if (!notatedb?.inventory) {
				await makeRequest({
					type: 'GET_DATABASE',
					database: NOTATE_DB
				})
			}

			if (!userconfigurationdb?.inventory) {
				await makeRequest({
					type: 'GET_DATABASE',
					database: USER_CONFIGURATION_DB
				})
			}
		}

		asyncProcessor()
	},[response])

	
	React.useEffect(()=>{
		const responseHandler = async () => {
			if (response.type === 'RESULT' && response.status === '200') {
				const result = response.content

				if (result?.data && result?.database) {
					const db = result.data

					switch (result.database) {
						case NOTATE_DB:
							setNotate(db)
							break;
						case USER_CONFIGURATION_DB:
							setUserConfiguration(db)
							break;
					}
				}
			} else if (response.status === '400') {
				// Retry the request 

        			await makeRequest({ 
					type: response.content.type == 'GET_DATABASE' 
						? 'RELOAD_DATABASE' 
						: response.content.type, 
					database: response.content.database,
					data: response.content?.data,
					store: response.content?.store
				})
			}
		}

		if (!processing) {
			responseHandler()
		}
	},[response])



	return (
		<div id="root-container"
		className="relative font-sans text-black z-content-script">
			<WebContentContext.Provider value={CONTENT_SCRIPT_CONTEXT}>
				<NotificationContext.Provider value={[ notification, setNotification ]}>

					<RelatedNotesViewer/>

					{ notification?.active && <NotificationMsg/> }

					<ContextMenuHoverRegion/>

					{ note && noteWindowState && <NoteEditor/> }

					{ selectedModal && <Modal modal={selectedModal}/> }

				</NotificationContext.Provider>
			</WebContentContext.Provider>
		</div>	
	)
}




ReactDOM.createRoot(content).render(<ContentScript/>);



