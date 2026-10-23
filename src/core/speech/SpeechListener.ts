/**
 * Continuous speech recognition through the browser's built-in Web Speech API
 * (Chrome, Edge, Safari, Samsung Internet). It is free and needs no API key;
 * the browser vendor's speech service does the recognition.
 *
 * Browsers end a recognition session after silence or a while of talking, so
 * this restarts it for as long as `start()` is in effect. Android Chrome ends
 * one after every phrase, so restarts are constant there: they are hidden
 * from `onListening` unless the next session is slow to come up.
 */

// Minimal typings: lib.dom does not cover the prefixed constructor.
interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [i: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [i: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  /** Recognize on the device only (newer Chrome and Edge). */
  processLocally?: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';
interface LocalOptions {
  langs: string[];
  processLocally: boolean;
}
type RecognitionCtor = (new () => Recognition) & {
  available?(o: LocalOptions): Promise<Availability>;
  install?(o: LocalOptions): Promise<boolean>;
};

/** Whether on-device recognition can run: 'ready', or why not. */
export type OnDeviceStatus = 'ready' | 'unsupported' | 'unavailable' | 'install-failed';

export type SpeechErrorKind = 'not-allowed' | 'no-microphone' | 'network' | 'language' | 'other';

export interface SpeechCallbacks {
  /**
   * One recognition result: alternative transcripts (best first), and the
   * best one's confidence (0..1; 0 when the browser doesn't say).
   */
  onResult(alternatives: string[], final: boolean, confidence: number): void;
  /**
   * Listening started or stopped. The short gap of a restart between sessions
   * is not reported (see `RESTART_GRACE_MS`).
   */
  onListening?(listening: boolean): void;
  /** A new recognition session started; a word said in the gap is lost. */
  onSession?(): void;
  /** A diagnostic line, for the debug log. */
  onInfo?(line: string): void;
  /** A problem restarting will not fix; listening has stopped. */
  onError(kind: SpeechErrorKind, detail: string): void;
}

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** A restart gap shorter than this does not report `onListening(false)`. */
export const RESTART_GRACE_MS = 1500;

export class SpeechListener {
  static supported(): boolean {
    return ctor() !== null;
  }

  /**
   * Gets on-device recognition of `lang` ready, downloading its language
   * pack if needed. Call from a user gesture, which the download may need.
   */
  static async prepareOnDevice(lang: string): Promise<OnDeviceStatus> {
    const Ctor = ctor();
    if (!Ctor?.available || !Ctor.install) return 'unsupported';
    const o = { langs: [lang], processLocally: true };
    try {
      const status = await Ctor.available(o);
      if (status === 'available') return 'ready';
      if (status === 'unavailable') return 'unavailable';
      return (await Ctor.install(o)) ? 'ready' : 'install-failed';
    } catch {
      return 'install-failed';
    }
  }

  private rec: Recognition | null = null;
  private active = false;
  private startedAt = 0;
  private quickEnds = 0;
  private restartTimer = 0;
  private offTimer = 0;
  /** What `onListening` last reported. */
  private listening = false;
  /** A session started since `start()`, so the mic and service work. */
  private worked = false;
  private localReady = false;

  constructor(
    private readonly cb: SpeechCallbacks,
    private readonly lang = 'he-IL',
    /** Recognize on the device instead of the browser vendor's service. */
    private readonly onDevice = false,
  ) {}

  /** Call from a user gesture the first time, so the mic prompt may show. */
  start(): void {
    this.active = true;
    this.quickEnds = 0;
    this.worked = false;
    if (!this.onDevice || this.localReady) return this.session();
    void SpeechListener.prepareOnDevice(this.lang).then((status) => {
      this.cb.onInfo?.(`on-device ${this.lang}: ${status}`);
      if (!this.active) return;
      if (status !== 'ready') return this.fail('language', `on-device recognition ${status}`);
      this.localReady = true;
      this.session();
    });
  }

  stop(): void {
    this.active = false;
    clearTimeout(this.restartTimer);
    clearTimeout(this.offTimer);
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onresult = rec.onerror = rec.onend = rec.onstart = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    }
    this.setListening(false);
  }

  dispose(): void {
    this.stop();
  }

  private session(): void {
    const Ctor = ctor();
    if (!Ctor) return this.fail('other', 'Speech recognition is not supported in this browser');
    const rec = new Ctor();
    this.rec = rec;
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    if (this.onDevice) rec.processLocally = true;
    let heard = false;
    this.startedAt = performance.now(); // until onstart, in case it never comes
    rec.onstart = () => {
      this.startedAt = performance.now();
      this.worked = true;
      clearTimeout(this.offTimer);
      this.cb.onSession?.();
      this.setListening(true);
    };
    rec.onresult = (e) => {
      heard = true;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const alts: string[] = [];
        for (let k = 0; k < r.length; k++) alts.push(r[k].transcript);
        this.cb.onResult(alts, r.isFinal, r.length ? r[0].confidence || 0 : 0);
      }
    };
    rec.onerror = (e) => {
      switch (e.error) {
        case 'no-speech':
        case 'aborted':
          return; // onend follows and restarts
        case 'not-allowed':
        case 'service-not-allowed':
          return this.fail('not-allowed', e.error);
        case 'audio-capture':
        case 'network':
          // Mid-game these are usually passing (the mic not yet released by
          // the last session, a network blip): onend retries with backoff.
          if (this.worked) return;
          return this.fail(e.error === 'network' ? 'network' : 'no-microphone', e.error);
        case 'language-not-supported':
          return this.fail('language', e.error);
        default:
          console.warn('speech recognition error', e.error, e.message);
      }
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      this.rec = null;
      if (!this.active) return this.setListening(false);
      clearTimeout(this.offTimer);
      this.offTimer = window.setTimeout(() => this.setListening(false), RESTART_GRACE_MS);
      // Sessions that die right away with nothing heard usually mean a lasting
      // problem; back off. (Android ends a session after each phrase, which
      // can be quick, but it heard something.)
      this.quickEnds = !heard && performance.now() - this.startedAt < 1000 ? this.quickEnds + 1 : 0;
      if (this.quickEnds > 8) return this.fail('other', 'Speech recognition keeps stopping');
      this.restartTimer = window.setTimeout(() => this.active && this.session(), Math.min(1000, 60 * this.quickEnds));
    };
    try {
      rec.start();
    } catch (err) {
      this.fail('other', String(err));
    }
  }

  private setListening(on: boolean): void {
    if (on === this.listening) return;
    this.listening = on;
    this.cb.onListening?.(on);
  }

  private fail(kind: SpeechErrorKind, detail: string): void {
    this.stop();
    this.cb.onError(kind, detail);
  }
}
