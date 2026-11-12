import React from 'react';
import { SettingsContext } from '../../Settings.jsx'



export default function SettingsBottomBar() {
	const { SAVE_CONTEXT } = React.useContext(SettingsContext)
	const [ saveState, setSaveState ]  = SAVE_CONTEXT


	const handleSaveClick = () => {
		setSaveState(true)	
	}


	return (
		<footer id="settings-bottom-bar"
		className="w-full flex py-5 border-t border-ink">
			<button id="save-settings-button"
			className="focus-ink smallcaps h-10 px-8 rounded-none bg-ink text-paper transition duration-150 ease-out hover:bg-vermilion"
			onClick={handleSaveClick}>
				Save
			</button>
		</footer>
	)
}
