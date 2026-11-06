const path = require('path');
const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const { DefinePlugin } = require('webpack');
const ScriptingWebpackPlugin = require('scripting-webpack-plugin')
const BaseConfiguration = require('./webpack.base.js');

module.exports = (env) => {
	const browser = env.browser || 'chrome';
	const buildTarget = 'dist'
	const outputPath = path.resolve(__dirname, 'dist', browser)

	const ProductionConfiguration = {
		mode: 'production',
    		stats: {
      			errorDetails: true
    		},
    		output: {
      			...BaseConfiguration.output,
      			path: outputPath,
    		},
    		optimization: {
      			minimize: true,
      			minimizer: [
        			new TerserPlugin({
          				terserOptions: {
            					output: { ascii_only: true }
          				}
        			})
      			],
    		},
    		plugins: [
      			...BaseConfiguration.plugins,
			new ScriptingWebpackPlugin({
				scripts: {
					onAfterEmit: [{
						script: './scripts/build/webpack/mv-manifest.sh',
						args: [ browser, buildTarget ]
					}]
				},
				shell: 'bash',
				verbose: true
			}),
      			new DefinePlugin({ 'process.env.NODE_ENV': JSON.stringify('production') }),
    		],
    //		module: {
    //    		...BaseConfiguration.module,
    //  			rules: [
    //    			...BaseConfiguration.module.rules,
    //    			{
    //      				test: /\.(scss|css)$/,
    //      				use: ['style-loader', ...BaseConfiguration.module.rules[2].use],
    //      				exclude: /\.module\.css$/
    //    			},
    //  			]
    //		},
		resolve: {
			alias: {
				...BaseConfiguration.resolve.alias,
   				'@dev': false 
			}
		}
	} 


	return merge(BaseConfiguration, ProductionConfiguration);
};
