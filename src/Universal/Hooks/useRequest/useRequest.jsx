import React from 'react'
import browser from 'webextension-polyfill'
import DatabaseAdapter from '@universal/Handlers/IdbHandler.js'
import { BROWSER_TYPE } from '@background/Utils/browserType.js'


const POST = 'POST_DATABASE'
const POST_BATCH = 'POST_DATABASE_BATCH'
const GET = 'GET_DATABASE'
const DELETE = 'DELETE_DATABASE'
const REFRESH = 'RELOAD_DATABASE'



// A reply that takes longer than this counts as a failure. The background always replies (success or error), so this
// only ends a wait that would otherwise last forever. Two minutes is far above the slowest normal request (a
// large database read or a batch of 500 notes takes seconds), because a write already running is not undone by giving up.
export const REQUEST_TIMEOUT = 120_000

// Sends one request to the background and resolves with its reply, or false when it failed.
// A closed port (the service worker restarted) or a missing reply after `timeout` counts as a failure.
export const sendRequest = async (request, timeout = REQUEST_TIMEOUT) => {
	if (request?.type && request?.database) {
		const { type, database } = request

		const payload = {
			type: type,
			database: database 
		}

		if (type === POST || type === POST_BATCH || DELETE && request?.data && request?.store) {
			payload.data = request.data
			payload.store = request.store
			if (request.id !== undefined) payload.id = request.id
		}

		const response = await messageBackgroundScript(payload, timeout)

		if (response?.data && response?.database) {
			return response 
		} 
	} 
}

const messageBackgroundScript = (payload, timeout) => new Promise((resolve) => {
	const { type, database, data, store, id } = payload

	const port = browser.runtime.connect({ name: 'DATABASE_CONNECTION' })
	const message = {
		type: type,
		content: { database: database }
	}

	if (data && store) {
		message.content.data = data
		message.content.store = store
		if (id !== undefined) message.content.id = id
	}

	const timer = setTimeout(() => { port.disconnect(); resolve(false) }, timeout)
	const done = (value) => { clearTimeout(timer); resolve(value) }

	port.postMessage(message)

	port.onDisconnect.addListener(() => done(false))

	port.onMessage.addListener( message => {
		if (BROWSER_TYPE === 'firefox') {
			const parsed = JSON.parse(message)
			message = parsed
		}

		if (message.type === 'DATABASE') {
			if (typeof message.content?.data === 'object') {
				Object.setPrototypeOf(message.content.data, DatabaseAdapter.prototype)

				done(message.content)
			} else {
				done(false)
			}
		}
	})
})


export default function useRequest() {
	const [ response, setResponse ] = React.useState(false)	
	const [ request, setRequest ] = React.useState(null)
	const [ processing, setProcessing ] = React.useState(false)

	const makeRequest = React.useCallback( newRequest => {
		setRequest(newRequest)
	})

	React.useEffect(()=>{
		const processor = async (request) => {

			const { database } = request

			const result = await sendRequest(request)

			setProcessing(false)


			if (result && typeof result === 'object') {

				setResponse({
					type: 'RESULT',
					status: '200',
					content: result
				})
			} else {
				setResponse({
					type: 'RESULT',
					status: '400',
					content: { 
						database: database,
						type: request.type,
						data: request?.data,
						store: request?.store,
						id: request?.id
					} 
				})
			}
		}

		if (typeof request === 'object' && request != null) {
			setProcessing(true)
			processor(request)
		}
	}, [request])


	
	return [ response, makeRequest, processing ]
}




