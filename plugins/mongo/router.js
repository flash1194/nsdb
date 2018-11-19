var express = require('express');
var router = express.Router();

const web = require('../web');

var API_SESSION = {};

router.post('/', async function (req, res, next) {

  async function getResult() {
    var result = {};

    const mongo = web.GetPlugin('mongo');
    if (!mongo) {
      result.error = 'mongo plugin not found';
      return result;
    }

    var command = req.body;

    if (typeof command == 'object') {
      // backwards compatible bug fix...
      var keys = Object.keys(command);
      if (keys.length == 1 && command[keys[0]] == '') {
        command = keys[0];
      }
    }

    if (typeof command == 'string') {
      try {
        command = JSON.parse(command);
      }
      catch (ex) {
        result.error = 'failed to parse command json';
        return result;
      }
    }

    var command_name = '';
    for (var i = 0; i < mongo.config.commands.length; i++) {
      if (command[mongo.config.commands[i]]) {
        command_name = mongo.config.commands[i];
        break;
      }
    }

    if (!command_name) {
      result.error = 'api command must be of operations: ' + mongo.config.commands.join(', ');
      return result;
    }

    const ONE_MINUTE = 60000;
    const MAX_MAXTIMEMS = ONE_MINUTE * mongo.config.query_time_ratio;
    const session_key = web.Sha256(web.GetIP(req));

    var api_session = API_SESSION[session_key];
    if (!api_session) {
      API_SESSION[session_key] = api_session = {
        last_query: 0,
        allowed_time_ms: Math.floor(ONE_MINUTE * mongo.config.query_time_ratio)
      };
    }

    result.allowedTimeMS = api_session.allowed_time_ms;

    if (!command.maxTimeMS || isNaN(command.maxTimeMS)) {
      result.error = 'field maxTimeMS must be specified for all commands';
      return result;
    }

    const now = (new Date()).getTime();
    const delta = Math.min(ONE_MINUTE, (now - api_session.last_query) * mongo.config.query_time_ratio);
    const maxTimeMS = Math.min(MAX_MAXTIMEMS, api_session.allowed_time_ms + delta);

    if (command.maxTimeMS > maxTimeMS) {
      result.error = 'rate limited - insufficient query time available';
      result.sleep = Math.floor((command.maxTimeMS - maxTimeMS) / mongo.config.query_time_ratio);
      return result;
    }

    try {
      result = await mongo.command(command);
    }
    catch (ex) {
      result.error = ex.toString();
      return result;
    }
    finally {
      api_session.last_query = (new Date()).getTime();
      api_session.allowed_time_ms = maxTimeMS - (api_session.last_query - now);
      result.allowedTimeMS = api_session.allowed_time_ms;
    }

    return result;
  }

  web.Result(res, await getResult());
});

module.exports = router;
