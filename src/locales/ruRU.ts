/* eslint-disable no-nested-ternary */
export default {
  plural: (n: number) =>
    n % 10 === 1 && n % 100 !== 11
      ? 0
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)
      ? 1
      : 2,
  messages: {
    '_date': 'DD-MM-YYYY',
    '_time': 'HH:mm:ss',
    '_dateTime': 'DD-MM-YYYY HH:mm:ss',
    'hello world': 'привет мир',
    'dollar': ['доллар', 'доллара', 'долларов'],
    'Confirm': 'Подтвердить',
    'New {{eventName}} events in {{contractAddress}} on {{network}}:':
      'Новое событие {{eventName}} в контракте {{contractAddress}} сети {{network}}:',
    'automate:trigger:contractEvent:name': 'Событие контракта',
    'automate:trigger:contractEvent:description': 'Вызов триггера в ответ на событие в контракте',
    'automate:trigger:everyMonth:name': 'Периодически',
    'automate:trigger:everyMonth:description': 'Вызов триггера каждый месяц',
    'automate:trigger:everyWeek:name': 'Периодически',
    'automate:trigger:everyWeek:description': 'Вызов триггера каждую неделю',
    'automate:trigger:everyDay:name': 'Периодически',
    'automate:trigger:everyDay:description': 'Вызов триггера каждый день',
    'automate:trigger:everyHour:name': 'Периодически',
    'automate:trigger:everyHour:description': 'Вызов триггера каждый час',
  },
};
