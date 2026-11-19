class AudioEngine {
  constructor() { this.ctx = null; }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  playTone(freq, type = 'sine', duration = 0.15) {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + duration);
  }
  playSuccess() { this.playTone(587.33, 'sine', 0.1); setTimeout(() => this.playTone(880, 'triangle', 0.2), 90); }
  playMiss() { this.playTone(180, 'sawtooth', 0.25); }
  playCountdown() { this.playTone(440, 'sine', 0.08); }
  speakThai(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'th-TH'; utter.rate = 1.1;
      window.speechSynthesis.speak(utter);
    }
  }
}
export const audio = new AudioEngine();