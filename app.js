require('dotenv').config();
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { Octokit } = require("@octokit/rest");
const app = require('express')();
const path = require('path');
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const git_url = process.env.GITHUB_REPO_URL;
let remoteSetting = process.env.REMOTE;
const remote = remoteSetting ? remoteSetting.split(',') : [];
const authToken = process.env.GITHUB_AUTH_TOKEN;
const owner = process.env.GITHUB_REPO_OWNER;
const repo = process.env.GITHUB_REPO_NAME;
const octokit = new Octokit({
    auth: authToken
});

const base_folder = '/var/www/' + process.env.PROJECT_NAME + '/' + process.env.PROJECT_NAME + '/';
const release_folder = base_folder + 'releases/';
var release_folder_date = release_folder + formatFolder() + '/';
const shared_folder = base_folder + 'shared/';

const port = process.env.NODE_PORT || 8080;

var running = false;
var logs = [];
var branches = ['develop'];
var branch = 'develop';

app.get('/deploy', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/deploy/edit-env', function(req, res) {
    res.sendFile(path.join(__dirname + '/edit-env.html'));
});

async function test() {
    let env = await readFileFrom(shared_folder + '.env.bak');
    writeToFile(shared_folder + '.env', env);
}

io.on('connection', (socket) => {
    socket.on('get branches', function (a) {
        if (running) {
            io.emit('status', 'deploying');
            io.emit('show log', logs.join("\n"));
        } else {
            githubBranches();
            io.emit('status', 'Not deploy');
        }
    });

    // socket.on('disconnect', () => {
    //     console.log('user disconnected');
    // });

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

http.listen(port, function () {
    console.log('Server listening at ' + port);
});

async function deploy(deploy_branch) {
    branch = deploy_branch;
    let deployed  = await run();
    if (deployed) {
        showing('Deployed successfully!');
    } else {
        showing('Failed to deploy!');
    }

    running = false;
    logs = [];
}

async function githubBranches() {
    let protecteds = false;
    let per_page = 100;
    branches = ['develop'];

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

    io.emit('branches', branches);
}

async function run() {
    // TO DO log by run time
    running = true;
    release_folder_date = release_folder + formatFolder() + '/';

    // showing('Removing old release folders');
    // await executeZ('find ' + release_folder + '* -mtime +1 -exec rm {} \\;')

    showing('Cloning git from ' + git_url);
    let cloned = await executeZ('/usr/bin/git clone "' + git_url + '" "' + release_folder_date + '" --branch="' + branch + '" --depth="1"');
    if (!cloned) {
        return false;
    }

    showing('Running composer...');
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
    let npmInstall = await executeZ('cd ' + release_folder_date + ' && npm install');
    if (!npmInstall) {
        return false;
    }

    let npmRunDev = await executeZ('cd ' + release_folder_date + ' && npm run dev');
    if (!npmRunDev) {
        return false;
    }

    showing('Migrate database...');
    let migrations = await executeZ('cd ' + release_folder_date + ' && php artisan migrate --force');
    if (!migrations) {
        return false;
    }

    showing('Making storage link...');
    let storageLink = await executeZ('cd ' + release_folder_date + ' && php artisan storage:link');
    if (!storageLink) {
        return false;
    }

    showing('Making current link...');
    let currentLinkTmp = await executeZ('ln -s ' + release_folder_date + ' ' + base_folder + 'current-temp');
    if (!currentLinkTmp) {
        return false;
    }

    let currentLink = await executeZ('mv -Tf ' + base_folder + 'current-temp ' + base_folder + 'current');
    if (!currentLink) {
        return false;
    }

    // remove old release (keep 5 or more)
    // latter

    return true;
}

async function executeZ(cmd) {
    showing('>>>>>> ' + cmd);
    try {
        const { stdout, stderr } = await exec(cmd);
        showing(stdout);
        // showing(stderr);
        console.log('Done!');

        return true;
    } catch (err) {
        console.error(err);
        showing(err.toString());
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

async function readFileFrom(path) {
    const { stdout, stderr } = await exec('cat ' + path);

    return stdout;
}

async function writeToFile(path, content) {
    const { stdout, stderr } = await exec("echo '" + content + "' > " + path);
}
