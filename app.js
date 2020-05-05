require('dotenv').config();
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { Octokit } = require("@octokit/rest");
const app = require('express')();
const path = require('path');
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const git_url = process.env.GITHUB_REPO_URL;
const remote = [];
const authToken = process.env.GITHUB_AUTH_TOKEN;
const owner = process.env.GITHUB_REPO_OWNER;
const repo = process.env.GITHUB_REPO_NAME;
const octokit = new Octokit({
    auth: authToken
});

const base_folder = '/mnt/d/Projects/test_node_deploy/';
const release_folder = base_folder + 'releases/';
const release_folder_date = release_folder + formatFolder() + '/';
const shared_folder = base_folder + 'shared/';

const port = process.env.NODE_PORT || 8080;

var running = false;
var logs = [];
var branches = ['develop'];
var branch = 'develop';

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

io.on('connection', (socket) => {
    if (running) {
        io.emit('status', 'deploying');
        io.emit('show log', logs.join("\n"));
    } else {
        githubBranches();
        io.emit('status', 'Not deploy');
    }

    // socket.on('disconnect', () => {
    //     console.log('user disconnected');
    // });

    socket.on('deploy', function (deploy_branch) {
        if (running) {
            console.log('Dang chay cmnr, deploy cc a?');
            io.emit('status', 'deploying');
        } else {
            branch = deploy_branch;
            io.emit('status', 'deploying');
            run();
        }
    });
});

http.listen(port, function () {
    console.log('Server listening at ' + port);
});


async function githubBranches() {
    var protecteds = false;
    var per_page = 100;

    var recursive = true;
    var page = 1;

    while (recursive) {
        var { data } = await octokit.repos.listBranches({
            owner,
            repo,
            protecteds,
            per_page,
            page,
        });

        var a = data.map(function (b) {
            return b.name;
        });
        branches = branches.concat(a);
        page++;
        recursive = a.length;
    }

    io.emit('branches', branches);
}

async function run() {
    running = true;

    // showing('Removing old release folders');
    // await executeZ('find ' + release_folder + '* -mtime +1 -exec rm {} \\;')

    showing('Cloning git from ' + git_url);
    await executeZ('/usr/bin/git clone "' + git_url + '" "' + release_folder_date + '" --branch="' + branch + '" --depth="1"');

    showing('Running composer...');
    await executeZ('cd ' + release_folder_date + ' && composer install --no-interaction --prefer-dist');

    var current = [
        'bootstrap/cache',
        'storage',
        '.env.example',
        '.htpasswd'
    ];

    current = current.concat(remote);

    showing('Making symlink...');
    for (var i = 0;i < current.length; i++) {
        if (current[i] === 'storage' || current[i] === 'bootstrap/cache') {
            await executeZ('rm -rf ' + release_folder_date + current[i]);
        }

        await executeZ('ln -s ' + shared_folder + current[i] + ' ' + release_folder_date + current[i] + '-temp');
        await executeZ('mv -Tf ' + release_folder_date + current[i] + '-temp ' + release_folder_date + current[i]);
    }

    showing('Running npm...');
    await executeZ('cd ' + release_folder_date + ' && npm install');
    await executeZ('cd ' + release_folder_date + ' && npm run dev');
    showing('Migrate database...');
    await executeZ('cd ' + release_folder_date + ' && php artisan migrate --force');
    showing('Making storage link...');
    await executeZ('cd ' + release_folder_date + ' && php artisan storage:link');

    showing('Making current link...');
    await executeZ('ln -s ' + release_folder_date + ' ' + base_folder + 'current-temp');
    await executeZ('mv -Tf ' + base_folder + 'current-temp ' + base_folder + 'current');

    showing('Deployed successfully!');
    running = false;
    logs = [];

    // remove old release (keep 5 or more)
    // latter
}

async function executeZ(cmd) {
    showing('>>>>>> ' + cmd);
    try {
        const { stdout, stderr } = await exec(cmd);
        // console.log('stdout:', stdout);
        // console.log('stderr:', stderr);
        console.log('Done!');

        return true;
    } catch (err) {
        console.error(err);

        return false;
    }

    // TO DO log file
}

function formatFolder() {
    return Date.now().toString();
}

function showing(message = '') {
    console.log(message);
    logs.push(message);
    io.emit('show log', logs.join("\n"));
}
