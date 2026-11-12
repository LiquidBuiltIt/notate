import React from 'react';
import { SettingsContext } from '../../Settings.jsx'
import ConfigurationSubModule from './ConfigurationSubModule.jsx'


export const ConfigurationContext = React.createContext()


export default function ConfigurationModule({module}) {
	const { DATABASE_CONTEXT,
		REQUEST_CONTEXT,
		SAVE_CONTEXT,
		CONFIGURATION_CONTEXT } = React.useContext(SettingsContext)
	const [ database ] = DATABASE_CONTEXT
	const [ saveState ] = SAVE_CONTEXT
	const [ configuration, setConfiguration ] = CONFIGURATION_CONTEXT 

	const hasOptions = (submodule) => {
		return Object.values(submodule).some(setting => setting.options && setting.options.length > 0);
	}

	React.useEffect(()=>{

	},[])


	React.useEffect(()=>{
		if (configuration) {
			
		}
	},[saveState])



	return (
		<main id="settings-content"
		className="flex-grow  space-y-[1.75rem]">
			<ConfigurationContext.Provider value={[ configuration, setConfiguration ]}>
				{configuration && Object.entries(configuration[module]).map(( [submoduleName, submodule] ,key) => {
					
					if (hasOptions(submodule)) return (
						<ConfigurationSubModule
						key={key}
						name={submoduleName}
						module={submodule}
						parent={module}/>
					)	
				})}
			</ConfigurationContext.Provider>
		</main>	
	)
} 

