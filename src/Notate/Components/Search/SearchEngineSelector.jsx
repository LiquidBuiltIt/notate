import React from 'react';
import { NOTATE_DB, ERROR_LOGGING_DB, USER_CONFIGURATION_DB } from '@background/background.js'
import { searchEngineProviders } from './searchEngineProviders';
import { BarStatusContext } from './SearchBar.jsx'
import { NotateContext } from '@notate/Notate.jsx'


export const SelectedEngineIndexContext = React.createContext()

export default function SearchEngineSelector({  }) {
	const { USER_CONFIGURATION_DB_CONTEXT, REQUEST_CONTEXT } = React.useContext(NotateContext)
	const [ request, makeRequest ] = REQUEST_CONTEXT
	const [database] = USER_CONFIGURATION_DB_CONTEXT 

  	const [ searchBarStatus ] = React.useContext(BarStatusContext)
  	const [selectedEngineIndex, setSelectedEngineIndex] = React.useContext(SelectedEngineIndexContext)

	const config = database?.inventory?.USER_CONFIGURATION[0]

	const providerList = Object.keys(searchEngineProviders)


  	const handleClick = () => {
		const currentIndex = providerList.indexOf(selectedEngineIndex)
    		const nextIndex = (currentIndex + 1) % providerList.length;
    		setSelectedEngineIndex(providerList[nextIndex]);


		
  	};

 
  	const selectedEngine = searchEngineProviders[selectedEngineIndex];

	React.useEffect(()=>{
		if (config) {
			const preferredSearchEngine = config?.Notate?.search?.preferredEngine?.value
			if (preferredSearchEngine) setSelectedEngineIndex(preferredSearchEngine)				
		}
	},[database])

	React.useEffect(() =>{
		const asyncProcessor = async () => {
			if (config?.Notate?.search) {
				await makeRequest({ 
					type: "PATCH_DATABASE", 
					data: { Notate: { search: { preferredEngine: { value: selectedEngineIndex } } } }, 
					store: 'USER_CONFIGURATION',
					database: USER_CONFIGURATION_DB
				})
			}
		}

		asyncProcessor()
	},[selectedEngineIndex])
 
  	return (
    		<div id="search-engine-selector" 
		className="flex items-center">
      			<button id="search-engine-btn" 
			className="smallcaps focus-ink flex items-center gap-2 cursor-pointer bg-transparent border-none text-ink hover:text-vermilion-ink" 
			title="Change search engine"
			onClick={handleClick}>
        			<img id="search-engine-favicon" 
				className="w-4 h-4" 
				src={selectedEngine.favicon} 
				alt="" />
				{selectedEngine.name} <span aria-hidden="true">&#9662;</span>
      			</button>
    		</div>
  );
}
