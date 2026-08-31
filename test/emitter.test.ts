import { describe, expect, it, vi } from 'vitest';
import { Emitter } from '../src/index.js';

interface Events {
  ping: { n: number };
  pong: { n: number };
}

/** `emit` is protected, so tests drive it through a subclass, as callers would. */
class Bus extends Emitter<Events> {
  send<E extends keyof Events>(event: E, payload: Events[E]): void {
    this.emit(event, payload);
  }
}

describe('Emitter', () => {
  it('delivers payloads to every subscriber of an event', () => {
    const bus = new Bus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('ping', a);
    bus.on('ping', b);
    bus.on('pong', vi.fn());

    bus.send('ping', { n: 1 });

    expect(a).toHaveBeenCalledWith({ n: 1 });
    expect(b).toHaveBeenCalledWith({ n: 1 });
  });

  it('is quiet when nobody is listening', () => {
    expect(() => new Bus().send('ping', { n: 1 })).not.toThrow();
  });

  it('honours once()', () => {
    const bus = new Bus();
    const listener = vi.fn();
    bus.once('ping', listener);

    bus.send('ping', { n: 1 });
    bus.send('ping', { n: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ n: 1 });
  });

  it('lets a listener unsubscribe itself mid-dispatch without skipping others', () => {
    const bus = new Bus();
    const second = vi.fn();
    const off = bus.on('ping', () => off());
    bus.on('ping', second);

    bus.send('ping', { n: 1 });
    bus.send('ping', { n: 2 });

    expect(second).toHaveBeenCalledTimes(2);
  });

  it('removes listeners for one event or all of them', () => {
    const bus = new Bus();
    const ping = vi.fn();
    const pong = vi.fn();
    bus.on('ping', ping);
    bus.on('pong', pong);

    bus.removeAllListeners('ping');
    bus.send('ping', { n: 1 });
    bus.send('pong', { n: 1 });
    expect(ping).not.toHaveBeenCalled();
    expect(pong).toHaveBeenCalledTimes(1);

    bus.removeAllListeners();
    bus.send('pong', { n: 2 });
    expect(pong).toHaveBeenCalledTimes(1);
  });

  it('does not double-register the same listener', () => {
    const bus = new Bus();
    const listener = vi.fn();
    bus.on('ping', listener);
    bus.on('ping', listener);

    bus.send('ping', { n: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
