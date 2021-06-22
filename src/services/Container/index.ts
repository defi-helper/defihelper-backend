export type Factory<T> = () => T;

export type ParametricFactory<T, P> = (params: P) => T;

export function singleton<T>(f: Factory<T>): Factory<T> {
  let instance: T;

  return () => {
    if (instance === undefined) instance = f();
    return instance;
  };
}

export class Container<T extends Object> {
  constructor(public readonly parent: T) {}
}
