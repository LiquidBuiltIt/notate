import { ConfigurationTemplate } from './ConfigurationHandlers/ConfigurationTemplate.js'
import handleConfigurationDb from './ConfigurationHandlers/ConfigurationHandler.js'

export default class DatabaseAdapter {
   constructor(databaseName) {
    this.mapper = {
        db: {
		notate: {
			name:'NOTATE_DB',
			stores:  ['NOTES', 'NOTEBOOKS'],
		},
		errorLogging: {
			name: 'ERROR_LOGGING_DB',
			stores: ['ERRORS']
		},
		userConfiguration: {
			name: 'USER_CONFIGURATION_DB',
			stores: ['USER_CONFIGURATION']
		}
	}
    }
    this.connection =  this.connectToDB(databaseName);
    this.inventory =  null;
    this.request = null;
  }
    
  async connectToDB(databaseName) {
	  	   return new Promise((resolve, reject) => {
		   
		   const legend = this.mapper.db[databaseName]

   		   const DBBrige = indexedDB.open(legend.name, 1);

   		DBBrige.onsuccess = async (e) => {
			if (this.workermessage === 'function') await this.workermessage()
   			this.connection = e.target.result;

		     	//console.log(`${databaseName} connected. awaiting inventory...`)
		     	this.inventory = await this.getInventory()


			if (databaseName === 'userConfiguration') handleConfigurationDb(this, 'update') 

   		     	resolve(this.connection);
   		   };

   		   DBBrige.onerror = (e) => reject(console.error('error initing DB: ' + e.target.error));

   		   DBBrige.onupgradeneeded = async (e) => {
			   //console.log(`Upgrading DB ${databaseName}...`)
   		 
   		     this.connection = e.target.result;
		     const transaction = e.target.transaction

   		     legend.stores.forEach((storeKey)=>{
   		         this.connection.createObjectStore(storeKey, { keyPath: 'id', autoIncrement: true })
   		     })
   	
		     if (legend.stores.some( store => store === "USER_CONFIGURATION" )) {
			await this.setupUserConfiguration(transaction)
		     } 
			   

		     //console.log('DB install successful')

		     //Runs callback if defined
		     if (this.workermessage === 'function') {
			await this.workermessage()
		     }

		     // onsuccess builds the inventory and resolves once the upgrade transaction is done

		     if (databaseName === 'userConfiguration') handleConfigurationDb(this, 'setup') 
   		   };
   		 });
  }

  async setupUserConfiguration(transaction) {
	return new Promise((resolve, reject) => {
		try {
			const store = transaction.objectStore('USER_CONFIGURATION')
			store.add(ConfigurationTemplate)
		} catch (e) {
			console.error(e)
			console.error('config upload failed')
		}
	})
  }


    // Needs to be worked on
    async getInventory() {

        await this.connection;
        const db = this.connection
        const inventory = {}


	const allStoresWereFetched = (dataset) => {
		const formula =  (e) => e === false
		const results = dataset.some(formula)
		return !results
	}
        
        return new Promise( async (resolve, reject) => {
            const dbStoreNames = db.objectStoreNames
            const stores = {}

	    Object.values(dbStoreNames).forEach((name)=>{ stores[name] = false })


            Object.keys(stores).forEach((store)=>{
                inventory[store] = []

                
                const transaction = db.transaction(store, 'readonly')
                const objStore = transaction.objectStore(store)

                const request = objStore.getAll()

                request.onsuccess = (e) => {
                    const results = e.target.result
		    
		    if (typeof results === 'object' && results.length === 0) {
			stores[store] = true

			const comparison = allStoresWereFetched(Object.values(stores))

			    if (comparison) {
			    	this.inventory = inventory
				resolve(this.inventory)
			    }
		    }

                    results.forEach((item) => {
                        inventory[store].push(item)
			stores[store] = true

			const comparison = allStoresWereFetched(Object.values(stores))			

			if (comparison) {
				this.inventory = inventory
				resolve(this.inventory)
			}
                    })
                    
                }

                request.onerror = (e) => {reject(console.error(`Error processing request: ${e.error}`))}
            })
        })
    }



    async insertData(data, target_store) {        
        const db = await this.connection

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([target_store], 'readwrite')
            const store = transaction.objectStore(target_store)

            const request = store.put(data)

            request.onsuccess = async ()=> {
	    	await this.cleanup()
		resolve('Item added to DB')
	    }

            request.onerror = (e) => {reject(console.error(`Error adding data: ${e.error}`))}
        })
    }
    


    async deleteData(data, target_store) {        
        const db = await this.connection

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([target_store], 'readwrite')
            const store = transaction.objectStore(target_store)

            if (data?.id) {
                const item = data.id
                
                const request = store.delete(item)

                request.onsuccess = async ()=> {
			await this.cleanup()
			resolve('Item removed from DB')
		}

                request.onerror = (e) => {reject(console.error(`Something went wrong while attempting to perform DELETE operation: ${e.error}`))}
                
            } else {
                reject(console.error(`Item to delete does not have a valid schema for this database.`))
            }
        })
    }



    async cleanup() {
    	this.inventory = await this.getInventory()
	if (this.workermessage === 'function') await this.workermessage()
    }
}




export class DBWorker extends DatabaseAdapter {
	constructor(){
		super()
		
	}	
}
