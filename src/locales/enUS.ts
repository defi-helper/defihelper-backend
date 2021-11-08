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
    'automate:condition:ethereumAvgGasPrice:paramsDescription':
      'AVG gas price for network {{network}} in {{tolerance}}',
    'automate:condition:ethereumBalance:paramsDescription':
      'Wallet balance {{wallet}} in network {{network}} {{op}} {{value}}',
    'automate:condition:ethereumOptimalAutomateRun:paramsDescription':
      'Restake optimal run for {{id}}',
    'automate:condition:schedule:paramsDescription':
      'Days of week {{weeks}}; Months {{months}}; Days of month {{days}}; Hours {{hours}}',
    'automate:action:notification:paramsDescription': 'Send notification to {{contactId}}',
    'automate:action:ethereumAutomateRun:paramsDescription': 'Run automate {{id}}',
  },
};
