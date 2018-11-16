var axios = require('axios');
const BlockProducerAPIPlugin = require('./bpapi');

class EOSFlareAPIPlugin extends BlockProducerAPIPlugin {
    constructor(config, name) {
        super(config, name);
    }
    async getTransaction(txid) {
        const txn = JSON.stringify({
            txn: txid
        });

        var request = (await axios.post('https://api-pub.eosflare.io/v1/eosflare/get_tx', txn,
            {
                headers: { 'Content-Type': 'application/json' },
            }));

        return request.data.tx;
    }
    async getActionsFlare(account, page, limit) {
        var request = (await axios.post('https://api-pub.eosflare.io/v1/eosflare/get_account_actions', JSON.stringify({
            account: account,
            page: page,
            limit: limit
        }),
            {
                headers: { 'Content-Type': 'application/json' },
            }));

        return request.data;
    }
    async getActions(account, position, count) {
        //
        // This is kind of inefficient due to how they designed the API, we require upto 4 requests
        // 1    - determine number of records
        // 2    - get first page worth of data
        // 2.5  - page align, if data is missing, we may have miscalculated what page we should be on
        // 3    - get second page worth of data is not properly aligned
        //
        const MAX_TRY = 10;
        const TRY_FAIL = "ran out of eosflare try attempts";
        for (var t = 0; ; t++) {
            if (t == MAX_TRY) {
                throw new Error(TRY_FAIL);
            }

            const current_state = await this.getActionsFlare(account, 0, 0);
            if (position >= current_state.total) {
                return []; // we're caught up
            }

            const rel_offset = (current_state.total - 1 - position);
            var current_page = Math.floor(rel_offset / count);
            var rel_index;
            var actions = [];

            // argh... "guessing" the page we're on might not quite work due to missing data
            for (; ;) {
                const state_1 = (await this.getActionsFlare(account, current_page, count));
                if (state_1.total != current_state.total) {
                    if (++t == MAX_TRY) {
                        throw new Error(TRY_FAIL);
                    }
                    continue;
                }

                // apparently account_seq's are missing for EOS Flare's api...
                actions = state_1.actions;

                rel_index = actions.length - 1;
                while (rel_index > -1 && actions[rel_index].account_seq < position) {
                    rel_index--;
                }

                if (rel_index > -1 || current_page == 0)
                    break;

                current_page--;
            }

            if (rel_index == -1) {
                this.log(`position=${position}, current_page=${current_page}, count=${count}`);
                throw new Error("unexpected rel index");
            }

            if (rel_index != count - 1) {
                var first_part = actions.slice(0, rel_index + 1);
                var second_part = [];

                if (current_page > 0) {

                    const state_2 = (await this.getActionsFlare(account, current_page - 1, count));
                    if (state_2.total != current_state.total) {
                        continue;
                    }

                    var actions2 = state_2.actions;
                    second_part = actions2.slice(rel_index + 1);
                }

                actions = second_part.concat(first_part);
            }

            break;
        }

        const result = actions.reverse().map(function (a, i) {
            return {
                offset: a.account_seq,
                id: a.global_seq,
                account: a.account,
                transaction: a.trx_id,
                blockId: a.block_num,
                createdAt: Math.floor(new Date(a.block_time).getTime() / 1000),
                name: a.name,
                data: a.data
            };
        });

        return result;
    }
}

module.exports = EOSFlareAPIPlugin;