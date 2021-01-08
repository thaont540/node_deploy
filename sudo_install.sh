#!/bin/bash
function install_nodejs () {
  curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
  sudo apt-get install -y nodejs
}
function check_command() {
  local _binary="$1"
  command -v "$_binary" >/dev/null 2>&1 && return 0
}
function check_empty_directory()
{
  local _dir="${1:-}"
  [[ -n "$_dir" && -d "$_dir" && "$( find "$_dir" -maxdepth 0 2>/dev/null|wc -l )" -eq 1 ]]
}
NOCOLOR='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
ORANGE='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
LIGHTGRAY='\033[0;37m'
DARKGRAY='\033[1;30m'
LIGHTRED='\033[1;31m'
LIGHTGREEN='\033[1;32m'
YELLOW='\033[1;33m'
LIGHTBLUE='\033[1;34m'
LIGHTPURPLE='\033[1;35m'
LIGHTCYAN='\033[1;36m'
WHITE='\033[1;37m'
echo "______________________"
echo "|                    |"
echo -e "|  ${YELLOW}Laravel deployer${NOCOLOR}  |"
echo "|                    |"
echo "----------------------"
echo " ______________________________________"
echo "/ You must read before start           \\"
echo "\\ https://github.com/thaont540/        /"
echo " --------------------------------------"
echo "        \   ^__^"
echo "         \  (oo)_______"
echo "            (__)\       )\/\\"
echo "                ||----w |"
echo "                ||     ||"
echo "                                     "
check_command git || sudo apt-get install git
check_command node || install_nodejs
check_command npm || echo -e "Why ${RED}don't${NOCOLOR} have ${YELLOW}Npm${NOCOLOR}?"
check_command pm2 || npm install pm2 -g
echo -e "${YELLOW}Enter user who you want to run with permission:${NOCOLOR} (such as ${RED}deploy${NOCOLOR} user)"
read username
! check_empty_directory "$(pwd)/node_deploy" || rm -r "$(pwd)/node_deploy"
sudo -u ${username} git clone git@github.com:thaont540/node_deploy.git
cd "$(pwd)/node_deploy" && sudo -u ${username} npm install
echo -e "Config .env file..."
echo -e "${GREEN}Enter Github Url (using ssh link):${NOCOLOR} ${LIGHTGRAY}(Git url which you want to deploy)${NOCOLOR}"
read x
echo -e "GITHUB_REPO_URL=${x:-"git@github.com:thaont540/petstore.git"}" >> .env
echo -e "${GREEN}Enter Github Auth token:${NOCOLOR} ${LIGHTGRAY}(To fetch branches and something else)${NOCOLOR}"
read x
echo -e "GITHUB_AUTH_TOKEN=${x}" >> .env
echo -e "${GREEN}Enter Github Repo owner:${NOCOLOR} ${LIGHTGRAY}(thaont540)${NOCOLOR}"
read x
echo -e "GITHUB_REPO_OWNER=${x:-"thaont540"}" >> .env
echo -e "${GREEN}Enter Github Repo name:${NOCOLOR} ${LIGHTGRAY}(petstore)${NOCOLOR}"
read x
echo -e "GITHUB_REPO_NAME=${x:-"petstore"}" >> .env
echo -e "${GREEN}Enter Project name:${NOCOLOR} ${LIGHTGRAY}(petstore)${NOCOLOR}"
read x
echo -e "PROJECT_NAME=${x:-"petstore"}" >> .env
echo -e "${GREEN}Enter node port:${NOCOLOR} ${LIGHTGRAY}(8001)${NOCOLOR}"
read x
echo -e "NODE_PORT=${x:-8001}" >> .env
echo -e "CLEAR_CACHE=true" >> .env
echo -e "REMOTE=public/uploads,public/adminer.php,public/log-viewer.php" >> .env
echo -e "OLD_FOLDERS_TO_KEEP=5" >> .env
sudo -u ${username} pm2 start app.js
echo -e "${RED}Reading below information${NOCOLOR}"
echo -e "Installed location: ${YELLOW}$(pwd)/node_deploy${NOCOLOR}"
echo -e "Change configuration: ${YELLOW}$(pwd)/node_deploy/.env${NOCOLOR}"
echo -e "Check pm2: ${GREEN}pm2 list${NOCOLOR} more detail ${YELLOW}https://pm2.keymetrics.io/${NOCOLOR}"
