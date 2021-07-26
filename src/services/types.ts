export function isKey(obj: {}, k: PropertyKey): k is keyof typeof obj {
  return Object.prototype.hasOwnProperty.call(obj, k);
}
