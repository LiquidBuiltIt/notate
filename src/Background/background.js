import browser from 'webextension-polyfill'

import CoreService from './Utils/coreService.js'
import { spawnNotateTab, bootstrapApplication, declareEnvironmentVariables } from './Utils/eventActions.js'
import Environment from './Utils/environment.js'
import { seenVersionOnInstall } from '@universal/Changelog/changelog.js'
import DevTools from '@dev/devutils.js'


/*
 * DevTool Call
*/
try { DevTools() } catch(e){}



/*
 * Constants
*/
export const NOTATE_DB = "notate"
export const ERROR_LOGGING_DB = "errorLogging"
export const USER_CONFIGURATION_DB = "userConfiguration"



const CHROME_STORE_HIGH_PRIORITY = "CHROME_STORE_HIGH_PRIORITY"


const BackgroundService = new CoreService()
const env = new Environment()



/*
EVENT LISTENER
	Fires on Chrome startup. Is one of 2 chrome event listeners
	that fires bootstrapApplication().
*/
browser.runtime.onStartup.addListener(async ()=> {
	await bootstrapApplication(BackgroundService, env)
	await declareEnvironmentVariables(BackgroundService, env)

	let launchBehavior = env.variables.important.launchBehavior 

	if (launchBehavior && typeof launchBehavior === 'string') {
		spawnNotateTab(launchBehavior)
	}
})



/*
EVENT LISTENER
	Fires on Chrome startup. Is one of 2 chrome event listeners
	that fires bootstrapApplication().
*/
browser.runtime.onInstalled.addListener(async (details)=> {
	// What's new dot: a fresh install has seen everything, an update from an older build has not.
	try {
		const { lastSeenVersion } = await browser.storage.local.get('lastSeenVersion')
		const seen = seenVersionOnInstall(details, lastSeenVersion, browser.runtime.getManifest().version)
		if (seen) await browser.storage.local.set({ lastSeenVersion: seen })
	} catch (e) { console.error('lastSeenVersion not stored', e) }

	await bootstrapApplication(BackgroundService, env)
	await declareEnvironmentVariables(BackgroundService, env)

	let launchBehavior = BackgroundService.env.important.launchBehavior

	if (launchBehavior && launchBehavior === 'onNewTab') {
		spawnNotateTab(launchBehavior)
	}
})



/*
EVENT LISTENER:
	Fires and runs spawnTab() function when user clicks Notate
	popup
*/
browser.action.onClicked.addListener(async () => {
	const launchBehavior = env.variables.important 
	debugger
	if (launchBehavior === 'onClickPopup')  spawnNotateTab(launchBehavior)
})



/*
EVENT LISTENER:
	Fires when an incoming database connection is received and	
	delegates all database operations to the databaseRequest()
	function.
*/
browser.runtime.onConnect.addListener((port) => {
  if (port.name === 'DATABASE_CONNECTION') {
    port.onMessage.addListener(async (message) => {
	await BackgroundService.databaseRequest(port, message)
    });
  }
});


// DEPRECATED

/*
EVENT LISTENER:
	Fires and runs the spawnTab() function on new tab if user 
	configuration has 'onNewTab' enabled.
*/
//browser.tabs.onCreated.addListener(async ()=> {
//	const launchBehavior = env.variables.important.launchBehavior 
//	if (launchBehavior === 'onNewTab')  spawnNotateTab(launchBehavior)
//})
