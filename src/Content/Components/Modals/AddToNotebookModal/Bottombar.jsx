import React from 'react'
import { ModalControllerContext } from '@content/Components/Modals/Modal.jsx'

const NOTATE_DB = "notate"
const ERROR_LOGGING_DB = "errorLogging"
const USER_CONFIGURATION_DB = "userConfiguration"


export default function Bottombar() {
	const { 
		QUEUE, 
		REQUEST,
		EXIT_MODAL: exitModal } = React.useContext(ModalControllerContext)
	const [ queue, add2Queue ] = QUEUE
	const [ response, makeRequest ] = REQUEST

	const [ isEnabled, setIsEnabled ] = React.useState(false)

	const handleSave = async (event) => {
		if (!event.isTrusted) return
		if (queue.length > 0) {
			queue.forEach( async tx => {
				await makeRequest({
					type: 'POST_DATABASE',
					data: tx,
					store: 'NOTEBOOKS',
					database: NOTATE_DB 
				})
			})
		}
		exitModal()
	}

	React.useEffect(()=>{
		if (queue.length > 0) {
			setIsEnabled(true)	
		} else {
			setIsEnabled(false)
		}
	}, [queue])

	return (
		<footer id="add-to-notebook-bottombar" className={`flex justify-end`}>
			<button 
			 id="save-btn" 
			 onClick={handleSave}
			 disabled={!isEnabled}
			 className={`
			 	trans-ease btn-sm-icon text-white ${ isEnabled 
				? "bg-green-500 hover:bg-green-400" : "bg-zinc-400" }
			`}>{`Save`}</button>	
		</footer>
	)
}
