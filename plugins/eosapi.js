var axios = require('axios');
const Plugin = require('./plugin');

class EOSAPIPlugin extends Plugin {
    constructor(config, name) {
        super(config, name);
    }
    async getInfo() {
    }
    async getTransaction(txid) {
    }
    async getActions(account, position, count) {
    }
    async test() {
        var api = this;

        try {
            const tx = await api.getTransaction('1fa71e66fb648d342e0b1303ba1cfeb4b3ad74c3114bf276745b1d2ad29f575a');
            if (tx.id != '1fa71e66fb648d342e0b1303ba1cfeb4b3ad74c3114bf276745b1d2ad29f575a')
                return 1;
        }

        catch (ex) {
            console.log(ex);
            return 2;
        }

        var actions = [];
        for (var i = 0; i < 5; i++) {
            try {
                actions = await api.getActions('novuspheredb', 868, 10);
                if (actions.length > 0)
                    break;
            }
            catch (ex) {
                console.log(ex);
            }
        }

        if (actions.length != 10)
            return 3;

        try {
            const info = await api.getInfo();
            if (info.chain_id != 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906')
                return 6;
        }
        catch (ex) {
            return 7;
        }

        return 0;
    }
}

module.exports = EOSAPIPlugin;