import React from 'react'
import CloseModalButton from './CloseModalButton.jsx'
import DeleteNotebookButton from './DeleteNotebookButton.jsx'


export default function RightSection() {

	return (
	  			<div id="notebook-modal-seperator"
	  			className="flex flex-col h-full shrink-0 w-[11rem] ml-auto py-5 px-6 items-end border-l border-ink">
					<CloseModalButton/>
					<span id="spacer" className="flex-grow"></span>
					<DeleteNotebookButton/>
				</div>
	)
}
