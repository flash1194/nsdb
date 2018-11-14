const mongo = require('../../mongo');

class NovusphereProtocol {
    constructor(plugin, action) {
        this.plugin = plugin;
        this.action = action;

        if (action.account == 'novuspheredb' && action.name == 'push') {
            this.method = action.data.json.method;
            this.data = action.data.json.data;
        }

        this.NS_ACCOUNT = plugin.config.collections[1].name;
        this.NS_POST_STATE = plugin.config.collections[2].name;
        this.NS_POST_VOTE = plugin.config.collections[3].name;
    }
    async handleTransfer() {
        const memo = this.action.data.memo;
        const UPVOTE_FOR = 'upvote for ';

        if (memo.indexOf(UPVOTE_FOR) != 0) {
            this.plugin.log(`unexpected memo prefix: ${memo}`, `handleTransfer`);
            return;
        }

        const txid = memo.substring(UPVOTE_FOR.length);
        const atmos = parseFloat(this.action.data.quantity);

        var state = await this.getPostState(txid, false);
        if (!state) {
            this.plugin.log(`unable to find state`, `handleTransfer`);
            return;
        }

        var mult = 2;

        const eosforum = this.plugin.plugin('eosforum');
        if (eosforum) {
            const post = await this.find(eosforum.config.collections[0].name, 1, { transaction: txid });
            if (post.length > 0 && post[0].data.poster == this.action.data.from) { // self up vote
                mult = 1;
            }
        }

        // TO-DO: determine from action.blockId
        const UPVOTE_ATMOS_RATE = 10;
        state.up_atmos = parseFloat(state.up_atmos) + (atmos * mult / UPVOTE_ATMOS_RATE);

        const update = await mongo.command({
            update: this.NS_POST_STATE,
            updates: [
                {
                    q: { txid: txid },
                    u: state
                }
            ]
        });

        //this.plugin.log(state, `paid upvote ${mult}`);
    }
    async handle() {
        if (!this.method) {
            return;
        }

        const router = {
            'forum_vote': this.forumVote.bind(this)
        };

        const route = router[this.method];
        if (route) {
            await route();
        }
    }
    async find(collection, limit, filter, create) {
        const existing = await mongo.command({
            find: collection,
            limit: limit,
            filter: filter
        });

        if (existing && existing.cursor.firstBatch.length > 0) {
            return existing.cursor.firstBatch;
        }

        if (create) {
            const document = create();
            const add = await mongo.command({
                insert: collection,
                documents: [document]
            });
            return [document];
        }

        return [];
    }
    async getPostState(txid, create) {
        var creator = () => {
            return {
                txid: txid,
                up: 0,
                up_atmos: 0
            }
        };

        const find = await this.find(this.NS_POST_STATE, 1, { txid: txid }, create ? creator : null);
        return find.length > 0 ? find[0] : null;
    }
    async forumVote() {
        if (!this.data.txid) {
            return;
        }

        const vote_document = {
            account: this.action.data.account,
            txid: this.data.txid
        };

        const existing = await this.find(this.NS_POST_VOTE, 1, vote_document);
        if (existing.length > 0) {
            return;
        }

        const add = await mongo.command({
            insert: this.NS_POST_VOTE,
            documents: [vote_document]
        });

        var state = await this.getPostState(vote_document.txid, true);
        state.up = parseInt(state.up) + 1;

        const update = await mongo.command({
            update: this.NS_POST_STATE,
            updates: [
                {
                    q: { txid: vote_document.txid },
                    u: state
                }
            ]
        });

        //this.plugin.log(state);
    }
}

module.exports = NovusphereProtocol;