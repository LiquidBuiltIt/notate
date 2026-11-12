import React from 'react';
import Settings from '@universal/Components/Settings/Settings.jsx'
import { NotateContext } from '@notate/Notate.jsx';

export default function SettingsWidget() {
	const NOTATE_CONTEXT = React.useContext(NotateContext)
	
	const [ scrollState, setScrollState ] = NOTATE_CONTEXT.SCROLL_STATE_CONTEXT

	const [ widgetState, setWidgetState ] = React.useState(false)

	const handleSettingsWidgetClick = () => {
		setWidgetState(!widgetState)	
	}

	React.useEffect(()=>{
		setScrollState(!widgetState)
	},[widgetState])

	return (
		<>
			<button id="settings-widget"
			type="button"
			aria-label="Settings"
			title="Settings"
			className="smallcaps focus-ink absolute top-5 right-6 sm:right-12 xl:right-16 z-button flex items-center gap-2 pb-1 border-b border-ink text-ink trans-ease hover:text-vermilion-ink hover:border-vermilion"
			onClick={handleSettingsWidgetClick}>
				<span aria-hidden="true" className="text-[15px] leading-none">&sect;</span>Settings
			</button>
			{
				widgetState && 
					<Settings
					 ContextAdapter={NOTATE_CONTEXT}
					 targetModule={["Notate", "WebContent"]}
					 setterCallback={setWidgetState}
					/> 
			}
		</>
	)
}
