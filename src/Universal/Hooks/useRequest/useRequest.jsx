import React from 'react'
import browser from 'webextension-polyfill'
import DatabaseAdapter from '@universal/Handlers/IdbHandler.js'
import { BROWSER_TYPE } from '@background/Utils/browserType.js'


const POST = 'POST_DATABASE'
const GET = 'GET_DATABASE'
const DELETE = 'DELETE_DATABASE'
const REFRESH = 'RELOAD_DATABASE'



// Sends one request to the background and resolves with its reply, or false when it failed.
// A closed port (the service worker restarted) counts as a failure. The background always replies
// otherwise (success or error), so there is no timer: a write still running is never given up on.
export const sendRequest = async (request) => {
	if (request?.type && request?.database) {
		const { type, database } = request

		const payload = {
			type: type,
			database: database 
		}

		if (type === POST || DELETE && request?.data && request?.store) {
			payload.data = request.data
			payload.store = request.store
			if (request.id !== undefined) payload.id = request.id
		}

		const response = await messageBackgroundScript(payload)

		if (response?.data && response?.database) {
			return response 
		} 
	} 
}

const messageBackgroundScript = (payload) => new Promise((resolve) => {
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

	port.postMessage(message)

	port.onDisconnect.addListener(() => resolve(false))

	port.onMessage.addListener( message => {
		if (BROWSER_TYPE === 'firefox') {
			const parsed = JSON.parse(message)
			message = parsed
		}

		if (message.type === 'DATABASE') {
			if (typeof message.content?.data === 'object') {
				Object.setPrototypeOf(message.content.data, DatabaseAdapter.prototype)

				resolve(message.content)
			} else {
				resolve(false)
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




