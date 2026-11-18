import React from 'react';
import { createPortal } from 'react-dom'
import Settings from '@universal/Components/Settings/Settings.jsx'
import { NotateContext } from '@notate/Notate.jsx';
import WhatsNewWidget from './WhatsNewWidget.jsx'
import ExportAllItem from './ExportAllItem.jsx'

export default function SettingsWidget() {
	const NOTATE_CONTEXT = React.useContext(NotateContext)
	
	const [ scrollState, setScrollState ] = NOTATE_CONTEXT.SCROLL_STATE_CONTEXT

	// Shared, so the search bar and the board know the settings are open.
	const [ widgetState, setWidgetState ] = NOTATE_CONTEXT.SETTINGS_OPEN_CONTEXT

	const handleSettingsWidgetClick = () => {
		setWidgetState(!widgetState)	
	}

	// On the board the button sits in the header's row. Placed absolutely it lay on top of the header's counts.
	const [ slot, setSlot ] = React.useState(null)
	React.useLayoutEffect(() => setSlot(document.getElementById('board-settings-slot')))

	React.useEffect(()=>{
		setScrollState(!widgetState)
	},[widgetState])

	const button = (
		<button id="settings-widget"
		type="button"
		aria-label="Settings"
		title="Settings"
		className={`smallcaps focus-ink flex items-center gap-2 pb-1 border-b border-ink text-ink trans-ease hover:text-vermilion-ink hover:border-vermilion`}
		onClick={handleSettingsWidgetClick}>
			<span aria-hidden="true" className="text-[15px] leading-none">&sect;</span>Settings
		</button>
	)

	return (
		<>
			{ slot
				? createPortal(<><WhatsNewWidget/>{button}</>, slot)
				: <div className="absolute top-5 right-6 sm:right-12 xl:right-16 z-button flex items-center gap-8"><WhatsNewWidget/>{button}</div> }
			{
				widgetState && 
					<Settings
					 ContextAdapter={NOTATE_CONTEXT}
					 targetModule={["Notate", "WebContent"]}
					 setterCallback={setWidgetState}
					 extra={<ExportAllItem/>}
					/> 
			}
		</>
	)
}
