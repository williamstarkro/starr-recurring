const chalk = require('chalk');

const testJSFormat = require('./test-js-format');
const testSolidityFormat = require('./test-solidity-format');
const testContracts = require('./test-contracts');

const start = async () => {
  try {
    console.log(chalk`\n{bold.hex('#c63197') ⬢  Testing JS Formatting }`);
    await testJSFormat();

    console.log(chalk`\n{bold.hex('#c63197') ⬢  Testing Solidity Formatting }`);
    await testSolidityFormat();

    console.log(chalk`\n{bold.hex('#1a82ff') ⬢  Testing Smart Contracts }`);
    await testContracts();

    console.log(chalk`\n{bold ✅  Tests passed. :) }\n`);
    process.exit();
  } catch(error) {
    console.log(chalk`\n{bold ⚠️  Tests failed. :( }\n`);
    console.error(error);
    process.exit(1);
  }
};

start();
