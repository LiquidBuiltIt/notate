import React from 'react';
import ConfigurationModule from './Components/Modules/ConfigurationModule.jsx';
import SettingsBottomBar from './Components/Bars/SettingsBottomBar.jsx';
import SettingsTopBar from './Components/Bars/SettingsTopBar.jsx';
import ErrorReporter from './Components/ErrorReporter/ErrorReporter.jsx';
import { diffPatch } from '@universal/Handlers/ConfigurationHandlers/patch.js';

const NOTATE_DB = "notate"
const ERROR_LOGGING_DB = "errorLogging"
const USER_CONFIGURATION_DB = "userConfiguration"

export const SettingsContext = React.createContext()


export default function Settings({ContextAdapter, targetModule, setterCallback, extra}) {

	const SETTINGS_CONTEXT = {
		DATABASE_CONTEXT: ContextAdapter.USER_CONFIGURATION_DB_CONTEXT,
		REQUEST_CONTEXT: ContextAdapter.REQUEST_CONTEXT,
		SAVE_CONTEXT: React.useState(false),
		EXIT_CONTEXT: React.useState(false),
		CONFIGURATION_CONTEXT: React.useState(false),
		SETTINGS_STATE_CONTEXT: React.useState(false)
	}

	const [ database ] = ContextAdapter.USER_CONFIGURATION_DB_CONTEXT
	const [ request, makeRequest ] = ContextAdapter.REQUEST_CONTEXT
	const [ configuration, setConfiguration ] = SETTINGS_CONTEXT.CONFIGURATION_CONTEXT
	const [ saveState ] = SETTINGS_CONTEXT.SAVE_CONTEXT
	const [ exitState ] = SETTINGS_CONTEXT.EXIT_CONTEXT
	const [ settingsState, setSettingsState ] = SETTINGS_CONTEXT.SETTINGS_STATE_CONTEXT 

	// Copy of the settings as they were loaded; the staged settings share objects with the database, so they cannot be the baseline
	const snapshot = React.useRef(null)


	const buildSettingsPage = () => {
		const result = {};
		const user = database?.inventory?.USER_CONFIGURATION[0]

		if (user && targetModule instanceof Array) {
			targetModule.forEach( target => {
				result[target] = user[target]
			} )

			snapshot.current = structuredClone(result)
			setConfiguration(result)
		}
	}

	

	React.useEffect(()=>{
		setSettingsState(true)
	},[])


	React.useEffect(()=>{
		if (database) buildSettingsPage()
	},[database])


	React.useEffect(()=>{
		if (saveState) {
			// Send only what the user changed, so settings and sites changed elsewhere since opening are kept
			const changes = diffPatch(snapshot.current, configuration)

			if (Object.keys(changes).length) makeRequest({ 
				type: "PATCH_DATABASE", 
				data: changes, 
				store: 'USER_CONFIGURATION',
				database: USER_CONFIGURATION_DB
			})

			setSettingsState(false)


			setTimeout(()=>{
				if (typeof setterCallback === 'function') setterCallback(false)   
			},300)
		}

	},[saveState])



	React.useEffect(()=>{
		if (exitState) {
			setSettingsState(false)

			setTimeout(()=>{
				if (typeof setterCallback === 'function') setterCallback(false)   
			},300)
		}

	},[exitState])

	

	// Sites hidden with "Dismiss Menu > For This Site". Clearing them is staged like any other setting.
	const hiddenSites = () => {
		const sites = database?.inventory?.USER_CONFIGURATION[0]?.WebContent?.dismissedSites || []
		const cleared = !configuration?.WebContent?.dismissedSites?.length
		if (!sites.length) return null

		const showAgain = () => {
			setConfiguration({ ...configuration, WebContent: { ...configuration.WebContent, dismissedSites: [] } })
		}

		return (
			<li id="hidden-sites" className="list-none py-3 flex items-baseline justify-between gap-6">
				<span className="text-[16px] italic text-ink-soft" title={sites.join('\n')}>
					{ cleared ? 'The menu shows on every site after you save.' : `The menu is hidden on ${sites.length} ${sites.length === 1 ? 'site' : 'sites'}.` }
				</span>
				{ !cleared && <button id="show-hidden-sites" onClick={showAgain} className="smallcaps focus-ink border-b border-ink trans-ease hover:text-vermilion-ink hover:border-vermilion">Show again</button> }
			</li>
		)
	}

	return (
		<div
		 id="settings-modal-container"
		 className={`
			 trans-ease fixed flex left-0 top-0 w-screen h-screen 
			 ${ settingsState ? "bg-paper/75" : "bg-transparent" } 
			 justify-center z-modal font-serif text-ink
		 `}>

			<div 
			 id="settings-modal"
			 className={`
			 	trans-ease flex flex-col absolute px-[2rem] 
			 	${ settingsState ? "translate-y-[0%]" : "translate-y-[100%]" } 
			 	h-[85%] md:w-[60%] w-[95%] bottom-0 paper-grain rounded-none border-x border-t border-ink shadow-print-lg  
			`}>

				<SettingsContext.Provider value={SETTINGS_CONTEXT}>
					<SettingsTopBar/>	
						<main id="settings-content" className="overflow-auto space-y-8 pb-4">
						{ targetModule instanceof Array && targetModule.map( module => {
							return (
								<ul className="space-y-4 mx-4"
								key={module}>
									<header className="smallcaps text-vermilion-ink pb-2 border-b border-ink">
									{module}</header>
									<ConfigurationModule
									module={module}/>
									{ module === 'WebContent' && hiddenSites() }
								</ul>
							)
						})}

						{ extra && (
							<ul className="space-y-4 mx-4">
								<header className="smallcaps text-vermilion-ink pb-2 border-b border-ink">Your notes</header>
								{extra}
							</ul>
						)}

						<ErrorReporter/>

						</main>
					<SettingsBottomBar/>
				</SettingsContext.Provider>
			</div>	
		</div>
	)	
}
