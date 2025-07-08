const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const projectsRouter = require('./routes/projects');
const componentsRouter = require('./routes/components');
const partsRouter = require('./routes/parts');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwtAuthStrategy = require('./config/passportConfig');
const passport = require('passport');

// Mongoose instance connection url connection
const databaseUrl = process.env.TACO_TRUCK_DB_URL;
mongoose.Promise = global.Promise;

/*
 * Connect to database
*/

var connectWithRetry = function() {
    return mongoose.connect(databaseUrl, function(err) {
        if (err) {
            console.warn('Failed to connect to mongo on startup - retrying in 5 sec');
            setTimeout(connectWithRetry, 5000);
        }
    });
};
connectWithRetry();

passport.use(jwtAuthStrategy);

const app = express();

app.use(logger('dev'));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/projects', passport.authenticate("jwt", { session: false }), projectsRouter);
app.use('/components', passport.authenticate("jwt", { session: false }), componentsRouter);
app.use('/parts', passport.authenticate("jwt", { session: false }), partsRouter);

module.exports = app;
