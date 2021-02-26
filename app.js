require('dotenv').config();
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const app = require('express')();
const express = require('express');
const path = require('path');
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const base_folder = process.env.BASE_FOLDER || '~/';
const port = process.env.NODE_PORT || 8080;
const gitRemote = process.env.GIT_REMOTE || 'origin';
const gitBranch = process.env.GIT_BRANCH || 'develop';

var running = false;
var logs = [];
var progress = 0;

http.listen(port, function () {
    console.log('Server listening at ' + port);
});

app.use(express.static(__dirname + '/node_modules'));

app.get('/deploy', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

io.on('connection', (socket) => {
    getCurrentCommit();
    socket.on('get branches', function (a) {
        if (running) {
            io.emit('status', 'deploying');
            io.emit('show log', logs);
            io.emit('show progress', progress);
        } else {
            io.emit('status', 'Not deploy');
        }
    });

    socket.on('deploy', function () {
        if (running) {
            console.log('Dang chay cmnr, deploy cc a?');
            io.emit('status', 'deploying');
        } else {
            io.emit('status', 'deploying');
            deploy();

        }
    });
});

async function deploy() {
    let deployed  = await run();
    if (deployed) {
        progress = 100;
        showing('Deployed successfully!');
        io.emit('status', 'done');
    } else {
        showing('Failed to deploy!');
        io.emit('status', 'fail');
    }

    running = false;
    logs = [];
    progress = 0;
}

async function getCurrentCommit() {
    const { stdout, stderr } = await exec('cd ' + base_folder + ' && git log -1');
    io.emit('current commit', stdout);
}

async function run() {
    running = true;

    showing('Pull new code from Github');
    progress = 10;
    let pulled = await executeZ('cd ' + base_folder + ' && /usr/bin/git pull ' + gitRemote + ' ' + gitBranch);
    if (!pulled) {
        return false;
    }

    showing('Shutting down Docker');
    progress = 40;
    let dockerDown = await executeZ('cd ' + base_folder + ' && docker-compose down');
    if (!dockerDown) {
        return false;
    }

    showing('Creating new Docker');
    progress = 80;
    let dockerUp = await executeZ('cd ' + base_folder + ' && docker-compose up -d');
    if (!dockerUp) {
        return false;
    }

    showing('Done.');
    progress = 100;

    return true;
}

async function executeZ(cmd, showCmd = true) {
    if (showCmd) {
        showing('>>>>>> ' + cmd);
    }

    try {
        const { stdout, stderr } = await exec(cmd);
        if (showCmd) {
            showing(stdout);
        }
        // showing(stderr);
        console.log('Done!');

        return true;
    } catch (err) {
        console.error(err);
        if (showCmd) {
            showing(err.toString());
        }

        return false;
    }

    // TO DO log file
}


function showing(message = '') {
    console.log(message);
    logs.push(message);
    io.emit('show log', logs);
    io.emit('show progress', progress);
}
