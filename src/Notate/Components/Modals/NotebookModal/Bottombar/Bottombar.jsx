import React from 'react';
import SaveNotebookButton from './SaveNotebookButton.jsx'


export default function BottomBar() {

	return (
		<div id="notebook-modal-bottombar"
		className="flex h-[auto] w-full justify-between">
			<div id="left-side" className="w-auto justify-start">
				<SaveNotebookButton/>
			</div>
		</div>
	)
}
