export function isKey(obj: Object, k: PropertyKey): k is keyof typeof obj {
  return obj.hasOwnProperty(k);
}
