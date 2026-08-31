/**
 * A ~30-line typed event emitter.
 *
 * Node's `EventEmitter` would work, but pulling it in would make the package
 * Node-only and untyped at the payload level. Carbo should run in a browser tab
 * just as happily as in a terminal.
 *
 * @typeParam Events - Map of event name to payload type. Left unconstrained on
 * purpose: an `interface` has no implicit index signature, so a
 * `Record<string, unknown>` bound would reject the very interfaces callers
 * naturally write.
 */
export class Emitter<Events> {
  #listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  /** Subscribe. Returns an unsubscribe function. */
  on<E extends keyof Events>(event: E, listener: (payload: Events[E]) => void): () => void {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(listener as (payload: never) => void);
    return () => this.off(event, listener);
  }

  /** Subscribe until the first delivery. Returns an unsubscribe function. */
  once<E extends keyof Events>(event: E, listener: (payload: Events[E]) => void): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<E extends keyof Events>(event: E, listener: (payload: Events[E]) => void): void {
    this.#listeners.get(event)?.delete(listener as (payload: never) => void);
  }

  /** Remove every listener, for one event or all of them. */
  removeAllListeners(event?: keyof Events): void {
    if (event === undefined) this.#listeners.clear();
    else this.#listeners.delete(event);
  }

  protected emit<E extends keyof Events>(event: E, payload: Events[E]): void {
    // Copy first: a listener is allowed to unsubscribe itself mid-dispatch.
    const listeners = this.#listeners.get(event);
    if (!listeners) return;
    for (const listener of [...listeners]) {
      (listener as (payload: Events[E]) => void)(payload);
    }
  }
}
