const mongodb = require("mongodb");
const Plugin = require("../plugin");

const anon_router = require('./anon');

class EOSServicePlugin extends Plugin {
    constructor(config, name) {
        super(config, name);
    }
    async start(app) {
        app.use('/service/anon', anon_router);
    }
    async test() {
        if (!this.plugin('eos')) {
            return 1;
        }
        return 0;
    }
}

module.exports = EOSServicePlugin;