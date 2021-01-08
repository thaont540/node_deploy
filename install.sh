#!/bin/bash
# run by Laravel deploy user
NOCOLOR='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
LIGHTGRAY='\033[0;37m'
YELLOW='\033[1;33m'
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
declare -r BSC_ERROR_CHECK_BIN=107
declare -r _BSC_LOG_LEVEL_ERROR=4
declare -r _BSC_LOG_LEVEL_INFO=1
declare -r _BSC_LOG_LEVEL_WARNING=3
function show_message() {
  local _level="$1" _message="$2" _newLine="${3:-1}" _exitCode="${4:--1}"
  [ "$( echo "$_newLine" |grep -ce "^[0-9]$" )" -ne 1 ] && _newLine="1"
  [ "$( echo "$_exitCode" |grep -ce "^-*[0-9][0-9]*$" )" -ne 1 ] && _exitCode="-1"
  _messagePrefix=""
  [ "$_level" = "$_BSC_LOG_LEVEL_INFO" ] && _messagePrefix="INFO: "
  [ "$_level" = "$_BSC_LOG_LEVEL_WARNING" ] && _messagePrefix="\E[31m\E[4mWARNING\E[0m: "
  [ "$_level" = "$_BSC_LOG_LEVEL_ERROR" ] && _messagePrefix="\E[31m\E[4mERROR\E[0m: "
  [ "$_newLine" -eq 0 ] && printMessageEnd="" || printMessageEnd="\n"
  _timestamp=$( date +"%Y-%d-%m %H:%M.%S" )
  if [ "$BSC_LOG_CONSOLE_OFF" -eq 0 ]; then
    printf "%-17s %-15s $_messagePrefix%b$printMessageEnd" "$_timestamp" "[$BSC_CATEGORY]" "$_message"
  else
    printf "%-17s %-15s $_messagePrefix%b$printMessageEnd" "$_timestamp" "[$BSC_CATEGORY]" "$_message" >> "$BSC_LOG_FILE"
  fi
  [ "$_exitCode" -eq -1 ] && return 0
  [ "$BSC_ERROR_MESSAGE_EXITS_SCRIPT" -eq 0 ] && return "$_exitCode"
  exit "$_exitCode"
}
function error_message() {
  show_message $_BSC_LOG_LEVEL_ERROR "$1" 1 "${2:-$BSC_ERROR_DEFAULT}" >&2
}
function check_command() {
  local _binary="$1"
  command -v "$_binary" >/dev/null 2>&1 && return 0
  error_message "Unable to find binary '$_binary'." $BSC_ERROR_CHECK_BIN
  return $BSC_ERROR_CHECK_BIN
}
function check_empty_directory()
{
  local _dir="${1:-}"
  [[ -n "$_dir" && -d "$_dir" && "$( find "$_dir" -maxdepth 0 2>/dev/null|wc -l )" -eq 1 ]]
}
BSC_ERROR_MESSAGE_EXITS_SCRIPT=${BSC_ERROR_MESSAGE_EXITS_SCRIPT:-1}
BSC_VERBOSE=${BSC_VERBOSE:-$BSC_DEBUG_UTILITIES}
BSC_LOG_CONSOLE_OFF=${BSC_LOG_CONSOLE_OFF:-0}
BSC_CATEGORY=${BSC_CATEGORY:-general}
BSC_LOG_FILE=${BSC_LOG_FILE:-$_BSC_DEFAULT_LOG_FILE}

check_command git || error_message
check_command node || error_message
check_command npm || error_message
check_command pm2 || error_message
! check_empty_directory "$(pwd)/node_deploy" || rm -r "$(pwd)/node_deploy"
git clone https://github.com/thaont540/node_deploy.git
cd "$(pwd)/node_deploy" && npm install
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
pm2 start app.js
echo -e "${RED}Reading below information${NOCOLOR}"
echo -e "Installed location: ${YELLOW}$(pwd)/node_deploy${NOCOLOR}"
echo -e "Change configuration: ${YELLOW}$(pwd)/node_deploy/.env${NOCOLOR}"
echo -e "Check pm2: ${GREEN}pm2 list${NOCOLOR} more detail ${YELLOW}https://pm2.keymetrics.io/${NOCOLOR}"
