const EOSContractPlugin = require('../eoscontract');
const EOSBinaryReader = require('../../eos/binaryreader');

const NovusphereProtocol = require('./protocol.js');

class EOSForumPlugin extends EOSContractPlugin {
    constructor(config, name) {
        super(config, name);
    }
    async migrateSnapshotAction(action) {
        return action;
    }
    async migrations() {
        await super.migrations();
    }
    async deserializeAction(action) {
        if (action.account == this.config.account) {
            var rdr = new EOSBinaryReader(action.data);

            switch (action.name) {
                case 'push':
                    action.data = {
                        account: rdr.readName(),
                        json: rdr.readString()
                    };
                    break;
            }
        }
    }
    async beforeInsertAction(action) {
        await super.beforeInsertAction(action);

        if (action.account == this.config.account) {
            if (action.name == 'push') {
                const json = action.data.json;
                if (json.protocol == 'novusphere') {
                    var protocol = new NovusphereProtocol(this, action);
                    await protocol.handle();
                }
            }
        }
        else {
            if (action.account == 'novusphereio') {
                if (action.name == 'transfer') {
                    var protocol = new NovusphereProtocol(this, action);
                    await protocol.handleTransfer();
                }
            }
        }
    }
}

module.exports = EOSForumPlugin;