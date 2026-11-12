import React from 'react';
import browser from 'webextension-polyfill'
import { NotateContext } from '@notate/Notate.jsx'

export const BarStatusContext = React.createContext()

export default function SearchBar({ onSearch }) {
	const { THEME_CONTEXT } = React.useContext(NotateContext)
	const theme = THEME_CONTEXT
	const [selectedEngineIndex, setSelectedEngineIndex] = React.useState('google'); 
  	const [searchTerm, setSearchTerm] = React.useState('');
	const [barActiveStatus, setStatus] = React.useState(false)

  const handleInputChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    onSearch(value);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      performSearch();
    }
  };

 // const performSearch = () => {
 //   const currentSearchEngine = searchEngineProviders[selectedEngineIndex];

 //   if (searchTerm !== '') {
 //     const URL = currentSearchEngine.URLPrefix + encodeURIComponent(searchTerm);
 //     window.location.href = URL;
 //   }
 // };
	const performSearch = () => {
		if (searchTerm !== '') {
			browser.search.query( { text: searchTerm } )
		}
	}


	const handleSearchBarActiveState = () => {
		setStatus(!barActiveStatus)
	}

	React.useEffect(() => {
	    const handleClickOutside = (event) => {
	      if (
	        event.target.id !== 'searchInput' &&
	        !event.target.closest('#search-bar-container')
	      ) {
	        setStatus(false);
	      } else setStatus(true)
	    };
	
	    document.addEventListener('click', handleClickOutside);
	

	  }, []);


  return (
	<div 
	 id="search-bar-container" 
	 className="relative flex-grow min-w-0"
	 onClick={handleSearchBarActiveState}
	>

		<div 
		 id="internal"
		 className="relative flex items-baseline gap-4 border-b border-ink"
		>
			<label htmlFor="searchInput" className={`smallcaps shrink-0 cursor-text ${theme.text.sub || ""}`}>Search</label>
			<input
			 type="text"
		         id="searchInput"
		 	 className={`flex-grow min-w-0 bg-transparent py-2 font-serif text-[26px] leading-tight text-ink caret-vermilion rounded-none outline-none placeholder:italic ${theme.text.placeholder || ""}`}
		         placeholder="Your conquest for knowledge begins here..."
		         value={searchTerm}
		         onChange={handleInputChange}
		         onKeyPress={handleKeyPress}
		  	/>
	
			  <BarStatusContext.Provider value={[ barActiveStatus ]}>
			  </BarStatusContext.Provider>

			{/* The vermilion line that draws under the hairline while the bar is active */}
			<div 
			 id="external"
			 className={`
				 absolute left-0 right-0 -bottom-px h-[3px] bg-vermilion origin-left transition-transform duration-300 ease-out
				 ${ barActiveStatus ? "scale-x-100" : "scale-x-0" }
			`}/>
	
		</div>
	</div>
  );
}
