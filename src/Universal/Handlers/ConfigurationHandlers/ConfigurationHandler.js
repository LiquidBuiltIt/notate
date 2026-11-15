import { ConfigurationTemplate } from "./ConfigurationTemplate.js";
import { mergeConfigurations, checkAndMergeConfig } from "./merge.js";

export default async function handleConfigurationDb(database, requestType) {
	if (database && requestType) {
    		switch (requestType) {
      			case 'setup': {
        			await setupUserConfiguration(database);
        			break;
      			}
      			case 'update': {
        			await configurationMergeCheck(database);
        			break;
      			}
      			default: {
      			}
    		}
	}
}

async function setupUserConfiguration(database) {
	try {
    		await database.insertData(ConfigurationTemplate, 'USER_CONFIGURATION');
  	} catch (error) {
    		console.error('Error in config DB setup:', error);
  	}
}

async function configurationMergeCheck(database) {
	try {
		// Read-merge-write in one transaction, so a user setting saved at the same time is not overwritten
		await database.updateData('USER_CONFIGURATION', currentConfig => {
			// If no configuration exists, insert the template
			if (!currentConfig) return ConfigurationTemplate

			// A merged config is returned only when a merge is needed
			return checkAndMergeConfig(currentConfig, ConfigurationTemplate)
		})
	} catch (error) {
    		console.error('Error in config DB merge check:', error);
  	}
}
