#!/usr/bin/env node

const argv = require('minimist')(process.argv.slice(2))
const tape = require('tape')
const testing = require('ethereumjs-testing')
const { getRequiredForkConfigAlias } = require('./util')
const FORK_CONFIG = (argv.fork || 'Istanbul')
const FORK_CONFIG_TEST_SUITE = getRequiredForkConfigAlias(FORK_CONFIG)
// Istanbul -> istanbul, MuirGlacier -> muirGlacier
const FORK_CONFIG_VM = FORK_CONFIG.charAt(0).toLowerCase() + FORK_CONFIG.substring(1)
// tests which should be fixed
const skipBroken = [
  'dynamicAccountOverwriteEmpty', // temporary till fixed (2019-01-30), skipped along constantinopleFix work time constraints
]
// tests skipped due to system specifics / design considerations
const skipPermanent = [
  'SuicidesMixingCoinbase', // sucides to the coinbase, since we run a blockLevel we create coinbase account.
  'static_SuicidesMixingCoinbase', // sucides to the coinbase, since we run a blockLevel we create coinbase account.
  'ForkUncle', // Only BlockchainTest, correct behaviour unspecified (?)
  'UncleFromSideChain', // Only BlockchainTest, same as ForkUncle, the TD is the same for two diffent branches so its not clear which one should be the finally chain
]
// tests running slow (run from time to time)
const skipSlow = [
  'Call50000', // slow
  'Call50000_ecrec', // slow
  'Call50000_identity', // slow
  'Call50000_identity2', // slow
  'Call50000_sha256', // slow
  'Call50000_rip160', // slow
  'Call50000bytesContract50_1', // slow
  'Call50000bytesContract50_2',
  'Call1MB1024Calldepth', // slow
  'static_Call1MB1024Calldepth', // slow
  'static_Call50000', // slow
  'static_Call50000_ecrec',
  'static_Call50000_identity',
  'static_Call50000_identity2',
  'static_Call50000_rip160',
  'static_Return50000_2',
  'Callcode50000', // slow
  'Return50000', // slow
  'Return50000_2', // slow
  'static_Call50000', // slow
  'static_Call50000_ecrec', // slow
  'static_Call50000_identity', // slow
  'static_Call50000_identity2', // slow
  'static_Call50000_sha256', // slow
  'static_Call50000_rip160', // slow
  'static_Call50000bytesContract50_1', // slow
  'static_Call50000bytesContract50_2',
  'static_Call1MB1024Calldepth', // slow
  'static_Callcode50000', // slow
  'static_Return50000', // slow
  'static_Return50000_2', // slow
  'QuadraticComplexitySolidity_CallDataCopy',
  'CALLBlake2f_MaxRounds',
  'randomStatetest94_Istanbul',
]

/*
NOTE: VM tests have been disabled since they are generated using Frontier gas costs, and ethereumjs-vm doesn't support historical fork rules

TODO: some VM tests do not appear to be executing (don't print an "ok" statement):
...
# file: vmLogTest test: log0_emptyMem
ok 38984 valid gas usage
# file: vmLogTest test: log0_logMemStartTooHigh
# file: vmLogTest test: log0_logMemsizeTooHigh
# file: vmLogTest test: log0_logMemsizeZero
ok 38985 valid gas usage
# file: vmLogTest test: log0_nonEmptyMem
*/

const skipVM = [
  // slow performance tests
  'loop-mul',
  'loop-add-10M',
  'loop-divadd-10M',
  'loop-divadd-unr100-10M',
  'loop-exp-16b-100k',
  'loop-exp-1b-1M',
  'loop-exp-2b-100k',
  'loop-exp-32b-100k',
  'loop-exp-4b-100k',
  'loop-exp-8b-100k',
  'loop-exp-nop-1M',
  'loop-mulmod-2M',
  // some VM tests fail because the js runner executes CALLs
  // see https://github.com/ethereum/tests/wiki/VM-Tests  > Since these tests are meant only as a basic test of VM operation, the CALL and CREATE instructions are not actually executed.
  'ABAcalls0',
  'ABAcallsSuicide0',
  'ABAcallsSuicide1',
  'sha3_bigSize',
  'CallRecursiveBomb0',
  'CallToNameRegistrator0',
  'CallToPrecompiledContract',
  'CallToReturn1',
  'PostToNameRegistrator0',
  'PostToReturn1',
  'callcodeToNameRegistrator0',
  'callcodeToReturn1',
  'callstatelessToNameRegistrator0',
  'callstatelessToReturn1',
  'createNameRegistrator',
  'randomTest643', // TODO fix this
]

if (argv.state) {
  runTests('GeneralStateTests', argv)
} else if (argv.blockchain) {
  runTests('BlockchainTests', argv)
} else if (argv.vm) {
  runTests('VMTests', argv)
}

function getSkipTests(choices, defaultChoice) {
  let skipTests = []
  if (!choices) {
    choices = defaultChoice
  }
  choices = choices.toLowerCase()
  if (choices !== 'none') {
    let choicesList = choices.split(',')
    let all = choicesList.includes('all')
    if (all || choicesList.includes('broken')) {
      skipTests = skipTests.concat(skipBroken)
    }
    if (all || choicesList.includes('permanent')) {
      skipTests = skipTests.concat(skipPermanent)
    }
    if (all || choicesList.includes('slow')) {
      skipTests = skipTests.concat(skipSlow)
    }
  }
  return skipTests
}

function runTests(name, runnerArgs, cb) {
  let testGetterArgs = {}

  testGetterArgs.skipTests = getSkipTests(argv.skip, argv.runSkipped ? 'NONE' : 'ALL')
  testGetterArgs.runSkipped = getSkipTests(argv.runSkipped, 'NONE')
  testGetterArgs.skipVM = skipVM
  testGetterArgs.forkConfig = FORK_CONFIG_TEST_SUITE
  testGetterArgs.file = argv.file
  testGetterArgs.test = argv.test
  testGetterArgs.dir = argv.dir
  testGetterArgs.excludeDir = argv.excludeDir
  testGetterArgs.testsPath = argv.testsPath

  testGetterArgs.customStateTest = argv.customStateTest

  runnerArgs.forkConfigVM = FORK_CONFIG_VM
  runnerArgs.forkConfigTestSuite = FORK_CONFIG_TEST_SUITE
  runnerArgs.jsontrace = argv.jsontrace
  runnerArgs.debug = argv.debug // for BlockchainTests

  // for GeneralStateTests
  runnerArgs.data = argv.data
  runnerArgs.gasLimit = argv.gas
  runnerArgs.value = argv.value

  // runnerArgs.vmtrace = true; // for VMTests

  if (argv.customStateTest) {
    const stateTestRunner = require('./GeneralStateTestsRunner.js')
    let fileName = argv.customStateTest
    tape(name, t => {
      testing.getTestFromSource(fileName, (err, test) => {
        if (err) {
          return t.fail(err)
        }

        t.comment(`file: ${fileName} test: ${test.testName}`)
        stateTestRunner(runnerArgs, test, t, () => {
          t.end()
        })
      })
    })
  } else {
    tape(name, t => {
      const runner = require(`./${name}Runner.js`)
      // Tests for HFs before Istanbul have been moved under `LegacyTests/Constantinople`:
      // https://github.com/ethereum/tests/releases/tag/v7.0.0-beta.1
      if (testGetterArgs.forkConfig !== 'Istanbul') {
        name = 'LegacyTests/Constantinople/'.concat(name)
      }
      testing
        .getTestsFromArgs(
          name,
          (fileName, testName, test) => {
            return new Promise((resolve, reject) => {
              if (name === 'VMTests') {
                // suppress some output of VMTests
                // t.comment(`file: ${fileName} test: ${testName}`)
                test.fileName = fileName
                test.testName = testName
                runner(runnerArgs, test, t, resolve)
              } else {
                let runSkipped = testGetterArgs.runSkipped
                let inRunSkipped = runSkipped.includes(fileName)
                if (runSkipped.length === 0 || inRunSkipped) {
                  t.comment(`file: ${fileName} test: ${testName}`)
                  runner(runnerArgs, test, t, resolve)
                } else {
                  resolve()
                }
              }
            }).catch(err => console.log(err))
          },
          testGetterArgs,
        )
        .then(() => {
          t.end()
        })
    })
  }
}
