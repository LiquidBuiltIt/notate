import React from 'react';
import SaveNotebookButton from './SaveNotebookButton.jsx'
import DeleteNotebookButton from './DeleteNotebookButton.jsx'
import { NotateContext } from '@notate/Notate.jsx'


export default function BottomBar() {
	const [ notebook ] = React.useContext(NotateContext).NOTEBOOK_CONTEXT

	return (
		<div id="notebook-modal-bottombar"
		className="shrink-0 flex items-center gap-6 mt-4 pt-4 border-t border-ink">
			<SaveNotebookButton/>
			{ !!notebook.id && <DeleteNotebookButton/> }
		</div>
	)
}
