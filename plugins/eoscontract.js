const mongo = require('../mongo');
const Plugin = require('./plugin');

const fs = require('fs');
const axios = require('axios');
const readline = require('readline');

const EJSON = require('mongodb-extjson');

const RECENT_DEFAULT = {
    id: 0,
    transaction: '',
    offset: -1
}

const ACTIONS_PER_QUERY = 25;

class EOSContractPlugin extends Plugin {
    constructor(config, name) {
        super(config, name);
        this._insertions = {};

        this._duplicates = 0;
        this._unique_txid = [];
    }
    async setRecentDefault() {
        return await this.setRecent(RECENT_DEFAULT);
    }
    async setRecent(tx) {
        if (!tx) {
            const payload = (await mongo.command({
                find: this.config.collections[0].name,
                sort: { id: -1 },
                limit: 1
            })).cursor.firstBatch;

            if (payload.length > 0) {
                tx = payload[0];
            }
            else {
                tx = RECENT_DEFAULT;
            }
        }

        this.recent = {
            id: tx.id,
            transaction: tx.transaction,
            offset: tx.offset
        };

        this.log(this.recent, 'setRecent');
    }
    migrateSnapshotRow(table, action) {

    }
    async download(url, path) {
        // axios image download with response type "stream"
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream'
        });

        // pipe the result stream into a file on disc
        response.data.pipe(fs.createWriteStream(path));

        await (new Promise((resolve, reject) => {
            response.data.on('end', () => {
                resolve();
            });

            response.data.on('error', () => {
                reject();
            });
        }));
    }
    async restoreSnapshot(collection) {
        const SNAPSHOT_PATH = 'public/snapshot/' + collection.name + '.json';
        const SNAPSHOT_URL = collection.snapshot;

        if (!SNAPSHOT_URL) {
            this.log(`no snapshot for ${collection.name} found, skipping...`);
            return;
        }

        if (!fs.existsSync(SNAPSHOT_PATH)) {
            this.log(`downloading snapshot from ${SNAPSHOT_URL}`);
            await this.download(SNAPSHOT_URL, SNAPSHOT_PATH);
        }

        this.log('processing snapshot...');

        var migrated_actions = [];
        await this.readlines(SNAPSHOT_PATH, (line) => {
            var row = EJSON.parse(line);
            migrated_actions.push(this.migrateSnapshotRow(collection.name, row));
        });

        for (var i = 0; i < migrated_actions.length; i++) {
            var action = await migrated_actions[i];
            await this.beforeInsertAction(action);
            this.insert(collection.name, action);
        }

        await this.commit();
    }
    readlines(path, callback) {
        const rl = readline.createInterface({
            input: fs.createReadStream(path),
            crlfDelay: Infinity
        });

        return new Promise((resolve, reject) => {
            rl.on('line', callback);
            rl.on('close', resolve);
        });
    }
    async migrations() {
        if (this.recent.offset == -1) {
            if (!fs.existsSync('public/snapshot')) {
                fs.mkdirSync('public/snapshot');
            }

            //for (var j = 0; j < this.config.collections.length; j++) {
            //const collection = this.config.collections[j];
            const collection = this.config.collections[0];
            await this.restoreSnapshot(collection);
            //}

            await this.setRecent();
            this.log('snapshot successfully imported');
        }

    }
    async test() {
        if (!this.plugin('eos')) {
            return 1;
        }
        return 0;
    }
    insert(collection, values) {
        var insertions = this._insertions[collection];
        if (!insertions) {
            insertions = this._insertions[collection] = [];
        }

        if (!Array.isArray(values))
            values = [values];

        for (var i = 0; i < values.length; i++)
            insertions.push(values[i]);
    }
    async commit() {
        for (var key in this._insertions) {
            const documents = this._insertions[key];
            const result = await mongo.command({
                insert: key,
                documents: documents,
                ordered: false
            });
            this.log(`committed ${documents.length} documents to ${key}`);
        }
        this._insertions = {};
    }
    async beforeInsertAction(action) {

    }
    async deserializeAction(action) {

    }
    async run() {
        var actions = [];
        var last_irreversible_block_num = 0;

        try {
            if (this.config.irreversible_only) {
                var info = await this.plugin('eos').getInfo();
                last_irreversible_block_num = info.last_irreversible_block_num;
            }
            actions = await this.plugin('eos').getActions(this.config.account, this.recent.offset + 1, ACTIONS_PER_QUERY);
        }
        catch (ex) {
            this.log(`failed to get actions - ${ex}`);
            return;
        }

        if (last_irreversible_block_num) {
            const old_length = actions.length;
            actions = actions.filter(a => a.blockId <= last_irreversible_block_num);
            if (actions.length != old_length) {
                this.log(`current ignoring ${old_length - actions.length}/+ reversible actions`);
            }
        }

        if (actions.length == 0) {
            this.log(`up to date at offset ${this.recent.offset}`);
            return;
        }

        for (var i = 0; i < actions.length; i++) {
            var action = actions[i];

            if (action.offset == undefined) {
                action.offset = (this.recent.offset + 1) + i;
            }

            if (typeof action.data == 'string') {
                await this.deserializeAction(action);
            }

            if (action.account == this.config.account) {
                const json = this.config.json[action.name];
                if (json) {
                    try { action.data[json] = JSON.parse(action.data[json]); }
                    catch (ex) { }
                }
            }

            if (this.config.check_dup) {
                if (this._unique_txid.includes(action.transaction)) {
                    this._duplicates++;
                    this.log(`detected duplicate ${action.transaction} - ${this._duplicates}`);
                    continue;
                }

                this._unique_txid.push(action.transaction);
            }

            await this.beforeInsertAction(action);
        }

        this.insert(this.config.collections[0].name, actions);
        await this.commit();

        if (this.config.check_dup) {
            if (this._duplicates.length > 1000) {
                // trim down cache
                this._duplicates = this._duplicates.slice(this._duplicates.length - 1000);
            }
        }

        const last_action = actions[actions.length - 1];
        this.setRecent(last_action);
    }
    async createIndices() {
        const db = await mongo.getDatabase();

        for (var j = 0; j < this.config.collections.length; j++) {
            const collection_name = this.config.collections[j].name;
            const indices = this.config.collections[j].indices;

            for (var i = 0; i < indices.length; i++) {
                await db.createIndex(collection_name, indices[i]);
            }
        }
    }
    async start() {
        if (this.config.disabled) {
            this.log(`${this.name} is disabled`);
            return;
        }

        await this.setRecent();
        await this.createIndices();
        await this.migrations();

        for (; ;) {
            try { await this.run(); }
            catch (ex) {
                this.log('error at eoscontract::run');
                console.log(ex);
            }
            await this.sleep(5000);
        }
    }
}

module.exports = EOSContractPlugin;