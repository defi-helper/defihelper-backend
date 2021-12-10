/* eslint-disable no-template-curly-in-string */
export default {
  plural: (n: number) => (n === 1 ? 0 : 1),
  messages: {
    '_date': 'MMM DD YYYY',
    '_time': 'HH:mm:ss',
    '_dateTime': 'MMM DD YYYY HH:mm:ss',
    'hello world': 'hello world',
    'dollar': ['dollar', 'dollars'],
    'Confirm': 'Confirm',
    'New {{eventName}} events in {{contractAddress}} on {{network}}:':
      'New {{eventName}} events in {{contractAddress}} on {{network}}:',
    'Total Net Worth ${{totalNetWorth}}, Total unclaimed ${{totalEarnedUSD}}':
      'Total Net Worth ${{totalNetWorth}}, Total unclaimed ${{totalEarnedUSD}}',
    'automate:trigger:contractEvent:name': 'Contract event',
    'automate:trigger:contractEvent:description': 'Call trigger for contract event',
    'automate:trigger:everyMonth:name': 'Periodic',
    'automate:trigger:everyMonth:description': 'Call trigger every month',
    'automate:trigger:everyWeek:name': 'Periodic',
    'automate:trigger:everyWeek:description': 'Call trigger every week',
    'automate:trigger:everyDay:name': 'Periodic',
    'automate:trigger:everyDay:description': 'Call trigger every day',
    'automate:trigger:everyHour:name': 'Periodic',
    'automate:trigger:everyHour:description': 'Call trigger every hour',
    'automate:action:notification:paramsDescription': 'Send notification to {{contactId}}',
    'automate:action:ethereumAutomateRun:paramsDescription': 'Run automate {{id}}',
    'automate:condition:ethereumBalance:name': 'Native token balance',
    'automate:condition:ethereumBalance:description':
      'Checks the native (eth,bnb,avax and etc.) token balance',
    'automate:condition:ethereumBalance:paramsDescription':
      'Wallet balance {{wallet}} in network {{network}} {{op}} {{value}}',
    'automate:condition:ethereumOptimalAutomateRun:name': 'Optimal Staking',
    'automate:condition:ethereumOptimalAutomateRun:description': 'Use our Autostaking feature',
    'automate:condition:ethereumOptimalAutomateRun:paramsDescription':
      'Restake optimal run for {{id}}',
    'automate:condition:ethereumAvgGasPrice:name': 'GAS price variation',
    'automate:condition:ethereumAvgGasPrice:description':
      'Check the GAS price with expected values based on time and day',
    'automate:condition:ethereumAvgGasPrice:paramsDescription':
      'AVG gas price for network {{network}} in {{tolerance}}',
    'automate:condition:schedule:name': 'Schedule',
    'automate:condition:schedule:description':
      'Choose a specific timeframe to launch the automations',
    'automate:condition:schedule:paramsDescription':
      'Days of week {{weeks}}; Months {{months}}; Days of month {{days}}; Hours {{hours}}',
    'automate:action:ethereumAutomateRun:name': 'Run transaction',
    'automate:action:ethereumAutomateRun:description': 'Automatically run blockchain transaction',
    'automate:action:notification:name': 'Send notification',
    'automate:action:notification:description': 'Send notification via email or telegram',
  },
};
