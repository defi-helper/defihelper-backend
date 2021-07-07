export default {
  plural: (n: number) => (n === 1 ? 0 : 1),
  messages: {
    '_date': 'MMM DD YYYY',
    '_time': 'HH:mm:ss',
    '_dateTime': 'MMM DD YYYY HH:mm:ss',
    'hello world': 'hello world',
    'dollar': ['dollar', 'dollars'],
  },
};
