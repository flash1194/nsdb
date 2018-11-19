var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var fs = require('fs');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

(async function () {

    if (!fs.existsSync('config.json')) {
        fs.copyFileSync('public/default-config.json', 'config.json');
    }

    const config = JSON.parse(fs.readFileSync('config.json'));    
    const plugins = require('./plugins');

    console.log('loading plugins...');
    await plugins.load(config.plugins);

    console.log('running tests...');
    if (await plugins.test()) {
        console.log('starting plugins...');
        await plugins.start(app);
    }
    else
    {
        console.log('tests failed, aborting...');
        process.exit(1);
    }
    
})();

module.exports = app;
