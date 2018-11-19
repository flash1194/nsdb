const ecc = require('eosjs-ecc');
const Eos = require('eosjs');

var express = require('express');
var router = express.Router();

const web = require('../web');

var API_SESSION = {};

function IsEnabled() {
    const service = web.GetPlugin('eosservice');
    const anon_config = service.config.anon;
    if (anon_config && anon_config.key && anon_config.account && anon_config.permission) {
        return true;
    }
    else {
        return false;
    }
}

function ValidatePostData(post_data, json_metadata) {

    if (post_data.reply_to_post_uuid.length > 128)
        throw new Error('invalid reply to post uuid');

    if (post_data.content.length >= 1024 * 10)
        throw new Error('content must be under 10kb');

    if (post_data.post_uuid.length > 128)
        throw new Error('invalid post uuid');

    if (post_data.json_metadata.length > 1024)
        throw new Error('invalid json metadata');

    const anon_id = json_metadata.anon_id;
    if (anon_id) {
        if (!anon_id.sig || !anon_id.pub ||
            !ecc.verify(anon_id.sig, post_data.content, anon_id.pub, 'utf8'))
            throw new Error('failed to verify integrity of anonymous identity');
    }

    const sub = [(/anon/), (/^anon($|(\-.+))/gm)];
    if (!sub.some(rx => rx.test(json_metadata.sub))) {
        if (!anon_id || !anon_id.pub)
            throw new Error('to post here anonymously, you must have an anonymous identity set');
    }

    if (json_metadata.edit)
        throw new Error('edit disabled');

    if (json_metadata.title.length > 80)
        throw new Error('title must be under 80 characters');

    if (json_metadata.type != 'novusphere-forum')
        throw new Error('protocol novusphere-forum expected');

    if (json_metadata.parent_uuid.length > 128)
        throw new Error('invalid parent uuid');

    const attachment = json_metadata.attachment;
    if (attachment.value && attachment.type && attachment.display) {
        if ((attachment.value.length + attachment.type.length + attachment.display.length) > 512)
            throw new Error('attachment must be less than 512 characters');
    }
}

function ValidateSession(req, anon_id, anon_config) {
    const session_key = web.Sha256(web.GetIP(req) + anon_config.key);
    const time_now = (new Date()).getTime();

    var api_session = API_SESSION[session_key];
    api_session = isNaN(api_session) ? 0 : api_session;

    if (api_session > time_now) {
        throw new Error(`you must wait ${Math.ceil((api_session - time_now) / 1000)} second(s)`);
    }

    //
    // use anon_id as api key for custom delays
    //
    var delay = anon_config.delays[(anon_id) ? anon_id.pub : 'default'];
    if (!delay) {
        delay = anon_config.delays['default'];
    }
    if (isNaN(delay)) {
        delay = 0;
    }

    API_SESSION[session_key] = time_now + delay;
}

router.get('/', async function (req, res, next) {
    web.Result(res, { enabled: IsEnabled() });
});

router.post('/post', async function (req, res, next) {

    async function getResult() {
        var result = {};
        if (!IsEnabled()) {
            result.error = 'this plugin has not yet been configured';
            return result;
        }

        const service = web.GetPlugin('eosservice');
        const anon_config = service.config.anon;

        try {
            const json_metadata = JSON.parse(req.body.json_metadata);

            //
            // generate signature, if they gave us the private key
            //
            if (json_metadata.anon_id &&
                (typeof json_metadata.anon_id) == 'string' &&
                ecc.isValidPrivate(json_metadata.anon_id)) {

                const private_wif = json_metadata.anon_id;
                json_metadata.anon_id = {
                    pub: ecc.privateToPublic(private_wif),
                    sig: ecc.sign(req.body.content, private_wif, 'utf8')
                };
            }

            //
            // santize req.body
            //
            const post_data = {
                poster: anon_config.account,
                reply_to_poster: req.body.reply_to_poster,
                reply_to_post_uuid: req.body.reply_to_post_uuid,
                certify: 0,
                content: req.body.content,
                post_uuid: req.body.post_uuid,
                json_metadata: JSON.stringify({
                    'title': json_metadata.title,
                    'type': json_metadata.type,
                    'sub': json_metadata.sub,
                    'parent_uuid': json_metadata.parent_uuid,
                    'edit': json_metadata.edit,
                    'attachment': {
                        'value': json_metadata.attachment.value,
                        'type': json_metadata.attachment.type,
                        'display': json_metadata.attachment.display
                    },
                    'reddit': (json_metadata.reddit) ? json_metadata.reddit : null,
                    'anon_id': (json_metadata.anon_id) ? json_metadata.anon_id : null
                })
            };

            ValidatePostData(post_data, json_metadata);
            ValidateSession(req, json_metadata.anon_id, anon_config);

            const eos = Eos({
                httpEndpoint: web.GetPlugin('eos').config.endpoint,
                chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
                keyProvider: anon_config.key
            });

            const contract = await eos.contract(anon_config.contract);
            result = await contract.transaction(tx => {
                tx.post(post_data,
                    {
                        authorization: [
                            {
                                actor: anon_config.account,
                                permission: anon_config.permission
                            }]
                    });
            });
        }
        catch (ex) {
            result.error = ex.toString();
            return result;
        }

        return result;
    }

    web.Result(res, await getResult());
});

module.exports = router;
