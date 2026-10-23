import './counting.css';
import { SpeechListener, type SpeechErrorKind } from '../../core/speech/SpeechListener';
import { CountJudge, patienceMs, type Patience } from './CountJudge';
import { Confetti } from './Confetti';
import { Sky } from './Sky';
import { CountingSfx } from './sounds';

export interface CountingOptions {
  debug: boolean;
  /** Recognize speech on the device (`?speech=device`), for testing. */
  onDevice?: boolean;
  onExit(): void;
}

type Phase = 'intro' | 'playing' | 'over';

/** While words are still coming in, wait up to this much past the patience limit. */
const SPEAKING_GRACE_MS = 6000;
/** Speech heard this recently means the child is still talking. */
const SPEAKING_MS = 1500;
const BEST_KEY = 'counting.best';
const PATIENCE_KEY = 'counting.patience';

const PATIENCE_LABELS: [Patience, string][] = [
  ['normal', 'רגיל'],
  ['long', 'ארוך'],
  ['xlong', 'ארוך מאוד'],
];

const PRAISE = ['כל הכבוד!', 'מעולה!', 'וואו!', 'איזה יופי!', 'מדהים!', 'אלופים!', 'יש!', 'סחתיין!'];

const ERRORS: Record<SpeechErrorKind, string> = {
  'not-allowed': 'צריך לאשר למשחק להשתמש במיקרופון. לחצו על סמל המנעול או המיקרופון בשורת הכתובת, אשרו, ונסו שוב.',
  'no-microphone': 'לא מצאנו מיקרופון. חברו מיקרופון ונסו שוב.',
  network: 'זיהוי הדיבור צריך חיבור לאינטרנט. בדקו את החיבור ונסו שוב.',
  language: 'הדפדפן הזה לא מזהה דיבור בעברית. נסו בכרום.',
  other: 'משהו השתבש בזיהוי הדיבור. נסו שוב.',
};

function loadPatience(): Patience {
  try {
    const v = localStorage.getItem(PATIENCE_KEY);
    return PATIENCE_LABELS.some(([p]) => p === v) ? (v as Patience) : 'long';
  } catch {
    return 'long';
  }
}

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(n: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* private mode */
  }
}

/** Title for the end screen, growing with the result. */
function cheerFor(n: number): string {
  if (n >= 100) return 'אלופי העולם!';
  if (n >= 50) return 'פשוט מדהים!';
  if (n >= 20) return 'וואו, איזה יופי!';
  if (n >= 10) return 'כל הכבוד!';
  return 'יופי של ספירה!';
}

/**
 * "סופרים עד השמיים": the child counts out loud in Hebrew, and every correct
 * number lifts a rocket higher. The game never prompts the next number; it
 * ends when a number is skipped or the child stops for a while, with a
 * celebration of how far they got.
 */
export class CountingGame {
  private root: HTMLElement;
  private sky: Sky;
  private fx: Confetti;
  private sfx: CountingSfx | null = null;
  private judge = new CountJudge();
  private listener: SpeechListener | null = null;
  private phase: Phase = 'intro';
  private best = loadBest();
  private patience = loadPatience();
  private lastTick = 0;
  private listening = false;
  private onDevice: boolean;
  private listenerOnDevice = false;
  /** When the clock for the next number started (null until the mic is on). */
  private waitingSince: number | null = null;
  private lastSpeech = 0;
  private ticker = 0;
  private timers: number[] = [];
  private log: string[] = [];
  private ui: Record<'number' | 'praise' | 'listen' | 'panel' | 'best' | 'debug', HTMLElement>;

  constructor(
    parent: HTMLElement,
    private readonly opts: CountingOptions,
  ) {
    this.onDevice = opts.onDevice ?? false;
    this.root = document.createElement('div');
    this.root.className = 'counting';
    this.root.dir = 'rtl';
    this.root.lang = 'he';
    parent.appendChild(this.root);
    this.sky = new Sky(this.root);
    this.root.insertAdjacentHTML(
      'beforeend',
      `<div class="c-top">
         <button class="c-icon" data-act="exit" aria-label="חזרה לתפריט">✕</button>
         <button class="c-icon" data-act="mute" aria-label="השתקה">🔊</button>
         <div class="c-best"></div>
       </div>
       <div class="c-number" aria-live="polite"></div>
       <div class="c-praise"></div>
       <div class="c-listen"><span class="mic">🎤</span><span class="bars"><i></i><i></i><i></i><i></i></span><span class="txt"></span></div>
       <div class="c-panel"></div>
       <div class="c-debug" dir="ltr" lang="en"></div>`,
    );
    this.fx = new Confetti(this.root);
    const q = (s: string) => this.root.querySelector<HTMLElement>(s)!;
    this.ui = {
      number: q('.c-number'),
      praise: q('.c-praise'),
      listen: q('.c-listen'),
      panel: q('.c-panel'),
      best: q('.c-best'),
      debug: q('.c-debug'),
    };
    this.root.querySelector<HTMLElement>('[data-act="exit"]')!.onclick = () => this.opts.onExit();
    this.root.querySelector<HTMLElement>('[data-act="mute"]')!.onclick = (e) => this.toggleMute(e.currentTarget as HTMLElement);
    window.addEventListener('keydown', this.onKey);
    if (opts.debug) this.setupDebug();
    this.showBest();
  }

  start(): void {
    this.showIntro();
  }

  /** Feed a transcript as if the recognizer heard it (debug / tests). */
  hear(text: string, final = true): void {
    if (this.phase !== 'playing') return;
    this.onSpeech([text], final);
  }

  dispose(): void {
    this.listener?.dispose();
    this.listener = null;
    clearInterval(this.ticker);
    this.timers.forEach(clearTimeout);
    window.speechSynthesis?.cancel();
    window.removeEventListener('keydown', this.onKey);
    this.fx.dispose();
    this.sfx?.dispose();
    this.root.remove();
  }

  // ----------------------------------------------------------- screens

  private showIntro(): void {
    this.phase = 'intro';
    const supported = SpeechListener.supported();
    this.ui.number.textContent = '';
    this.ui.listen.classList.remove('show');
    this.panel(`
      <h1 class="c-title">סופרים עד השמיים</h1>
      <p class="c-lead">סופרים בקול רם, עד המספר הכי גבוה שאפשר:<br/><b>אחת, שתיים, שלוש…</b></p>
      <p class="c-sub">כל מספר נכון מקפיץ את הרקטה למעלה 🚀<br/>טעינו או נתקענו? המשחק נגמר ואפשר לנסות שוב.</p>
      ${
        supported
          ? ''
          : `<p class="c-warn">הדפדפן הזה לא תומך בזיהוי דיבור. כדי לשחק, פתחו את המשחק בכרום, באדג' או בספארי.</p>`
      }
      <div class="c-patience" role="radiogroup" aria-label="זמן לחשוב">
        <span>⏱️ זמן לחשוב:</span>
        ${PATIENCE_LABELS.map(([p, label]) => `<button class="chip" role="radio" data-pat="${p}">${label}</button>`).join('')}
      </div>
      <div class="c-buttons"><button data-act="go" ${supported || this.opts.debug ? '' : 'disabled'}>יוצאים לדרך!</button></div>
      <p class="c-note">המשחק משתמש במיקרופון. זיהוי הדיבור נעשה על ידי שירות הזיהוי המובנה של הדפדפן, בלי עלות.</p>`);
    this.button('go', () => this.play());
    const chips = Array.from(this.ui.panel.querySelectorAll<HTMLElement>('[data-pat]'));
    const mark = () =>
      chips.forEach((c) => {
        const on = c.dataset.pat === this.patience;
        c.classList.toggle('on', on);
        c.setAttribute('aria-checked', String(on));
      });
    for (const c of chips)
      c.onclick = () => {
        this.patience = c.dataset.pat as Patience;
        try {
          localStorage.setItem(PATIENCE_KEY, this.patience);
        } catch {
          /* private mode */
        }
        mark();
      };
    mark();
  }

  private play(): void {
    this.sfx ??= new CountingSfx();
    this.panel(null);
    this.fx.clear();
    this.sky.celebrate(false);
    this.judge = new CountJudge();
    this.ui.number.textContent = '';
    this.ui.number.className = 'c-number';
    this.phase = 'playing';
    this.waitingSince = null;
    this.sky.setFlying(true);
    this.sky.setFuel(1);
    this.ui.listen.classList.add('show');
    this.setListening(false);
    if (SpeechListener.supported()) {
      if (this.listener && this.listenerOnDevice !== this.onDevice) {
        this.listener.dispose();
        this.listener = null;
      }
      this.listenerOnDevice = this.onDevice;
      this.listener ??= new SpeechListener({
        onResult: (alts, final, confidence) => this.onSpeech(alts, final, confidence),
        onSession: () => this.judge.newSession(),
        onListening: (on) => this.setListening(on),
        onInfo: (line) => this.debugLog(line),
        onError: (kind, detail) => this.onSpeechError(kind, detail),
      }, 'he-IL', this.onDevice);
      this.debugLog(`MIC start, ${this.onDevice ? 'on-device' : 'browser default'} recognition`);
      this.listener.start();
    } else {
      // Debug without speech support: start the clock right away.
      this.setListening(true);
    }
    clearInterval(this.ticker);
    this.lastTick = performance.now();
    this.ticker = window.setInterval(() => this.tick(), 100);
  }

  private end(wrong: number | null): void {
    if (this.phase !== 'playing') return;
    this.phase = 'over';
    clearInterval(this.ticker);
    this.listener?.stop();
    this.ui.listen.classList.remove('show');
    this.ui.number.classList.add('hide');
    this.sky.setFlying(false);
    const n = this.judge.count;
    this.debugLog(`END count=${n} ${wrong === null ? 'timeout' : `wrong=${wrong}`}`);

    if (n === 0) {
      this.sfx?.nothing();
      this.panel(`
        <div class="c-emoji">🙉</div>
        <h2>לא שמענו מספרים…</h2>
        <p class="c-sub">מתחילים מ<b>אחת</b> וסופרים בקול רם וברור.<br/>כדאי לשבת קרוב למכשיר.</p>
        <div class="c-buttons"><button data-act="again">ננסה שוב!</button><button class="secondary" data-act="menu">לתפריט</button></div>`);
      this.button('again', () => this.retry());
      this.button('menu', () => this.opts.onExit());
      return;
    }

    const record = n > this.best;
    if (record) {
      this.best = n;
      saveBest(n);
      this.showBest();
    }
    this.sfx?.victory();
    this.sky.celebrate(true);
    this.fx.burst(110);
    this.fx.fireworks(record ? 7 : 4);
    this.later(600, () => this.fx.rain(4));
    this.panel(`
      <div class="c-trophy">🏆</div>
      <h2>${cheerFor(n)}</h2>
      <p class="c-reached">ספרת עד</p>
      <div class="c-final">${n}</div>
      ${record && n > 1 ? '<p class="c-record">⭐ שיא חדש! ⭐</p>' : `<p class="c-sub">השיא: ${this.best}</p>`}
      <p class="c-tip">💡 אחרי ${n} בא ${n + 1}</p>
      <div class="c-buttons"><button data-act="again">עוד פעם!</button><button class="secondary" data-act="menu">לתפריט</button></div>`,
      'win');
    this.button('again', () => this.retry());
    this.button('menu', () => this.opts.onExit());
    this.later(1700, () => this.say(`כל הכבוד! ספרת עד ${n}!`));
  }

  private retry(): void {
    window.speechSynthesis?.cancel();
    this.panel(null);
    this.fx.clear();
    this.sky.celebrate(false);
    // The rocket glides back to the pad while the mic restarts. Listening
    // starts within this click, so browsers keep the mic allowed.
    this.sky.reset();
    this.play();
  }

  private onSpeechError(kind: SpeechErrorKind, detail: string): void {
    this.debugLog(`ERROR ${kind} ${detail}`);
    if (this.phase !== 'playing') return;
    if (this.judge.count > 0) {
      this.end(null);
      return;
    }
    this.phase = 'over';
    clearInterval(this.ticker);
    this.ui.listen.classList.remove('show');
    this.sky.setFlying(false);
    this.panel(`
      <div class="c-emoji">🎤</div>
      <h2>אופס…</h2>
      <p class="c-sub">${ERRORS[kind]}</p>
      <div class="c-buttons"><button data-act="again">ננסה שוב</button><button class="secondary" data-act="menu">לתפריט</button></div>`);
    this.button('again', () => this.play());
    this.button('menu', () => this.opts.onExit());
  }

  // ------------------------------------------------------------- play

  private onSpeech(alts: string[], final: boolean, confidence = 0): void {
    if (this.phase !== 'playing') return;
    this.lastSpeech = performance.now();
    this.ui.listen.classList.add('hearing');
    const heard = this.judge.hear(alts, final, confidence);
    this.debugLog(
      `${final ? `FINAL ${confidence.toFixed(2)}` : 'interim'} ${alts.map((a) => JSON.stringify(a)).join(' | ')} → +[${heard.counted}]${heard.wrong !== null ? ` wrong ${heard.wrong}` : ''}`,
    );
    heard.counted.forEach((n, i) => (i === 0 ? this.onCount(n) : this.later(i * 140, () => this.onCount(n))));
    if (heard.counted.length) this.waitingSince = performance.now();
    if (heard.wrong !== null) this.later(heard.counted.length * 140 + 250, () => this.end(heard.wrong));
  }

  private onCount(n: number): void {
    if (this.phase !== 'playing') return;
    const num = this.ui.number;
    num.textContent = String(n);
    num.style.setProperty('--c', ['#ff5d8f', '#ffb627', '#2ec4d6', '#7bd35a', '#a374ff', '#ff8a3d'][n % 6]);
    num.classList.remove('pop');
    void num.offsetWidth;
    num.classList.add('pop');
    if (n === 1) this.setListening(this.listening);
    this.sky.setAltitude(n);
    this.sky.addNumber(n);
    this.sky.boost();
    this.sfx?.count(n);
    const p = this.sky.rocketPoint();
    this.fx.sparkle(p.x, p.y + 60);
    if (n % 10 === 0) this.milestone(n);
  }

  private milestone(n: number): void {
    this.sfx?.milestone();
    this.fx.burst(n % 50 === 0 ? 120 : 60);
    const el = this.ui.praise;
    el.innerHTML = `<span class="n">${n}!</span><span class="w">${PRAISE[Math.floor(Math.random() * PRAISE.length)]}</span>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  /**
   * The patience clock: no new number for too long means the child is stuck.
   * It stops while the recognizer is slow to restart between sessions (not
   * the child's fault), and gives extra time while the child is still talking.
   */
  private tick(): void {
    const now = performance.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    if (this.phase !== 'playing' || this.waitingSince === null) return;
    if (!this.listening) this.waitingSince += dt;
    const limit = patienceMs(this.judge.count, this.patience);
    const waited = now - this.waitingSince;
    const speaking = now - this.lastSpeech < SPEAKING_MS;
    if (!speaking) this.ui.listen.classList.remove('hearing');
    this.sky.setFuel(1 - waited / limit);
    if (waited > limit && !(speaking && waited < limit + SPEAKING_GRACE_MS)) this.end(null);
  }

  private setListening(on: boolean): void {
    this.listening = on;
    this.ui.listen.classList.toggle('on', on);
    // Between sessions (a moment) keep the text; only the mic icon dims.
    const started = this.waitingSince !== null;
    this.ui.listen.querySelector('.txt')!.textContent =
      on || started ? (this.judge.count === 0 ? 'מקשיבים… אפשר להתחיל לספור!' : 'מקשיבים…') : 'מדליקים את המיקרופון…';
    // The clock starts once the mic really listens (after the permission prompt).
    if (on && this.phase === 'playing' && this.waitingSince === null) this.waitingSince = performance.now();
  }

  // ------------------------------------------------------------ helpers

  private panel(html: string | null, cls = ''): void {
    const p = this.ui.panel;
    p.className = `c-panel ${cls}`;
    if (html === null) {
      p.classList.remove('show');
      p.innerHTML = '';
      return;
    }
    p.innerHTML = `<div class="c-card">${html}</div>`;
    p.classList.add('show');
    this.later(50, () => p.querySelector<HTMLElement>('button[data-act]:not([disabled])')?.focus());
  }

  private button(act: string, fn: () => void): void {
    const b = this.ui.panel.querySelector<HTMLElement>(`[data-act="${act}"]`);
    if (b) b.onclick = fn;
  }

  private showBest(): void {
    this.ui.best.textContent = this.best ? `🏅 השיא: ${this.best}` : '';
  }

  private toggleMute(btn: HTMLElement): void {
    this.sfx ??= new CountingSfx();
    this.sfx.muted = !this.sfx.muted;
    btn.textContent = this.sfx.muted ? '🔇' : '🔊';
  }

  /** Read the result out loud, if the device has a Hebrew voice. */
  private say(text: string): void {
    const synth = window.speechSynthesis;
    if (!synth || this.sfx?.muted || this.phase !== 'over') return;
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('he') || v.lang.toLowerCase().startsWith('iw'));
    if (!voice) return;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.95;
    u.pitch = 1.15;
    synth.speak(u);
  }

  private later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      fn();
    }, ms);
    this.timers.push(id);
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'Escape') this.opts.onExit();
    else if (e.key === 'm' || e.key === 'M') this.toggleMute(this.root.querySelector('[data-act="mute"]')!);
  };

  // ------------------------------------------------------------- debug

  private setupDebug(): void {
    const d = this.ui.debug;
    d.classList.add('show');
    d.innerHTML = `<form><input placeholder="type a transcript, e.g. אחת שתיים" /><label><input type="checkbox" checked /> final</label><button type="button" class="copy">copy log</button></form><label><input type="checkbox" class="on-device" ${this.onDevice ? 'checked' : ''} /> on-device speech (next game)</label><pre></pre>`;
    d.querySelector<HTMLInputElement>('.on-device')!.onchange = (e) => {
      this.onDevice = (e.currentTarget as HTMLInputElement).checked;
      // The next game makes a listener in the new mode; the link keeps it.
      const p = new URLSearchParams(location.search);
      if (this.onDevice) p.set('speech', 'device');
      else p.delete('speech');
      history.replaceState(null, '', `${location.pathname}?${p}${location.hash}`);
      this.debugLog(`speech mode → ${this.onDevice ? 'on-device' : 'browser default'} (next game)`);
    };
    const copy = d.querySelector<HTMLElement>('.copy')!;
    copy.onclick = () => {
      const text = `Count to the Sky log (${navigator.userAgent})\n${this.log.join('\n')}`;
      navigator.clipboard?.writeText(text).then(
        () => (copy.textContent = 'copied ✓'),
        () => (copy.textContent = 'copy failed'),
      );
    };
    const form = d.querySelector('form')!;
    const [text, final] = Array.from(form.querySelectorAll('input'));
    form.onsubmit = (e) => {
      e.preventDefault();
      this.hear(text.value, final.checked);
      text.value = '';
    };
  }

  private debugLog(line: string): void {
    if (!this.opts.debug) return;
    this.log.push(`${(performance.now() / 1000).toFixed(1)}s ${line}`);
    this.log = this.log.slice(-400);
    this.ui.debug.querySelector('pre')!.textContent =
      `count=${this.judge.count} listening=${this.listening} phase=${this.phase} patience=${this.patience} speech=${this.onDevice ? 'device' : 'default'}\n` +
      this.log.slice(-14).join('\n');
  }
}
