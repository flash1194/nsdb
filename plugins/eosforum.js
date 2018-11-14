const mongo = require('../mongo');

const EOSContractPlugin = require('./eoscontract');
const EOSFORUMRCPP_START = 1335182167;

class EOSForumPlugin extends EOSContractPlugin {
    constructor(config, name) {
        super(config, name);
    }
    async migrateSnapshotRow(table, action) {
        if (action.id <= EOSFORUMRCPP_START && action.data.tags) {
            action.tags = action.data.tags;
            delete action.data.tags;
        }
        return action;
    }
    async migrations() {
        await super.migrations();

        if (this.recent.id == EOSFORUMRCPP_START) {
            this.log('detected migration eosforumdapp --> eosforumrcpp');
            this.setRecentDefault();
        }
    }
    async beforeInsertAction(action) {
        await super.beforeInsertAction(action);

        if (action.account != this.config.account)
            return;

        // TO-DO: deserialization
        if (typeof action.data == 'string') {
            switch (action.name) {
                case 'post': break;
                case 'propose': break;
                case 'expire': break;
                case 'vote': break;
                case 'unvote': break;
            }
        }

        if (action.createdAt >= 1538136731 && action.name == 'post') {
            var tags = action.data.content.match(/\B(\\)?#([a-zA-Z0-9_]+)\b/g);
            if (tags) {
                tags = tags.map(t => t.toLowerCase());

                action.tags = Array.from(new Set(tags));
                if (action.data.json_metadata.edit) {
                    var find_parent = await mongo.command({
                        find: this.config.collections[0].name,
                        filter: {
                            "data.poster": action.data.poster,
                            "data.post_uuid": action.data.json_metadata.parent_uuid
                        }
                    });

                    if (find_parent.cursor.firstBatch.length > 0) {
                        var parent = find_parent.cursor.firstBatch[0];
                        var p_tags = new Set(parent.tags ? parent.tags : []);
                        for (var i = 0; i < action.tags.length; i++)
                            p_tags.add(action.tags[i]);

                        parent.tags = Array.from(p_tags);

                        await mongo.command({
                            update: this.config.collections[0].name,
                            updates: [{
                                q: { id: parent.id },
                                u: parent
                            }]
                        });
                    }
                }
            }
        }
    }
}

module.exports = EOSForumPlugin;