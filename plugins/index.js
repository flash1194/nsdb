class PluginManager {
    constructor() {
    }
    async load(plugins) {
        for (var plugin_name in plugins) {
            if (this[plugin_name]) {
                console.log('warning duplicate plugin found for ' + plugin_name);
                continue;
            }

            const plugin_config = plugins[plugin_name];

            try {
                var PluginType = require('./' + plugin_config.script);
                this[plugin_name] = new PluginType(plugin_config.config, plugin_config.script);

                console.log('loaded plugin ' + plugin_name);
            }
            catch (ex) {
                console.log(`failed to load plugin ${plugin_name} - ${ex}`);
            }
        }
    }
    async forEach(callback) {
        const keys = Object.keys(this);
        for (var i = 0; i < keys.length; i++) {
            const plugin = this[keys[i]];
            if (plugin.config) {
                await callback(plugin);
            }
        }
    }
    async start(app) {
        await this.forEach(async (p) => {
            p.start(app);
        });
    }
    async test() {
        var all_ok = true;

        await this.forEach(async (plugin) => {
            if (plugin.test) {
                try {
                    var code = (await plugin.test());
                    if (code) {
                        plugin.log(`warning tests for failed with code ${code}`);
                        all_ok = false;
                    }
                    else {
                        plugin.log('all tests passed');
                    }
                }
                catch (ex) {
                    plugin.log(`warning tests threw exception, see below`);
                    console.log(ex);
                }
            }
        });

        return all_ok;
    }
}

module.exports = (new PluginManager());