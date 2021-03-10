#!/bin/bash
# This is just a quick shell script to bootstrap development environment

# Function to check whether command exists or not
exists()
{
  if command -v $1 &>/dev/null
  then
    return 0
  else
    return 1
    fi
}

if exists ganache-cli
  then echo "Ganache found"
  else echo "Ganache not found, exiting"
  exit
fi

if exists truffle
  then echo "Truffle found"
  else echo "Truffle not found, exiting"
  exit
fi


INITIAL_SETUP=false
if [[ ! -z $1 ]] ; then
  if [ $1 = "-s" ] ; then
    INITIAL_SETUP=true
  fi
fi

if $INITIAL_SETUP ; then
  echo "Running Initial Setup"
  echo "Gen environment file"
  cp .env.dist .env
  npm i
fi

source .env
echo "Current instances of Ganache (if any)"
ps aux | grep ganache
echo "Killing current instances of Ganache (if any)"
kill `ps -ef | grep ganache| awk '/[g]anache/{print $2}'` > /dev/null 2>&1
ps aux | grep ganache
echo "Starting ganache"
nohup ganache-cli up -d -m $MNEMONIC >/dev/null 2>&1 &

## Build and compile contracts
truffle build

## Deploy contracts
truffle migrate