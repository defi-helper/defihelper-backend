export default {
  plural: (n: number) =>
    n % 10 == 1 && n % 100 != 11
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
  },
};
