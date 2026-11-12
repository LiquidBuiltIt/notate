import React from 'react';
import NotificationHandler from '@universal/Handlers/NotificationHandler.js';

export const NotificationContext = React.createContext()

export default function NotificationMsg() {
	const [ notification, setNotification ] = React.useContext(NotificationContext)

	const [selfState, setSelfState] = React.useState(false)
	const [ visible, setVisibility ] = React.useState(true)

	
	const TTL = async (duration) => {
	
	
		await new Promise(resolve => {
			setTimeout( async ()=>{
				setVisibility(false)
				await new Promise(resolve => setTimeout(resolve,300))
				resolve()
			}, duration)
		})


		if (notification?.active) {
			setNotification(new NotificationHandler)	
		} 


	} 


	React.useEffect(()=>{ 
		if (notification?.active) {
			setVisibility(true)
			TTL(notification?.duration);
		}


	},[notification?.active])



	const KIND = {
		info:  { label: 'Notice',  spine: 'bg-swatch-green' },
		warn:  { label: 'Caution', spine: 'bg-swatch-yellow' },
		error: { label: 'Erratum', spine: 'bg-vermilion' },
	}
	const kind = KIND[notification?.type] ?? KIND.info


	return (

		notification?.active && (
			<div 
			 id="notification-banner"
			 role="status"
			 aria-live="polite"
			 className={`
				 pointer-events-none fixed inset-x-0 bottom-10 flex justify-center z-notification 
				 ${visible ? "opacity-100" : "opacity-0" } 
				 transition-opacity duration-300 ease-in-out 
			`}>
				<div 
				 id="notification"
				 className="animate-rise relative flex items-stretch min-w-[18rem] max-w-[31rem] rounded-none paper-grain hairline shadow-print-sm font-serif text-ink"
				>
					<div id="external" className={`w-[6px] ${kind.spine}`} aria-hidden="true"/>
					<div id="internal" className="flex flex-col gap-[6px] py-3 pl-4 pr-6">
						<span id="notification-label" className="smallcaps text-ink-faint">{kind.label}</span>
						<h3 
						 id="message"
						 className="text-[17px] leading-snug font-medium"
						>{notification?.message}</h3>
					</div>
				</div>
			</div>
		)
	)
}
