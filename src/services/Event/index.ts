export interface Listener<T> {
  (event: T): any;
}

export class Emitter<T> {
  private listeners: Set<Listener<T>>;

  constructor(...listeners: Array<Listener<T>>) {
    this.listeners = new Set(listeners);
  }

  on = (listener: Listener<T>) => {
    this.listeners.add(listener);

    return this;
  };

  off = (listener: Listener<T>) => {
    this.listeners.delete(listener);

    return this;
  };

  emit = (event: T) => {
    this.listeners.forEach((listener) => listener(event));

    return this;
  };

  pipe = (te: Emitter<T>) => {
    this.on((e) => te.emit(e));

    return this;
  };
}
