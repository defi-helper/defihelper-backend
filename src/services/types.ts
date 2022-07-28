export function isKey<T>(obj: T, k: PropertyKey): k is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, k);
}
