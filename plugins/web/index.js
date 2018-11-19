const crypto = require('crypto');
const plugins = require('../../plugins');

function GetIP(req) {
    var forward = req.headers["x-forwarded-for"]; // cloudflare
    if (forward) {
        return forward.split(',')[0];
    }
    return req.connection.remoteAddress;
}

function Sha256(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function GetPlugin(name) {
    const plugin = plugins[name];
    return (plugin.config) ? plugin : null;
}

function Result(res, payload) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('content-type', 'application/json');
    res.send(JSON.stringify(payload));
}

module.exports = {
    GetIP,
    Sha256,
    GetPlugin,
    Result,
};