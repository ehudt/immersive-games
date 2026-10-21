/**
 * Continuous speech recognition through the browser's built-in Web Speech API
 * (Chrome, Edge, Safari, Samsung Internet). It is free and needs no API key;
 * the browser vendor's speech service does the recognition.
 *
 * Browsers end a recognition session after silence or a while of talking, so
 * this restarts it for as long as `start()` is in effect.
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
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

export type SpeechErrorKind = 'not-allowed' | 'no-microphone' | 'network' | 'language' | 'other';

export interface SpeechCallbacks {
  /**
   * One recognition result: alternative transcripts (best first), and the
   * best one's confidence (0..1; 0 when the browser doesn't say).
   */
  onResult(alternatives: string[], final: boolean, confidence: number): void;
  /** Recognition is (re)listening — a new session — or stopped between sessions. */
  onListening?(listening: boolean): void;
  /** A problem restarting will not fix; listening has stopped. */
  onError(kind: SpeechErrorKind, detail: string): void;
}

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class SpeechListener {
  static supported(): boolean {
    return ctor() !== null;
  }

  private rec: Recognition | null = null;
  private active = false;
  private startedAt = 0;
  private quickEnds = 0;
  private restartTimer = 0;

  constructor(
    private readonly cb: SpeechCallbacks,
    private readonly lang = 'he-IL',
  ) {}

  /** Call from a user gesture the first time, so the mic prompt may show. */
  start(): void {
    this.active = true;
    this.quickEnds = 0;
    this.session();
  }

  stop(): void {
    this.active = false;
    clearTimeout(this.restartTimer);
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
    this.cb.onListening?.(false);
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
    rec.onstart = () => {
      this.startedAt = performance.now();
      this.cb.onListening?.(true);
    };
    rec.onresult = (e) => {
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
          return this.fail('no-microphone', e.error);
        case 'network':
          return this.fail('network', e.error);
        case 'language-not-supported':
          return this.fail('language', e.error);
        default:
          console.warn('speech recognition error', e.error, e.message);
      }
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      this.rec = null;
      this.cb.onListening?.(false);
      if (!this.active) return;
      // Sessions that die right away usually mean a lasting problem; back off.
      this.quickEnds = performance.now() - this.startedAt < 1000 ? this.quickEnds + 1 : 0;
      if (this.quickEnds > 8) return this.fail('other', 'Speech recognition keeps stopping');
      this.restartTimer = window.setTimeout(() => this.active && this.session(), Math.min(1000, 60 * this.quickEnds));
    };
    try {
      rec.start();
    } catch (err) {
      this.fail('other', String(err));
    }
  }

  private fail(kind: SpeechErrorKind, detail: string): void {
    this.stop();
    this.cb.onError(kind, detail);
  }
}
