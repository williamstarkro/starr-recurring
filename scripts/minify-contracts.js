/**
 * It's currently not possible to configure the contract JSON outputted by
 * Truffle. This script re-writes the contract JSON, pulling out only the
 * pieces needed by origin-js and significantly reducing the overall bundle
 * size
 */

const fs = require('fs');
const path = require('path');
const solc = require('solc');
const cmdArgs = require('command-line-args');

const walk = (dir, limit) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((f) => {
    const file = `${dir}/${f}`;
    const stat = fs.statSync(file);
    if(stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = results.concat(walk(file, limit));
    } else {
      /* Is a file */
      results.push(file);
    }
  });
  return results;
};

const saveFile = (filename, data) => {
  fs.writeFile(filename, data, (err) => {
    if(err) {
      console.log(err);
    }
  });
};

const compileContracts = (options) => {
  const contractsDir = path.join(__dirname, '../', 'contracts');
  const baseOutput = path.join(__dirname, '../', 'build');
  const defaultOutput = path.join(__dirname, '../', 'build/contracts');

  if(!fs.existsSync(baseOutput)) {
    fs.mkdirSync(baseOutput);
    fs.mkdirSync(defaultOutput);
  }

  const cmdOptions = [
    { name: 'abi', alias: 'a', type: Boolean },
    { name: 'bytecode', alias: 'b', type: Boolean },
    { name: 'contractFolder', type: String, defaultValue: contractsDir },
    { name: 'contracts', alias: 'c', type: String, multiple: true, defaultValue: false },
    { name: 'output', alias: 'o', type: String, defaultValue: defaultOutput },
  ];
  options = cmdArgs(cmdOptions);

  const results = walk(contractsDir, options.contracts);

  results.forEach((file) => {
    const solFile = fs.readFileSync(file).toString();

    const input = {
      language: 'Solidity',
      sources: {
        [file]: {
          content: solFile,
        },
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['*'],
          },
        },
      },
    };
    function findImports(importPath, sourcePath) {
      try {
        const filePath = path.resolve(sourcePath, importPath);
        return { contents: fs.readFileSync(filePath).toString() };
      } catch(errors) {
        return { error: e.message };
      }
    }
    const compiledContract = solc.compile(JSON.stringify(input), findImports);
    let compiledJson = JSON.parse(compiledContract);
    if(typeof compiledJson.errors !== 'undefined') {
      const error = compiledJson.errors;
      console.log(error);
      process.exit();
    }

    compiledJson = compiledJson.contracts[file];

    const contractName = Object.keys(compiledJson)[0];
    const compiledOutput = compiledJson[contractName];

    const result = {};
    result.abi = compiledOutput.abi;
    result.bytecode = compiledOutput.evm.bytecode.object;

    const outputFile = `${path.basename(file.split('.')[0])}.json`;
    console.log(outputFile);

    saveFile(path.join(options.output, outputFile), JSON.stringify(result, null, 4));
  });
};
if(require.main === module) {
  const contractsDir = path.join(__dirname, '../', 'contracts');
  const defaultOutput = `${__dirname}/../build/contracts`;

  const cmdOptions = [
    { name: 'abi', alias: 'a', type: Boolean },
    { name: 'bytecode', alias: 'b', type: Boolean },
    { name: 'contractFolder', type: String, defaultValue: contractsDir },
    { name: 'contracts', alias: 'c', type: String, multiple: true, defaultValue: false },
    { name: 'output', alias: 'o', type: String, defaultValue: defaultOutput },
  ];
  const options = cmdArgs(cmdOptions);

  compileContracts(options);
}

module.exports = compileContracts;
