const plugins = require('../plugins');

class Plugin {
    constructor (config, name) {
        this.config = config;
        this.name = name;
    }
    async sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async start(app) {

    }
    plugin(name) {
        return plugins[name];
    }
    log(message, context) {
        if (typeof message != 'string') {
            message = JSON.stringify(message);
        }

        if (context) {
            message = `[${context}] ${message}`;
        }

        console.log(`[${(new Date()).toLocaleTimeString()}] ${this.name} - ${message}`);
    }
}

module.exports = Plugin;