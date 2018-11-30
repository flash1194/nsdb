const web = require('../web');

var express = require('express');
var router = express.Router();

var axios = require('axios');

//
// Drop in replacement for https://cors.io/?url
//
router.get('/', async function (req, res, next) {
    var payload = '';

    const config = web.GetPlugin('eosservice').config;
    const whitelist = config.cors.whitelist.map(i => new RegExp(i, "i"));

    if (req.url.length > 2) {
        try {
            const url = req.url.substring(2);
            if (whitelist.some(rx => rx.test(url))) {
                var request = (await axios.get(url));
                payload = request.data;
            }
            else {
                throw new Error("this cors request has not been whitelisted");
            }
        }
        catch (ex) {
            payload = ex.toString();
            res.status(400);
        }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('content-type', 'text/plain');
    res.send(payload);
});

module.exports = router;