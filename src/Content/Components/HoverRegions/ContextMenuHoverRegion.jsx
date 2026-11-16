import React from 'react';
import { WebContentContext } from '@content/content.jsx'
import ContextMenuButton from '@content/Components/ContextMenu/ContextMenuButton.jsx'
import ContextMenu from '@content/Components/ContextMenu/ContextMenu.jsx'
import { 
	isContextMenuDismissedForSite, 
	isContextMenuDismissedForSession 
} from '@content/Components/ContextMenu/Buttons/dismissUtils.js'


export const ContextMenuHoverRegionContext = React.createContext()

const NOTATE_DB = "notate"
const ERROR_LOGGING_DB = "errorLogging"
const USER_CONFIGURATION_DB = "userConfiguration"


export default function ContextMenuHoverRegion() {
	const { USER_CONFIGURATION_DB_CONTEXT, 
		REQUEST_CONTEXT, 
		SHADOW_ROOT_ELEMENT,
		CONTEXT_MENU_CONTEXT,
		MENU_DISMISSED_CONTEXT } = React.useContext(WebContentContext)

	// Use the shared context for menu dismissed state
	const [ isMenuDismissed, setIsMenuDismissed ] = MENU_DISMISSED_CONTEXT
	const [ isHovered, setIsHovered ] = React.useState(false)
	// Which viewport corner the seal sits in: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
	const [ corner, setCorner ] = React.useState('bottom-right')
	
	const HOVER_REGION_CONTEXT = {
		CONTEXT_MENU_CONTEXT: CONTEXT_MENU_CONTEXT,
		HOVER_CONTEXT: [isHovered, setIsHovered],
		CORNER_CONTEXT: [corner, setCorner]
		// No need to expose SET_MENU_DISMISSED as it's now in WebContentContext
	}

	const [ shadow ] = SHADOW_ROOT_ELEMENT
	const [ database ] = USER_CONFIGURATION_DB_CONTEXT 
	const [ request, makeRequest ] = REQUEST_CONTEXT

	const [ contextMenuButton, setContextMenuButton ] = React.useState(false) 
	const [ contextMenuState, setContextMenuState ] = CONTEXT_MENU_CONTEXT
	const hoverReginonRef = React.useRef(null)

	const handleContextMenuUnfocus = (event) => {
		const target = event.target.closest('#content-script-entry-point')

		if (!target) {
			setContextMenuState(false)
		}
	}

	// Removed console.log useEffect


	// The seal's corner is global, so it lives in extension storage, not the page's.
	React.useEffect(() => {
		chrome.storage.local.get('sealCorner').then(({ sealCorner }) => sealCorner && setCorner(sealCorner))
	}, [])

	// Check dismissal status when component mounts
	React.useEffect(() => {
		const checkDismissalStatus = () => {
			try {
				const currentSite = window.location.hostname;
				
				// Check site-specific dismissal
				if (isContextMenuDismissedForSite(currentSite, database)) {
					setContextMenuState(false);
					setIsMenuDismissed(true);
					return;
				}
				
				// Check session-wide dismissal (now synchronous)
				const isDismissedForSession = isContextMenuDismissedForSession();
				if (isDismissedForSession) {
					setContextMenuState(false);
					setIsMenuDismissed(true);
				} else {
					setIsMenuDismissed(false);
				}
			} catch (error) {
				// Removed console.error
			}
		};
		
		// Only check dismissal if database is available
		if (database) {
			checkDismissalStatus();
		} else {
		}
	}, [database]);

	React.useEffect(()=>{
		const asyncProcessor = async () => {
			if (database) {
				const user = database?.inventory?.USER_CONFIGURATION[0]?.WebContent?.behavior?.contextMenuPopup?.value
				const value = user === "true"
				setContextMenuButton(value)
			} else {
				await makeRequest({
					type: 'GET_DATABASE',
					database: USER_CONFIGURATION_DB
				})
			}
		}

		asyncProcessor()
	},[database])


	React.useEffect(()=>{
		if (contextMenuState) {
			document.addEventListener('click', handleContextMenuUnfocus)
		} else {
			document.removeEventListener('click', handleContextMenuUnfocus)
		}
	},[contextMenuState])

	// Custom handlers for mouse events
	const handleMouseEnter = () => {
		setIsHovered(true);
	};

	const handleMouseLeave = () => {
		setIsHovered(false);
	};

	// Early return if the menu is dismissed
	if (isMenuDismissed) {
		return null
	}

	return (
		<ContextMenuHoverRegionContext.Provider value={HOVER_REGION_CONTEXT}>
			<div 
			 id="context-menu-hover-region"
			 ref={hoverReginonRef}
			 className={`
				pointer-events-none fixed flex size-[7rem] items-center justify-center transition-opacity duration-300
				${ corner.startsWith('top') ? 'top-8' : 'bottom-0' /* top-8 clears the related notes ribbon */ }
				${ corner.endsWith('left') ? 'left-0' : 'right-0' }
			 `}
			 onMouseEnter={handleMouseEnter}
			 onMouseLeave={handleMouseLeave}
			>
				{/* The only live part of the region while the seal is hidden: a strip along its screen edge that reaches the shown seal. */}
				<div
				 id="context-menu-hover-strip"
				 className={`pointer-events-auto absolute inset-x-0 h-8 ${ corner.startsWith('top') ? 'top-0' : 'bottom-0' }`}
				/>
				<div
				 id="context-menu-items"
				 className="w-20 h-20 flex flex-col items-center justify-center relative transition-opacity duration-300"
				>
					<ContextMenu/>
					{contextMenuButton && <ContextMenuButton/>}
				</div>
			</div>
		</ContextMenuHoverRegionContext.Provider>
	)
}
