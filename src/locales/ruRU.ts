/* eslint-disable no-nested-ternary, no-template-curly-in-string */
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
    'Any questions? Drop us a reply!': 'Остались вопросы? Отправьте их в ответ на это письмо!',
    'DeFiHelper team': 'Команда DeFiHelper',
    'Your Telegram account ({{username}}) has been successfully connected to your DeFiHelper account.':
      'Ваш Telegram аккаунт ({{username}}) успешно привязан к вашему DefiHelper аккаунту.',
    'We are excited to see you join the DeFiHelper community!':
      'Мы рады видеть тебя в рядах сообщества DeFiHelper!',
    'Please confirm your E-Mail address <b>{{email}}</b> by clicking on the following link:':
      'Пожалуйста, подтвердите свой E-Mail адрес <b>{{email}}</b>, нажатием на ссылку ниже:',
    'New {{eventName}} events in {{contractAddress}} on {{network}}:':
      'Новое событие {{eventName}} в контракте {{contractAddress}} сети {{network}}:',
    'Your portfolio: total stacked ${{totalStackedUSD}}, total earned ${{totalEarnedUSD}}':
      'Ваше портфолио\nВсего застейкано: {{totalStackedUSD}}$, всего заработано: {{totalEarnedUSD}}$',
    'Your automate on wallet {{visualizedWalletAddress}} may be paused in short while due to insufficient funds':
      'Внимание, ваша автоматизация на кошельке {{visualizedWalletAddress}} скоро будет приостановлена ввиду нехватки средств',
    "DeFiHelper's public beta now available. Get your APY boost right now on https://app.defihelper.io!":
      'Стартовало публичное тестирование DeFiHelper. Посмотрите сейчас на https://app.defihelper.io!',
    'Tracked Balance ${{totalNetWorth}}, Total unclaimed ${{totalEarnedUSD}}':
      'Отслеживаемый баланс: {{totalNetWorth}}$, можно забрать: {{totalEarnedUSD}}$',
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
    'automate:action:skipReason:notAvailableNotification': 'Недостаточно нотификаций',
    'automate:action:skipReason:lowFeeFunds': 'Недостаточно средств на балансе',
    'automate:action:notification:paramsDescription':
      'Отправить уведомление в контакт {{contactId}}',
    'automate:action:ethereumAutomateRun:paramsDescription': 'Запуск автоматизации {{id}}',
    'automate:condition:ethereumBalance:name': 'Token balance',
    'automate:condition:ethereumBalance:description': 'Check the token balance with condition',
    'automate:condition:ethereumBalance:paramsDescription':
      'Баланс кошелька {{wallet}} в сети {{network}} {{op}} {{value}}',
    'automate:condition:ethereumOptimalAutomateRun:name': 'Autostake',
    'automate:condition:ethereumOptimalAutomateRun:description':
      'Use autostake feature with our own math',
    'automate:action:ethereumOptimalAutomateRun:paramsDescription':
      'Оптимальный вызов рестейк контракта для {{id}}',
    'automate:condition:ethereumAvgGasPrice:name': 'Average GAS price',
    'automate:condition:ethereumAvgGasPrice:description':
      'Check the average GAS price with historical values',
    'automate:condition:ethereumAvgGasPrice:paramsDescription':
      'Отклонение от средней стоимости газа в сети {{network}} в пределах {{tolerance}}',
    'automate:condition:schedule:name': 'Schedule',
    'automate:condition:schedule:description': 'Check the schedule',
    'automate:condition:schedule:paramsDescription':
      'Дни недели {{weeks}}; Месяца {{months}}; Дни месяца {{days}}; Часы {{hours}}',
    'automate:condition:contractMetric:name': 'Метрики контракта',
    'automate:condition:contractMetric:description': 'Текущая метрика контракта',
    'automate:condition:contractMetric:paramsDescription': '{{metric}} {{op}} {{value}}',
  },
};
