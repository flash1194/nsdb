var axios = require('axios');
const Plugin = require('./plugin');

class BlockProducerAPIPlugin extends Plugin {
    constructor(config, name) {
        super(config, name);
    }
    async getInfo() {
        var request = (await axios.get(this.config.endpoint + '/v1/chain/get_info'));
        return request.data;
    }
    async getTransaction(txid) {
        var request = (await axios.post(this.config.endpoint + '/v1/history/get_transaction', JSON.stringify({
            id: txid
        })));

        return request.data;
    }
    async getActions(account, position, count) {
        var request = (await axios.post(this.config.endpoint + '/v1/history/get_actions',
            JSON.stringify({
                account_name: account,
                pos: position,
                offset: count - 1
            }),
            {
                timeout: this.config.timeout
            }));

        const _this = this;
        return request.data.actions.map(function (a, i) {
            if (_this.config.endpoint == 'https://history.cryptolions.io') {
                return {
                    id: a.receipt.global_sequence,
                    account: a.act.account,
                    transaction: a.trx_id,
                    blockId: a.block_num,
                    createdAt: new Date(a.block_time).getTime() / 1000,
                    name: a.act.name,
                    data: a.act.data ? a.act.data : a.act.hex_data
                };
            }
            else {
                const trace = a.action_trace;
                const act = trace.act;
                return {
                    id: a.global_action_seq,
                    account: act.account,
                    transaction: trace.trx_id,
                    blockId: a.block_num,
                    createdAt: new Date(a.block_time).getTime() / 1000,
                    name: act.name,
                    data: act.data
                };
            }
        });
    }
    async test() {
        var api = this;

        try {
            const tx = await api.getTransaction('1fa71e66fb648d342e0b1303ba1cfeb4b3ad74c3114bf276745b1d2ad29f575a');
            if (tx.id != '1fa71e66fb648d342e0b1303ba1cfeb4b3ad74c3114bf276745b1d2ad29f575a')
                return 1;
        }

        catch (ex) {
            return 2;
        }

        var actions = [];
        for (var i = 0; i < 5; i++) {
            try {
                actions = await api.getActions('novuspheredb', 800, 10);
                if (actions.length > 0)
                    break;
            }
            catch (ex) {
                // ...
            }
        }

        if (actions.length == 0)
            return 3;
        if (actions.length != 10)
            return 4;
        if (actions[0].id != 1235810166 || actions[1].id != 1237681431 || actions[9].id != 1275499400)
            return 5;

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

module.exports = BlockProducerAPIPlugin;