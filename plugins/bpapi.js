var axios = require('axios');
const EOSAPIPlugin = require('./eosapi');

class BlockProducerAPIPlugin extends EOSAPIPlugin {
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
                headers: { 'Content-Type': 'application/json' },
                timeout: this.config.timeout
            }));

        const _this = this;
        return request.data.actions.map(function (a, i) {
            const trace = a.action_trace;
            if (!trace) { // mongo plugin [crypto lions]
                const act = a.act;
                return {
                    id: a.receipt.global_sequence,
                    account: act.account,
                    transaction: a.trx_id,
                    blockId: a.block_num,
                    createdAt: new Date(a.block_time).getTime() / 1000,
                    name: act.name, 
                    data: act.data
                };
            }
            else {
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
}

module.exports = BlockProducerAPIPlugin;