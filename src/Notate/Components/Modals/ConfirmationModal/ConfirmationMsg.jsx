import React from 'react';
import { NotateContext } from '@notate/Notate.jsx';


export const ConfirmationMsgContext = React.createContext()


export default function ConfirmationMsg() {
	const { SCROLL_STATE_CONTEXT } = React.useContext(NotateContext)
	const [ scrollState, setScrollState ] = SCROLL_STATE_CONTEXT 

	const [ confMsgState, setConfMsgState ] = React.useContext(ConfirmationMsgContext)

	const performAction = () => {
		confMsgState?.action?.function()
		confMsgState?.action?.handleScroll ? setScrollState(true) : setScrollState(false)
		setConfMsgState(false)
	}

	const performCancel = () => {
		confMsgState?.action?.handleScroll ? setScrollState(true) : setScrollState(false)
		(typeof confMsgState?.action?.cancelCallback === 'function') ? confMsgState.action.cancelCallback() : ''
		setConfMsgState(false)
	}


	React.useEffect(()=>{
		setScrollState(false)
	},[])

	return (
		<div id="confirmation-modal-wrapper"
			className="fixed z-modal left-0 top-0 w-full h-screen bg-paper/75 flex items-center justify-center p-6">

			<div id="confirmation-modal"
				role="alertdialog"
				aria-labelledby="title"
				aria-describedby="message"
				className="paper-grain hairline shadow-print-lg flex flex-col w-[32rem] max-w-full p-8 -rotate-[.6deg] animate-unfold">

				<p className="smallcaps text-vermilion-ink flex items-center gap-3 mb-4">
					Erratum <span className="flex-grow h-px bg-ink" aria-hidden="true"></span> Please confirm
				</p>

				<div id="msg-content"
					className="w-full space-y-3">
					<h2 id="title"
						className="font-display italic text-[30px] leading-tight text-ink">{confMsgState?.title}</h2>
					<h3 id="message"
						className="font-serif font-normal text-[17px] leading-relaxed text-ink-soft">{confMsgState?.message}</h3>
				</div>

				<div id="btn-ctrl-center"
					className="flex gap-6 w-full justify-end items-center pt-8">
					<button id="cancel-btn"
						className="smallcaps focus-ink pb-1 border-b border-ink text-ink trans-ease hover:text-vermilion-ink hover:border-vermilion"
						onClick={performCancel}>Cancel</button>

					<button id="action-btn"
						className="smallcaps focus-ink px-6 py-4 bg-ink text-paper trans-ease hover:bg-vermilion"
						onClick={performAction}>{confMsgState?.action?.title}</button>
				</div>
			</div>
		</div>
	)
}
