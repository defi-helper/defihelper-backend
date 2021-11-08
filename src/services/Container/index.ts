export type Factory<T> = () => T;

export type ParametricFactory<T, P> = (params: P) => T;

export function singleton<T>(f: Factory<T>): Factory<T> {
  let instance: T;

  return () => {
    if (instance === undefined) instance = f();
    return instance;
  };
}

export function singletonParametric<T, P>(f: ParametricFactory<T, P>) {
  const instances = new Map<P, T>();

  return (k: P) => {
    if (!instances.has(k)) instances.set(k, f(k));

    return instances.get(k) as T;
  };
}

export class Container<T extends Object> {
  constructor(public readonly parent: T) {}
}
