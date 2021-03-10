const { spawn } = require('child_process');
const Web3 = require('web3');
const minifyContracts = require('./minify-contracts');

const testContracts = () => {
  return new Promise((resolve, reject) => {
    web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8550"));
    minifyContracts();

    const args = [
      '-r',
      '@babel/register',
      '-t',
      '20000',
      '--exit',
      'test',
    ];
    const jsTest = spawn('./node_modules/.bin/mocha', args, {
      stdio: 'inherit',
      env: process.env,
    });
    jsTest.on('exit', (code) => {
      if(code === 0) {
        resolve();
      } else {
        reject(new Error('Contract tests failed'));
      }
    });
  });
};

module.exports = testContracts;
