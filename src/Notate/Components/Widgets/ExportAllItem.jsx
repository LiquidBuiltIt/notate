import React from 'react';
import { NotateContext } from '@notate/Notate.jsx'
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx'
import { backupExport, download } from '@notate/exportNotes.js'

// New tab Settings only: the web page Settings has no export, so no download link ever sits in a page's DOM.
export default function ExportAllItem() {
	const [ database ] = React.useContext(NotateContext).NOTATE_DB_CONTEXT
	const [ notification, setNotification ] = React.useContext(NotificationContext)

	const handleClick = () => {
		try {
			const { name, blob } = backupExport(database?.inventory?.NOTES ?? [], database?.inventory?.NOTEBOOKS ?? [])
			download(name, blob)
		} catch (error) {
			console.error('Error exporting notes:', error)
			setNotification(notification.showError())
		}
	}

	return (
		<li id="export-all" className="list-none py-3 flex items-baseline justify-between gap-6">
			<span className="text-[16px] italic text-ink-soft">One backup file with every note and notebook, as Markdown and as full data.</span>
			<button id="export-all-button" onClick={handleClick} className="smallcaps focus-ink whitespace-nowrap border-b border-ink trans-ease hover:text-vermilion-ink hover:border-vermilion">Export all notes</button>
		</li>
	)
}
