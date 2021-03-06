require('dotenv').config();
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { Octokit } = require("@octokit/rest");
const app = require('express')();
const express = require('express');
const path = require('path');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const rimraf = require('rimraf');

const git_url = process.env.GITHUB_REPO_URL;
let remoteSetting = process.env.REMOTE;
const remote = remoteSetting ? remoteSetting.split(',') : [];
const authToken = process.env.GITHUB_AUTH_TOKEN;
const owner = process.env.GITHUB_REPO_OWNER;
const repo = process.env.GITHUB_REPO_NAME;
const clearCache = process.env.CLEAR_CACHE === 'true';
var keepOldFolders = process.env.OLD_FOLDERS_TO_KEEP || 3;
var octokit = null;

if (authToken) {
    octokit = new Octokit({
        auth: authToken
    });
}

const base_folder = '/var/www/' + process.env.PROJECT_NAME + '/' + process.env.PROJECT_NAME + '/';
const release_folder = base_folder + 'releases/';
var release_folder_date = release_folder + formatFolder() + '/';
const shared_folder = base_folder + 'shared/';

const port = process.env.NODE_PORT || 8080;

var running = false;
var logs = [];
var branches = ['develop'];
var branch = 'develop';
var progress = 0;

http.listen(port, function () {
    console.log('Server listening at ' + port);
});

app.use(express.static(__dirname + '/node_modules'));

app.get('/deploy', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/deploy/edit-env', function(req, res) {
    res.sendFile(path.join(__dirname + '/edit-env.html'));
});

io.on('connection', (socket) => {
    getCurrentCommit();
    getCurrentBranch();
    socket.on('get branches', function (a) {
        if (running) {
            io.emit('status', 'deploying');
            io.emit('show log', logs);
            io.emit('show progress', progress);
        } else {
            githubBranches();
            io.emit('status', 'Not deploy');
        }
    });

    socket.on('get env', function (a) {
        readFileFrom(shared_folder + '.env').then(function (data) {
            io.emit('env', data);
        });
    });

    socket.on('update env', function (data) {
        writeToFile(shared_folder + '.env', data);
    });

    socket.on('deploy', function (deploy_branch) {
        if (running) {
            console.log('Dang chay cmnr, deploy cc a?');
            io.emit('status', 'deploying');
        } else {
            io.emit('status', 'deploying');
            deploy(deploy_branch);

        }
    });
});

async function deploy(deploy_branch) {
    branch = deploy_branch;
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
    const { stdout, stderr } = await exec('cd ' + base_folder + 'current && git log -1');
    io.emit('current commit', stdout);
}

async function getCurrentBranch() {
    const { stdout, stderr } = await exec('cd ' + base_folder + 'current && git rev-parse --abbrev-ref HEAD');
    io.emit('current branch', stdout);
}

async function githubBranches() {
    if (authToken) {
        let protecteds = false;
        let per_page = 100;
        branches = [];

        let recursive = true;
        let page = 1;

        while (recursive) {
            let { data } = await octokit.repos.listBranches({
                owner,
                repo,
                protecteds,
                per_page,
                page,
            });

            let a = data.map(function (b) {
                return b.name;
            });

            branches = branches.concat(a);
            page++;
            recursive = a.length;
        }
    } else {
        branches = ['develop'];
    }

    io.emit('branches', branches);
}

async function run() {
    // TO DO log by run time
    running = true;
    let folder = formatFolder();
    release_folder_date = release_folder + folder + '/';

    showing('Cloning git from ' + git_url);
    progress = 10;
    let cloned = await executeZ('/usr/bin/git clone "' + git_url + '" "' + release_folder_date + '" --branch="' + branch + '" --depth="1"');
    if (!cloned) {
        return false;
    }

    showing('Running composer...');
    progress = 20;
    let composer = await executeZ('cd ' + release_folder_date + ' && composer install --no-interaction --prefer-dist');
    if (!composer) {
        return false;
    }

    let current = [
        'bootstrap/cache',
        'storage',
        '.env',
        '.htpasswd'
    ];

    current = current.concat(remote);

    showing('Making symlink...');
    progress = 30;
    for (let i = 0;i < current.length; i++) {
        if (current[i] === 'storage' || current[i] === 'bootstrap/cache') {
            let removeSymLink = await executeZ('rm -rf ' + release_folder_date + current[i]);
            if (!removeSymLink) {
                return false;
            }
        }

        let symlinkTmp = await executeZ('ln -s ' + shared_folder + current[i] + ' ' + release_folder_date + current[i] + '-temp');
        if (!symlinkTmp) {
            return false;
        }

        let symlink = await executeZ('mv -Tf ' + release_folder_date + current[i] + '-temp ' + release_folder_date + current[i]);
        if (!symlink) {
            return false;
        }
    }

    showing('Running npm...');
    progress = 40;
    let npmInstall = await executeZ('cd ' + release_folder_date + ' && npm install');
    if (!npmInstall) {
        return false;
    }

    progress = 50;
    let npmRunDev = await executeZ('cd ' + release_folder_date + ' && npm run dev');
    if (!npmRunDev) {
        return false;
    }

    showing('Migrate database...');
    progress = 60;
    let migrations = await executeZ('cd ' + release_folder_date + ' && php artisan migrate --force');
    if (!migrations) {
        return false;
    }

    showing('Making storage link...');
    progress = 70;
    let storageLink = await executeZ('cd ' + release_folder_date + ' && php artisan storage:link');
    if (!storageLink) {
        return false;
    }

    showing('Making current link...');
    progress = 80;
    let currentLinkTmp = await executeZ('ln -s ' + release_folder_date + ' ' + base_folder + 'current-temp');
    if (!currentLinkTmp) {
        return false;
    }

    let currentLink = await executeZ('mv -Tf ' + base_folder + 'current-temp ' + base_folder + 'current');
    if (!currentLink) {
        return false;
    }

    if (clearCache) {
        progress = 85;
        showing('Clearing cache...');
        let clearCachee = await executeZ('cd ' + release_folder_date + ' && php artisan cache:clear');
        let clearConfig = await executeZ('cd ' + release_folder_date + ' && php artisan config:clear');
        // let clearRoute = await executeZ('cd ' + release_folder_date + ' && php artisan route:clear');
        // let clearView = await executeZ('cd ' + release_folder_date + ' && php artisan view:clear');

        if (!clearCachee || !clearConfig) {
            showing('Failed to clear cache, please use your hand :D');
        }
    }

    progress = 90;
    showing('Cleaning old release folders...');
    let cleanFolders = cleanOldFolders(folder);
    if (!cleanFolders) {
        showing('Failed to clear old folders, please use your hand :D');
    }

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

function formatFolder() {
    return Date.now().toString();
}

function showing(message = '') {
    console.log(message);
    logs.push(message);
    io.emit('show log', logs);
    io.emit('show progress', progress);
}

async function readFileFrom(path) {
    const { stdout, stderr } = await exec('cat ' + path);

    return stdout;
}

async function writeToFile(path, content) {
    const { stdout, stderr } = await exec("echo '" + content + "' > " + path);
}

function cleanOldFolders(currentFolder) {
    let releaseFolders = getDirectories(release_folder);
    let index = releaseFolders.indexOf(currentFolder);
    releaseFolders.splice(index, 1);
    keepOldFolders = keepOldFolders - 1;
    let needRemoveFolders = releaseFolders.slice(0, releaseFolders.length - keepOldFolders);

    if (needRemoveFolders.length) {
        for (let i in needRemoveFolders) {
            let folderPath = release_folder + needRemoveFolders[i];
            rimraf.sync(folderPath);
        }
    }

    return true;
}

function getDirectories(path) {
    return fs.readdirSync(path).filter(function (file) {
        return fs.statSync(path + '/' + file).isDirectory();
    });
}
