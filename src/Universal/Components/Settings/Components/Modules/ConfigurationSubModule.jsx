import React from 'react';
import ConfigurationOptions from './ConfigurationOptions.jsx'


export default function ConfigurationSubModule({name, module, parent}) {
	const [ moduleArray, setModuleArray ] = React.useState(Object.entries(module))
	const [ optionsEnabled, setOptionsEnabled ] = React.useState(false)
	const [ moduleName, setModuleName ] = React.useState(name)


	const buildOptionSelector = (submodule) => {
		let result = false;

		if (submodule.length == 2 && submodule[1]?.options) {
			const builder = {
				name: submodule[0],
				list: submodule[1].options,
				selected:submodule[1].value,
				submodule: name,
				parentModule: parent
			}

			const options = submodule[1].options.length


			switch (true) {
				case options == 2:	// sets to input:checkbox
					builder.type = "checkbox"

					result = <ConfigurationOptions options={builder}/>
					

					break
				case options == 3 :	// sets to input:radio
					builder.type = "radio"
					result = <ConfigurationOptions options={builder}/>

					break
				case options > 3:	// sets to option
					builder.type = "dropdown"
					result = <ConfigurationOptions options={builder}/>
					break
				default:
					result = (false)
					break
			}

		}

		return result
	}



	const convertCamelToCapitalized = (inputStr) => {
    		// Add space before any uppercase letter that follows a lowercase letter or number
		const spacedStr = inputStr.replace(/([a-z0-9])([A-Z])/g, '$1 $2')

		// Capitalize the first letter
		const capitalizedStr = spacedStr.replace(/^./, match => match.toUpperCase());

		return capitalizedStr

	} 



	React.useEffect(()=>{
		if (moduleName) setModuleName(convertCamelToCapitalized(name)) 
	},[moduleArray])

	React.useEffect(()=>{
		if (moduleArray instanceof Array) {
			const enabled = moduleArray.some( sub => sub[1].enabled === true )
			setOptionsEnabled(enabled)
		}	
	},[])



	if (optionsEnabled) return (
		<section id={ `${name}-module` }
		className="w-full h-auto text-ink">
			<div className="py-[0.5rem]">
				<h3 id="module-title"
				className="font-display italic font-semibold text-[24px] leading-tight">{moduleName}</h3>
				<ul className="list-none mt-2 divide-y divide-paper-edge">
					{moduleArray && moduleArray.map( (sub,key) => {
						if (sub.length == 2) {
							const enabled = sub[1].enabled
							const configTitle = sub[1].title ?? convertCamelToCapitalized(sub[0])
							const configOptions = sub[1]
							const optionType = buildOptionSelector(sub)

							if (enabled) return (
								<li id=""
								className="py-3"
								key={key}>
									<div id="config-opt" 
									className="flex items-baseline justify-between gap-6 mb-1">
										<h4 id="opt-title"
										className="smallcaps text-ink">{configTitle}</h4>

										{optionType}
									</div>

									<label id="opt-description"
									className="block text-[16px] leading-snug italic text-ink-soft">
										{configOptions.description}
									</label>
								</li>
							)
						}
					})}
				</ul>
			</div>
		</section>
	)
}
