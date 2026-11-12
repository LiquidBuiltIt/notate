import React from 'react';
import TextInput from './Components/TextInput/TextInput.jsx';
import Toolbar from './Components/Toolbar//Toolbar.jsx';
import ContextMenu from './Components/ContextMenu/ContextMenu.jsx' 


export const TextInputContext = React.createContext()
export const ShadowRootContext = React.createContext()


export default function TextEditor({ToolbarComponents, TailwindClassNames, ShadowRootElement}) {
	const contextMenuReferrer = React.useRef(null)

	const [text, setText] = React.useContext(TextInputContext);

	const handleTextChange = (newText) => {
		setText(newText);
	};



	return (
		<div 
	   	 id="text-editor"
	  	 ref={contextMenuReferrer}
		 className={`
		 	${TailwindClassNames} 
			flex flex-col flex-grow overflow-auto font-serif text-ink
		`}>
		  	<ShadowRootContext.Provider value={[ShadowRootElement]}>
      				<Toolbar ControllerComponents={ToolbarComponents}/>
			  	
			  	<div 
			  	 id="text-input-container"
			  	 className="flex-grow overflow-auto"
			  	>
						<TextInput/>
			  	</div>

				<ContextMenu RefElement={contextMenuReferrer}/>
		  	</ShadowRootContext.Provider>
	  </div>
	);
}
