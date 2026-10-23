import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESTART_GRACE_MS, SpeechListener } from './SpeechListener';

/** A stand-in for the browser recognizer; tests drive its events. */
class FakeRec {
  static all: FakeRec[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  processLocally = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRec.all.push(this);
  }
  start(): void {}
  abort(): void {}
  say(text: string, final = true): void {
    const r = Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal: final });
    this.onresult?.({ resultIndex: 0, results: [r] });
  }
}

/** On-device language-pack state the fake browser reports. */
let pack: 'unavailable' | 'downloadable' | 'available' = 'available';
let installs = 0;
Object.assign(FakeRec, {
  available: async () => pack,
  install: async () => {
    installs++;
    pack = 'available';
    return true;
  },
});

const last = () => FakeRec.all[FakeRec.all.length - 1];

function setup() {
  const events: string[] = [];
  const errors: string[] = [];
  const listener = new SpeechListener({
    onResult: (alts) => events.push(`heard ${alts[0]}`),
    onListening: (on) => events.push(on ? 'on' : 'off'),
    onSession: () => events.push('session'),
    onError: (kind) => errors.push(kind),
  });
  return { listener, events, errors };
}

describe('SpeechListener', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    FakeRec.all = [];
    vi.stubGlobal('window', { webkitSpeechRecognition: FakeRec, setTimeout, clearTimeout });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('hides quick restarts between sessions (Android ends one per phrase)', () => {
    const { listener, events } = setup();
    listener.start();
    last().onstart!();
    for (let i = 1; i <= 5; i++) {
      vi.advanceTimersByTime(400);
      last().say(String(i));
      last().onend!();
      vi.advanceTimersByTime(100);
      last().onstart!();
    }
    expect(events.filter((e) => e === 'on' || e === 'off')).toEqual(['on']);
    expect(events.filter((e) => e === 'session')).toHaveLength(6);
    expect(FakeRec.all).toHaveLength(6);
  });

  it('reports a slow restart as not listening', () => {
    const { listener, events } = setup();
    listener.start();
    last().onstart!();
    vi.advanceTimersByTime(3000);
    last().onend!();
    vi.advanceTimersByTime(RESTART_GRACE_MS + 10);
    expect(events).toEqual(['session', 'on', 'off']);
    last().onstart!();
    expect(events).toEqual(['session', 'on', 'off', 'session', 'on']);
  });

  it('keeps going through many short sessions that heard something', () => {
    const { listener, errors } = setup();
    listener.start();
    for (let i = 1; i <= 30; i++) {
      last().onstart!();
      vi.advanceTimersByTime(300);
      last().say(String(i));
      last().onend!();
      vi.runOnlyPendingTimers();
    }
    expect(errors).toEqual([]);
  });

  it('retries a mic or network blip after listening worked', () => {
    const { listener, errors } = setup();
    listener.start();
    last().onstart!();
    vi.advanceTimersByTime(3000);
    last().onend!();
    vi.runOnlyPendingTimers();
    last().onerror!({ error: 'audio-capture' });
    last().onend!();
    vi.runOnlyPendingTimers();
    last().onstart!();
    expect(errors).toEqual([]);
  });

  it('gives up on a mic that never works', () => {
    const { listener, errors } = setup();
    listener.start();
    last().onerror!({ error: 'audio-capture' });
    expect(errors).toEqual(['no-microphone']);
  });

  it('gives up when sessions keep dying at once without hearing anything', () => {
    const { listener, errors } = setup();
    listener.start();
    for (let i = 0; i < 20 && !errors.length; i++) {
      last().onend!();
      vi.advanceTimersByTime(1000); // the restart backoff, at most 1 s
    }
    expect(errors).toEqual(['other']);
  });

  it('reports off at once on stop', () => {
    const { listener, events } = setup();
    listener.start();
    last().onstart!();
    listener.stop();
    expect(events).toEqual(['session', 'on', 'off']);
  });

  describe('on device', () => {
    const flush = () => vi.advanceTimersByTimeAsync(0);

    it('downloads the language pack, then recognizes locally', async () => {
      pack = 'downloadable';
      installs = 0;
      const lines: string[] = [];
      const listener = new SpeechListener(
        { onResult() {}, onError() {}, onInfo: (l) => lines.push(l) },
        'he-IL',
        true,
      );
      listener.start();
      expect(FakeRec.all).toHaveLength(0);
      await flush();
      expect(installs).toBe(1);
      expect(lines).toEqual(['on-device he-IL: ready']);
      expect(last().processLocally).toBe(true);
    });

    it('reports a language it cannot recognize locally', async () => {
      pack = 'unavailable';
      const errors: string[] = [];
      new SpeechListener({ onResult() {}, onError: (k) => errors.push(k) }, 'he-IL', true).start();
      await flush();
      expect(errors).toEqual(['language']);
      expect(FakeRec.all).toHaveLength(0);
    });

    it('leaves the default mode alone', () => {
      setup().listener.start();
      expect(last().processLocally).toBe(false);
    });
  });
});
