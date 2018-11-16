const mongodb = require("mongodb");

class MongoInterface {
    start(config) {
        this.config = config;
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
}

module.exports = (new MongoInterface());