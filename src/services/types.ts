export function isKey<T>(obj: T, k: PropertyKey): k is keyof typeof obj {
  return Object.prototype.hasOwnProperty.call(obj, k);
}
