import browser from 'webextension-polyfill'
import DatabaseAdapter from '@universal/Handlers/IdbHandler.js';
import { BROWSER_TYPE } from './browserType.js'
import { applyPatch } from '@universal/Handlers/ConfigurationHandlers/patch.js'
import { isSiteNote } from '@universal/Utils/site.js'
import { senderKind, siteOf, vetContentRequest, trimForContent, canCreateNote } from './contentPolicy.js'

export const NOTATE_DB = "notate"
export const ERROR_LOGGING_DB = "errorLogging"
export const USER_CONFIGURATION_DB = "userConfiguration"



export default class CoreService {
	constructor() {
		this.databases = {
			notatedb: undefined,
			errorloggingdb: undefined,
			userconfigurationdb: undefined 
		}
		this.env = {
			important: {
				launchBehavior: undefined
			},
			common: {

			},
			namespace: {
				chromeStorage: {
					highPriority: "CHROME_STORE_HIGH_PRIORITY"
				}
			}
		}
	}
	

	async initializeDatabase(name) {
		return await new Promise(async (resolve, reject) => {
			let database;

			switch (name) {
				case NOTATE_DB:
					this.databases.notatedb = await new DatabaseAdapter(NOTATE_DB)
					database = this.databases.notatedb
					break;
				case ERROR_LOGGING_DB:
					this.databases.errorloggingdb = await new DatabaseAdapter(ERROR_LOGGING_DB)
					database = this.databases.errorloggingdb
					break;
				case USER_CONFIGURATION_DB:
					this.databases.userconfigurationdb = await new DatabaseAdapter(USER_CONFIGURATION_DB)
					database = this.databases.userconfigurationdb
					break;
			}

			await database.inventory

		//	if (name === USER_CONFIGURATION_DB) {
		//		await this.updateBackgroundEnvVariables()
		//	}

			resolve(database)
		})
	}


	// A content script runs inside a web page, so it gets a small fixed set of actions and only its own site's data.
	// Anything the browser did not tag as this extension's code is refused.
	async contentRequest(port, message, host) {
		const reply = (content) => this.sendMessage({ type: 'DATABASE', content }, port)
		const op = vetContentRequest(message, host)
		if (!op) return reply({})

		try {
			const key = op.database === NOTATE_DB ? 'notatedb' : 'userconfigurationdb'
			if (typeof this.databases[key] !== 'object') await this.initializeDatabase(op.database)
			const db = this.databases[key]

			let allowed = true
			if (op.op === 'createNote') {
				allowed = canCreateNote(await db.getInventory(), host)
				if (allowed) await db.insertData(op.note, 'NOTES')
			} else if (op.op === 'editNote') {
				// Checked inside the write, so the note cannot change between the check and the edit.
				await db.updateData('NOTES', record => (allowed = isSiteNote(record, host)) && applyPatch(record, op.patch), op.id)
			} else if (op.op === 'fileNotes') {
				const { NOTES } = await db.getInventory()
				allowed = op.ids.every(id => NOTES.some(note => note.id === id && isSiteNote(note, host)))
				if (allowed) await db.updateData('NOTEBOOKS', record => (allowed = !!record) && applyPatch(record, { collection: { $add: op.ids } }), op.id)
			} else if (op.op === 'config') {
				await db.updateData('USER_CONFIGURATION', record => (allowed = !!record) && applyPatch(record, op.patch))
			}

			if (!allowed) return reply({})
			reply({ data: trimForContent(op.database, await db.getInventory(), host), database: op.database })
		} catch (error) {
			await this.generateErrorLog(error, { function: 'contentRequest' })
			reply({})
		}
	}


	async databaseRequest(port, message)  {
		const kind = senderKind(port?.sender, browser.runtime)
		if (kind !== 'page') return this.contentRequest(port, message, kind === 'content' ? siteOf(port.sender) : null)

		try {
			if (
				(typeof port === 'object') && 
				message?.type && 
				message?.content && 
				message?.content?.database
			){
				let data, store, db;
	
	
				const { 
					type, 
					content: {database: target},  
				} = message
			
				switch (target) {
					case NOTATE_DB:
						if (typeof this.databases.notatedb !== 'object') {
							await this.initializeDatabase(NOTATE_DB)
						}

						db = this.databases.notatedb 
						break;
	
					case ERROR_LOGGING_DB:
						if (typeof this.databases.errorloggingdb !== 'object') {
							await this.initializeDatabase(ERROR_LOGGING_DB)
						}

						db = this.databases.errorloggingdb
						break;
	
					case USER_CONFIGURATION_DB:
						if (typeof this.databases.userconfigurationdb !== 'object') {
							await this.initializeDatabase(USER_CONFIGURATION_DB)
						}

						db = this.databases.userconfigurationdb
						break;
				}	
	
	
				switch (type) {
					case 'GET_DATABASE': 
						const payload = { 
							type: 'DATABASE', 
							content: { data: db, database: target }
							 
						}

						this.sendMessage(payload, port)
						break;
					
					case 'POST_DATABASE': 
						data = message?.content?.data
						store = message?.content?.store
		
						const insertOperation = async () => {
							await db
							await db.insertData
							
							if ( db.insertData === 'undefined' ) {
								await this.initializeDatabase(target)
								await insertOperation()

							} else if ( data && store && typeof db.insertData === 'function'  ) {
						 		await db.insertData(data, store)
								await this.initializeDatabase(target)
		
								// Since only Update Ops will be performed on this store, its safe
								// to always assume that this function needs to be ran after every
								// user configuration update.
								//if (store === 'USER_CONFIGURATION') await this.updateBackgroundEnvVariables()

								
								const payload = { 
									type: 'DATABASE', 
									content: { data: db, database: target }
								}

								this.sendMessage(payload, port)
	
							} else {
								await this.initializeDatabase(target)
								await insertOperation()
							}
	
						}
		
						await insertOperation()
		
						break;
					
					case 'POST_DATABASE_BATCH':
						// Extension pages only (contentPolicy refuses it for content scripts). One transaction, one reply.
						data = message?.content?.data
						store = message?.content?.store

						if ( Array.isArray(data) && data.length && store && typeof db.insertMany === 'function' ) {
							await db.insertMany(data, store)

							// A short reply: the sender asks for the inventory itself if it needs it, and a big inventory could be too large to send.
							this.sendMessage({
								type: 'DATABASE',
								content: { data: { saved: data.length }, database: target }
							}, port)
						} else {
							this.sendMessage({ type: 'DATABASE', content: {} }, port)
						}

						break;

					case 'PATCH_DATABASE':
						// Applies only what the sender changed to the stored record, so a sender
						// with an out-of-date copy cannot overwrite newer changes.
						data = message?.content?.data
						store = message?.content?.store

						if ( data && store && typeof db.updateData === 'function' ) {
							// { $each: [{ id, data }] } patches several records, each in its own transaction
							const patches = Array.isArray(data.$each) ? data.$each : [{ id: message?.content?.id, data }]
							for (const patch of patches) await db.updateData(store, record => record && applyPatch(record, patch.data), patch.id)
							await this.initializeDatabase(target)

							this.sendMessage({
								type: 'DATABASE',
								content: { data: db, database: target }
							}, port)
						} else {
							this.sendMessage({ type: 'DATABASE', content: {} }, port)   // an unusable request still gets a reply
						}

						break;

					case 'DELETE_DATABASE':
						data = message?.content?.data
						store = message?.content?.store
		
						const deleteOperation = async () => {
							await db

							if ( db.deleteData === 'undefined' ) {
								await this.initializeDatabase(target)
								await deleteOperation()

							} else if ( data && store && typeof db.deleteData === 'function' ) {
								await db.deleteData(data, store)
								await this.initializeDatabase(target)

								const payload = { 
									type: 'DATABASE', 
									content: { data: db, database: target }
									
								}

								this.sendMessage(payload, port)
							} else {
								await this.initializeDatabase(target)
								await deleteOperation()
							}
						}
		
						await deleteOperation()
		
						break;
					
					case 'RELOAD_DATABASE': 
						if (!db || db?.inventory instanceof Promise) {
							await this.initializeDatabase(target)
						} else {
							const payload = { 
								type: 'DATABASE', 
								content: { data: db, database: target },
								
							}

							this.sendMessage(payload, port)
						}
		
						break;
				}
			} else {
				throw new Error("message " + JSON.stringify(message) + "\n" + 
					" either has an invalid schema or is missing one or more required properties." +
					"\nmessages are expected to have '.type', '.content', and '.content.database' fields.")
			}
		} catch (error) {
			const insert = 'insertData'
			const remove = 'deleteData'

			if ( error?.message?.includes(insert) || error?.message?.includes(remove) ) {   // IdbHandler rejects with undefined after console.error
				console.log('current DB: ', this.databases.notatedb)
			}

			await this.generateErrorLog(error, { function: 'databaseRequest' })
			// Tell the sender it failed (a reply without data), so it does not wait forever.
			if (typeof port === 'object') await this.sendMessage({ type: 'DATABASE', content: {} }, port)
		}
	}


	async sendMessage(obj, port) {
		try {
			if (BROWSER_TYPE === 'firefox') {
				const payload = JSON.stringify(obj)
				port.postMessage(payload)
			} else {
				port.postMessage(obj)
			}

		} catch (error) {
			await this.generateErrorLog(error, { function: 'sendMessage' })
			// A reply too big for the port is lost, so say so: the sender gets a reply without data instead of waiting forever.
			if (obj?.content?.data !== undefined) await this.sendMessage({ type: 'DATABASE', content: {} }, port)
		}
	}


	async updateBackgroundEnvVariables() {
		let launchBehavior;

		try {
			await this.databases.userconfigurationdb.inventory
	
		//	this.env.important.launchBehavior = this.databases.
		//		userconfigurationdb.inventory.USER_CONFIGURATION[0].Notate.page.pageOpenBehavior.value	

		//	launchBehavior = this.env.important.launchBehavior 

		} catch (error) {
			await this.generateErrorLog(error, {function: "updateBackgroundEnvVariables"})
		} finally {
			if (
				!this.databases?.userconfigurationdb?.inventory ||
				!this.databases?.userconfigurationdb
			) {
				try {
					await this.initializeDatabase(USER_CONFIGURATION_DB)
				} catch(e) {}
				await this.updateBackgroundEnvVariables()
			}
	
		//	if (typeof launchBehavior === 'undefined' ) {
		//		setTimeout(()=> this.updateBackgroundEnvVariables(), 500)
		//	}
	
		//	if (launchBehavior) {
		//		
		//		setHighPriorityVariables(this.env.important)
		//	} 
		}
	}

	async generateErrorLog(error, context={}) {
		console.log('logging error...')

		if (
			!this.databases.errorloggingdb || 
			this.databases.errorloggingdb?.inventory instanceof Promise || 
			!this.databases.errorloggingdb?.insertData
		) await this.initializeDatabase(ERROR_LOGGING_DB)
	
		try {
			const errorLog = {
				timestamp: new Date().toISOString(),
				error: {
					name: error?.name,
					message: error?.message,
					stackTrace: error?.stack
				},
				context: {
					 ...context,
					url: browser.runtime.getURL(''),
					extensionId: browser.runtime.id,
					manifestVersion: browser.runtime.getManifest()?.manifest_version
	
				}
			}
	
			await this.databases.errorloggingdb.insertData(errorLog, "ERRORS")
		} catch (error) {
	
		}
	}
}
