import React from 'react';
import { SettingsContext } from '../../Settings.jsx'


export default function SettingsTopBar() {
	const { EXIT_CONTEXT } = React.useContext(SettingsContext)

	const [ exitState, setExitState ] = EXIT_CONTEXT

	const handleExitSettingsButtonClick = () => {
		setExitState(true)
	}

	return (
		<header id="settings-top-bar"
		className="w-full flex pt-6 pb-3 mb-4 items-baseline justify-between border-b-2 border-ink">
			
			<h1 id="settings-title" className="font-display italic font-semibold text-[40px] leading-none text-ink">Settings</h1>

			<button 
			 id="exit-settings-button"
			 aria-label="Close settings"
			 title="Close settings"
			 className="focus-ink font-serif text-[34px] leading-none px-2 text-ink-soft transition duration-150 ease-out hover:text-vermilion-ink"
			 onClick={handleExitSettingsButtonClick}
			>
				&times;
			</button>
		</header>
	)
}
