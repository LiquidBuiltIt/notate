const path = require('path');
const { merge } = require('webpack-merge');
const ScriptingWebpackPlugin = require('scripting-webpack-plugin')
const BaseConfiguration = require('./webpack.base.js');


module.exports = (env) => {
	const browser = env?.browser || 'chrome';
	const buildTarget = 'dev'
	const outputPath = path.resolve(__dirname, 'dev', browser)

	const DevelopmentConfiguration =  {
		mode: 'development',
	  	devtool: 'inline-source-map',
	  	stats: {
	  		errorDetails: true
	  	},
	  	entry: {
	  		...BaseConfiguration.entry,
	  		devutils: path.resolve(__dirname, 'src', 'DevUtils', 'devutils.js')
	  	},
	  	output: {
	  		...BaseConfiguration.output,
			path: outputPath,
	  	},
	  	plugins: [
	  		...BaseConfiguration.plugins,
			new ScriptingWebpackPlugin({
				scripts: {
					onAfterEmit: [{
						script: './scripts/build/webpack/mv-manifest.sh',
						args: [ browser, buildTarget ]
					},{
						script: './scripts/build/webpack/tailwindcss.sh',
						args: [ browser ]
					}]
				},
				shell: 'bash',
				verbose: true
			})
	  	],
		resolve: {
			alias: {
				...BaseConfiguration.resolve.alias,
   				'@dev': path.resolve(__dirname, 'src', 'DevUtils')
			}
		}
	}


	return merge(BaseConfiguration, DevelopmentConfiguration);
};
