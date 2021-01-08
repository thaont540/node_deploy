# Laravel deployer
*Note* Deployed Laravel folders will be organized same [Rocketeer](http://rocketeer.autopergamene.eu/) deployed, so this app could be used while using Rocketeer. If this is the first time you setup your project, so you need setup project folders by manual.

This will be: `/var/www/project_name/github_name/{releases - shared - current}`
## Manual setup
### Install requirement
```
$ sudo apt-get install git
$ curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
$ sudo apt-get install -y nodejs
$ npm install pm2 -g
```
### Setting
- Git clone from [Master branch](https://github.com/thaont540/node_deploy)
- Move to folder `node_deploy`
- Config `.env` file
```
cp .env.example .env
```
*Note* Go to [Personal access tokens ](https://github.com/settings/tokens) to get token for `GITHUB_AUTH_TOKEN`
- Install package:
```
$ npm install
```
- Run in background:
```
$ pm2 start app.js
```
## Auto setup
![](https://github.com/thaont540/node_deploy/raw/master/bash.png)
- Download bash file [install.sh](https://github.com/thaont540/node_deploy/blob/master/install.sh) then move it to `/var/www/`
- Change to `deploy` user
```
$ sudo su - deploy
```
- Then run this file in `deploy` user
```
$ ./install.sh
```
### Bash file with su permission
- Download bash file [sudo_install.sh](https://github.com/thaont540/node_deploy/blob/master/sudo_install.sh) then move it to `/var/www/`
- Then run with sudo:
```
$ sudo ./sudo_install.sh
```

## Nginx setup
- Use reverse proxy
```
#.....
location ^~/socket.io/ {
    proxy_pass http://localhost:8001; #node port
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_redirect off;

    proxy_buffers 8 32k;
    proxy_buffer_size 64k;

    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_set_header X-NginX-Proxy true;
}
location /deploy {
    proxy_pass http://localhost:8001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_redirect off;

    proxy_buffers 8 32k;
    proxy_buffer_size 64k;

    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_set_header X-NginX-Proxy true;
}
#....
```
**!! Note !!** If your project used Laravel echo or something else like socketIO, this will get conflict.
## How to use
![](https://github.com/thaont540/node_deploy/raw/master/demo.png)
- Go to `https://yourdomain.com/deploy` to start deploy
- Go to `https://yourdomain.com/deploy/edit-env` to edit env file
- Check pm2 at [pm2.keymetrics.io](https://pm2.keymetrics.io/)
- Get Github auth token [here](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line)
- Deployed Laravel folders will be organized same [Rocketeer](http://rocketeer.autopergamene.eu/) deployed