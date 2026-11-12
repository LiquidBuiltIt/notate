import React from 'react';
import { SettingsContext } from '../../Settings.jsx'
import { ConfigurationContext } from './ConfigurationModule.jsx'



export default function ConfigurationOptions({options}) {
	const { SAVE_CONTEXT } = React.useContext(SettingsContext)	
	const [ saveState ] = SAVE_CONTEXT

	const [ configuration, setConfiguration ] = React.useContext(ConfigurationContext)

	const [ selectedOption, setSelectedOption ] = React.useState(options.selected)
	const [ optionList, setOptionList ] = React.useState(options.list)
	const [ optionType, setOptionType ] = React.useState(options.type)
	const [ optionName ] = React.useState(options.name)
	const [ subModule ] = React.useState(options.submodule)
	const [ parentModule ] = React.useState(options.parentModule)


	const convertCamelToCapitalized = (inputStr) => {
    		// Add space before any uppercase letter that follows a lowercase letter or number
		const spacedStr = inputStr.replace(/([a-z0-9])([A-Z])/g, '$1 $2')

		// Capitalize the first letter
		const capitalizedStr = spacedStr.replace(/^./, match => match.toUpperCase());

		return capitalizedStr

	} 

	// Stored values stay as they are; only the label changes.
	const LABELS = { duckduckgo: 'DuckDuckGo', perplexityai: 'Perplexity' }
	const labelOf = (option) => LABELS[option] ?? convertCamelToCapitalized(option)

	const handleOptionChange = (event) => {
		if (optionType === "checkbox") setSelectedOption(event.target.checked)
		else setSelectedOption(event.target.value)
	}




	React.useEffect(()=>{
		if (saveState) {
			const target = Object.fromEntries(Object.entries(configuration))
			target[parentModule][subModule][optionName].value = selectedOption.toString()

			
			

			setConfiguration(configuration)
			

		}
	},[saveState])


	return (
		<form id={ `${optionType}-option` }
		className="flex gap-4 font-serif text-[16px] text-ink">
		{ 	/* Since this will always contain booleans in the optionList,
			its best to just parse the strings as actual bool types */
			(optionType === "checkbox") &&  (
				<label 
				className="flex justify-center items-center">
					<input
					 className="focus-ink appearance-none size-5 rounded-none border border-ink bg-paper cursor-pointer transition duration-150 checked:bg-vermilion checked:shadow-[inset_0_0_0_3px_#F2ECE0]"
					 type="checkbox"
					 value={(selectedOption)}
					 checked={JSON.parse(selectedOption)}
					 onChange={handleOptionChange}
					/>

				</label>
			)
		}
		{ (optionType === "radio") && optionList.map( option => {
			return (
				<label key={option}
				className="flex justify-center items-center gap-2 cursor-pointer">
					<input
					className="focus-ink appearance-none size-4 rounded-none border border-ink bg-paper cursor-pointer transition duration-150 checked:bg-vermilion checked:shadow-[inset_0_0_0_3px_#F2ECE0]"
					type="radio"
					value={option}
					checked={option === selectedOption}
					onChange={handleOptionChange}/>
					{labelOf(option)}
				</label>
			)
		})}
		{ (optionType === "dropdown") && (
			<div className="relative w-full min-w-[9rem]">
				<select 
				className="focus-ink block w-full appearance-none pl-2 pr-8 py-1 rounded-none border border-ink bg-paper-deep font-serif text-[16px] text-ink cursor-pointer"
				defaultValue={selectedOption}
				onChange={handleOptionChange}>
				{optionList.map( option => {
					return (
						<option 
						className="bg-paper text-ink"
						key={option}
						value={option}>
						{labelOf(option)}
						</option>
					)
				})}	
				</select>
				<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] leading-none text-ink" aria-hidden="true">&#9662;</span>
			</div>
			)}
		</form>
	)
}
