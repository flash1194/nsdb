var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var fs = require('fs');

var apiRouter = require('./routes/api');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRouter);

(async function () {

    if (!fs.existsSync('config.json')) {
        fs.copyFileSync('public/default-config.json', 'config.json');
    }

    const config = JSON.parse(fs.readFileSync('config.json'));

    const mongo = require('./mongo');
    mongo.start(config.mongo);

    const plugins = require('./plugins');

    console.log('loading plugins...');
    await plugins.load(config.plugins);

    console.log('running tests...');
    if (await plugins.test()) {
        console.log('starting plugins...');
        await plugins.start();
    }
    
})();

module.exports = app;
