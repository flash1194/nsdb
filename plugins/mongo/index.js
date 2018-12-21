const mongodb = require("mongodb");
const Plugin = require("../plugin");
const router = require('./router');

class MongoDatabasePlugin extends Plugin {
    constructor(config, name) {
        super(config, name);
        this.client = null;
    }
    async getClient() {
        var client = this.client;
        if (!client || !client.isConnected()) {
            client = this.client = await mongodb.MongoClient.connect(this.config.connection, { useNewUrlParser: true });
        }
        return client;
    }
    async getDatabase() {
        const client = await this.getClient();
        const db = await client.db(this.config.database);
        return db;
    }
    async getCollection(name) {
        return (await this.getDatabase()).collection(name);
    }
    async command(command) {
        const db = await this.getDatabase();
        var result = (await db.command(command));
        return result;
    }
    async start(app) {
        app.use('/api', router);
    }
    async test() {
        try { 
            await this.getClient();
        }
        catch (ex) {
            console.log(ex);
            return 1;
        }
        return 0;
    }
}

module.exports = MongoDatabasePlugin;
