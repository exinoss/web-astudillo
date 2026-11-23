(function (global) {
'use strict';
const ESTADOS_VALIDOS = new Set([
'idle',
'hablando',
'sonrisa',
'explicar',
'apuntar_usuario',
'senalar_ui',
'senalar_izquierda',
'aprobacion',
]);
const BODY_POR_ESTADO = {
idle: 'body_idle',
hablando: 'body_idle',
sonrisa: 'body_idle',
explicar: 'body_explicar',
apuntar_usuario: 'body_apuntar',
senalar_ui: 'body_senalar',
senalar_izquierda: 'body_senalar_izq',
aprobacion: 'body_aprobacion',
};
function clamp(v, min, max) {
return v < min ? min : v > max ? max : v;
}
function lerp(a, b, t) {
return a + (b - a) * t;
}
function textoATrayectoria(texto) {
const clean = (texto || '')
.toLowerCase()
.normalize('NFD')
.replace(/[\u0300-\u036f]/g, '');
const tokens = [];
let i = 0;
while (i < clean.length) {
const ch = clean[i];
if (ch === '.' || ch === '!' || ch === '?') {
tokens.push({ open: 0.0, width: 0.15, w: 3.6, pause: true });
i++;
} else if (ch === ',' || ch === ';' || ch === ':') {
tokens.push({ open: 0.0, width: 0.1, w: 2.0, pause: true });
i++;
} else if (ch === ' ') {
if (tokens.length && !tokens[tokens.length - 1].pause) {
tokens.push({ open: 0.08, width: 0.05, w: 0.45, pause: false });
}
i++;
} else if ('aeiou'.includes(ch)) {
let vowel = ch;
let len = 1;
if (i + 1 < clean.length && 'aeiou'.includes(clean[i + 1])) {
const next = clean[i + 1];
if (next === 'a' || ((next === 'e' || next === 'o') && (ch === 'i' || ch === 'u'))) {
vowel = next;
}
len = 2;
}
if (vowel === 'a') tokens.push({ open: 0.90, width: 0.08, w: 1.55, pause: false });
else if (vowel === 'e') tokens.push({ open: 0.56, width: 0.72, w: 1.35, pause: false });
else if (vowel === 'i') tokens.push({ open: 0.42, width: 0.85, w: 1.20, pause: false });
else if (vowel === 'o') tokens.push({ open: 0.58, width: -0.68, w: 1.40, pause: false });
else tokens.push({ open: 0.40, width: -0.78, w: 1.25, pause: false });
i += len;
} else if ('mbp'.includes(ch)) {
tokens.push({ open: 0.03, width: 0.0, w: 0.65, pause: false });
i++;
} else if ('fvszcxdtlrn'.includes(ch)) {
const prev = tokens[tokens.length - 1];
if (!prev || prev.open > 0.32) {
tokens.push({ open: 0.24, width: 0.15, w: 0.55, pause: false });
}
i++;
} else {
i++;
}
}
if (!tokens.length) {
tokens.push({ open: 0.0, width: 0.0, w: 1.0, pause: true });
}
const totalW = tokens.reduce((acc, t) => acc + t.w, 0) || 1;
let cursor = 0;
return tokens.map((tok) => {
const start = cursor / totalW;
cursor += tok.w;
return { open: tok.open, width: tok.width, pause: tok.pause, start, end: cursor / totalW };
});
}
class CarlosGuia {
constructor(container, rig, atlasImage, opts = {}) {
this.container = typeof container === 'string' ? document.querySelector(container) : container;
if (!this.container) throw new Error('CarlosGuia: contenedor no encontrado');
this.rig = rig;
this.atlas = atlasImage;
this.opts = Object.assign({
estado: 'idle',
autoParpadeo: true,
fondo: null,
escalaMaximaDpr: 2,
}, opts);
this.canvas = document.createElement('canvas');
this.canvas.style.width = '100%';
this.canvas.style.height = '100%';
this.canvas.style.display = 'block';
this.canvas.setAttribute('role', 'img');
this.canvas.setAttribute('aria-label', 'Carlos Astudillo — Guía interactivo de La Nueva Historia');
this.container.innerHTML = '';
this.container.appendChild(this.canvas);
this.ctx = this.canvas.getContext('2d', { alpha: true });
this.estado = ESTADOS_VALIDOS.has(this.opts.estado) ? this.opts.estado : 'idle';
this.bodyActual = this._resolveBodyKey(this.estado);
this.bodyPrevio = null;
this.bodyFade = 1;
this.headAngle = 0;
this.headTargetAngle = 0;
this.headNod = 0;
this.headNodVel = 0;
this.bodyBounce = 0;
this.bodyBounceVel = 0;
this.eyesHappy = this.estado === 'sonrisa' || this.estado === 'aprobacion' ? 1 : 0;
this.blinkProgress = 0;
this.blinkActive = false;
this.nextBlinkAt = performance.now() + 1800 + Math.random() * 2400;
this.hablando = false;
this.vozEnergia = 0;
this.mouthOpen = 0;      // 0 (cerrada) .. 1 (abierta A)
this.mouthOpenVel = 0;
this.mouthWidth = 0;     // -1 (redonda O/U) .. 0 (neutra) .. +1 (ancha E/sonrisa)
this.targetOpen = 0;
this.targetWidth = 0;
this.activeMouthSprite = this.estado === 'sonrisa' || this.estado === 'aprobacion' ? 'mouth_smile' : null;
this._lastSpriteChange = 0;
this.audioCtx = null;
this.analyser = null;
this.freqData = null;
this.audioSources = new WeakMap();
this.activeAudioEl = null;
this.micStream = null;
this.scriptTimeline = null;
this.scriptStart = 0;
this.scriptDuration = 0;
this.synthTalking = false;
this._synthPhase = 0;
this._synthNextSyllable = 0;
this._synthSyllableOpen = 0;
this._synthSyllableWidth = 0;
this._synthSyllableCount = 0;
this._listeners = new Map();
this._destroyed = false;
this._lastTime = performance.now();
this._raf = 0;
this._resize();
if (typeof ResizeObserver !== 'undefined') {
this._ro = new ResizeObserver(() => this._resize());
this._ro.observe(this.container);
} else {
this._onWinResize = () => this._resize();
window.addEventListener('resize', this._onWinResize);
}
this._loop = this._loop.bind(this);
this._raf = requestAnimationFrame(this._loop);
}
_resolveBodyKey(estado) {
const key = BODY_POR_ESTADO[estado] || 'body_idle';
if (this.rig.sprites[key]) return key;
return 'body_idle';
}
static async crear(container, opts = {}) {
let rig = opts.rigData || null;
let atlasSrc = opts.atlasDataUrl || null;
const base = (opts.basePath || './produccion/').replace(/\/?$/, '/');
if (!rig) {
const res = await fetch(base + 'carlos-rig.json');
if (!res.ok) throw new Error('No se pudo cargar carlos-rig.json (' + res.status + ')');
rig = await res.json();
}
if (!atlasSrc) {
atlasSrc = base + (rig.atlas || 'carlos-atlas.webp');
}
const img = await new Promise((resolve, reject) => {
const im = new Image();
im.crossOrigin = 'anonymous';
im.onload = () => resolve(im);
im.onerror = () => reject(new Error('No se pudo cargar el atlas: ' + atlasSrc));
im.src = atlasSrc;
});
return new CarlosGuia(container, rig, img, opts);
}
on(event, fn) {
if (!this._listeners.has(event)) this._listeners.set(event, new Set());
this._listeners.get(event).add(fn);
return () => this._listeners.get(event)?.delete(fn);
}
_emit(event, payload) {
const set = this._listeners.get(event);
if (set) set.forEach((fn) => fn(payload));
}
_resize() {
const rect = this.container.getBoundingClientRect();
const cssW = Math.max(120, rect.width || this.rig.canvas.w);
const cssH = Math.max(90, rect.height || Math.round(cssW * (this.rig.canvas.h / this.rig.canvas.w)));
const dpr = Math.min(window.devicePixelRatio || 1, this.opts.escalaMaximaDpr);
const pxW = Math.round(cssW * dpr);
const pxH = Math.round(cssH * dpr);
if (this.canvas.width !== pxW || this.canvas.height !== pxH) {
this.canvas.width = pxW;
this.canvas.height = pxH;
}
}
setEstado(nuevoEstado) {
if (!ESTADOS_VALIDOS.has(nuevoEstado)) return this;
const anterior = this.estado;
this.estado = nuevoEstado;
const targetBody = this._resolveBodyKey(nuevoEstado);
if (targetBody !== this.bodyActual) {
this.bodyPrevio = this.bodyActual;
this.bodyActual = targetBody;
this.bodyFade = 0;
this.bodyBounceVel += 0.22;
}
if (nuevoEstado === 'aprobacion') this.headNodVel += 48;
else if (nuevoEstado === 'apuntar_usuario') this.headNodVel += 22;
else if (nuevoEstado === 'sonrisa') this.headNodVel += 15;
if (anterior !== nuevoEstado) {
this._emit('estado', { anterior, actual: nuevoEstado });
}
return this;
}
setHablando(activo) {
this.synthTalking = Boolean(activo);
if (activo) {
this._synthNextSyllable = performance.now();
this._synthSyllableCount = 0;
} else if (!this.activeAudioEl && !this.micStream) {
this.scriptTimeline = null;
this.hablando = false;
}
return this;
}
parpadear() {
if (!this.blinkActive) {
this.blinkActive = true;
this.blinkProgress = 0;
}
return this;
}
conectarAudio(audioEl) {
if (!audioEl) return this;
const AudioCtx = window.AudioContext || window.webkitAudioContext;
if (!AudioCtx) return this;
if (!this.audioCtx) this.audioCtx = new AudioCtx();
if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
if (!this.analyser) {
this.analyser = this.audioCtx.createAnalyser();
this.analyser.fftSize = 512;
this.analyser.smoothingTimeConstant = 0.62;
this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
}
let src = this.audioSources.get(audioEl);
if (!src) {
src = this.audioCtx.createMediaElementSource(audioEl);
src.connect(this.analyser);
this.analyser.connect(this.audioCtx.destination);
this.audioSources.set(audioEl, src);
}
this.activeAudioEl = audioEl;
return this;
}
async conectarMicrofono() {
this.desconectarMicrofono();
const AudioCtx = window.AudioContext || window.webkitAudioContext;
if (!AudioCtx || !navigator.mediaDevices?.getUserMedia) {
throw new Error('El navegador no soporta captura de micrófono');
}
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
if (!this.audioCtx) this.audioCtx = new AudioCtx();
if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
if (!this.analyser) {
this.analyser = this.audioCtx.createAnalyser();
this.analyser.fftSize = 512;
this.analyser.smoothingTimeConstant = 0.58;
this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
}
this._micSource = this.audioCtx.createMediaStreamSource(stream);
this._micSource.connect(this.analyser);
this.micStream = stream;
return this;
}
desconectarMicrofono() {
if (this._micSource) {
try { this._micSource.disconnect(); } catch (_) {}
this._micSource = null;
}
if (this.micStream) {
this.micStream.getTracks().forEach((t) => t.stop());
this.micStream = null;
}
return this;
}
animarGuion(texto, duracionMs = 3500, estado = null) {
if (estado) this.setEstado(estado);
this.scriptTimeline = textoATrayectoria(texto);
this.scriptStart = performance.now();
this.scriptDuration = Math.max(400, duracionMs);
return this;
}
hablarTexto(texto, opts = {}) {
const { estado = null, rate = 1.0, pitch = 1.0, lang = 'es-EC', usarVoz = true, onEnd = null } = opts;
if (estado) this.setEstado(estado);
this.detenerHabla();
const words = (texto || '').trim().split(/\s+/).filter(Boolean).length;
const estimatedMs = Math.max(1200, (words / (2.5 * rate)) * 1000);
if (usarVoz && typeof window !== 'undefined' && 'speechSynthesis' in window) {
try {
window.speechSynthesis.cancel();
const utt = new SpeechSynthesisUtterance(texto);
utt.lang = lang;
utt.rate = rate;
utt.pitch = pitch;
const voices = window.speechSynthesis.getVoices();
const preferred =
voices.find((v) => /^es/i.test(v.lang) && /male|pablo|diego|jorge|alvaro|raul|carlos|google español/i.test(v.name)) ||
voices.find((v) => /^es-(EC|CO|MX|419|US|ES)/i.test(v.lang)) ||
voices.find((v) => /^es/i.test(v.lang));
if (preferred) utt.voice = preferred;
utt.onstart = () => {
this.animarGuion(texto, estimatedMs * 1.05);
};
utt.onend = () => {
this.scriptTimeline = null;
this.hablando = false;
if (onEnd) onEnd();
};
utt.onerror = () => {
this.animarGuion(texto, estimatedMs);
};
window.speechSynthesis.speak(utt);
this.animarGuion(texto, estimatedMs);
return this;
} catch (_) {}
}
this.animarGuion(texto, estimatedMs);
if (onEnd) {
this._scriptEndTimer = setTimeout(() => {
if (!this._destroyed) onEnd();
}, estimatedMs + 60);
}
return this;
}
detenerHabla() {
if (this._scriptEndTimer) {
clearTimeout(this._scriptEndTimer);
this._scriptEndTimer = null;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
try { window.speechSynthesis.cancel(); } catch (_) {}
}
this.scriptTimeline = null;
this.synthTalking = false;
this.hablando = false;
return this;
}
_elegirSpriteBoca(open, width, now) {
const smilingRest = this.estado === 'sonrisa' || this.estado === 'aprobacion';
if (!this.hablando && open < 0.09) {
return smilingRest ? 'mouth_smile' : null;
}
if (open < 0.11) return null;
if (open < 0.27) {
return width < -0.45 && this.rig.sprites.mouth_O_soft ? 'mouth_O_soft' : 'mouth_parted';
}
if (open < 0.48) {
if (width < -0.40 && this.rig.sprites.mouth_O_soft) return 'mouth_O_soft';
if (width > 0.42) return 'mouth_E';
return 'mouth_FV';
}
if (open < 0.74) {
if (width < -0.52 && this.rig.sprites.mouth_O) return 'mouth_O';
if (width < -0.24 && this.rig.sprites.mouth_O_soft) return 'mouth_O_soft';
if (width > 0.34) return 'mouth_E';
return 'mouth_mid';
}
if (width < -0.52 && this.rig.sprites.mouth_O) return 'mouth_O';
if (width > 0.50) return 'mouth_E';
return 'mouth_A';
}
_actualizarObjetivosBoca(now, dt) {
const audioPlaying =
(this.activeAudioEl && !this.activeAudioEl.paused && !this.activeAudioEl.ended) ||
Boolean(this.micStream);
if (audioPlaying && this.analyser && this.freqData) {
this.analyser.getByteFrequencyData(this.freqData);
const n = this.freqData.length;
let low = 0, mid = 0, high = 0;
const iLowEnd = Math.min(n, 10);
const iMidEnd = Math.min(n, 38);
const iHighEnd = Math.min(n, 95);
for (let i = 2; i < iLowEnd; i++) low += this.freqData[i];
for (let i = iLowEnd; i < iMidEnd; i++) mid += this.freqData[i];
for (let i = iMidEnd; i < iHighEnd; i++) high += this.freqData[i];
low /= Math.max(1, (iLowEnd - 2) * 255);
mid /= Math.max(1, (iMidEnd - iLowEnd) * 255);
high /= Math.max(1, (iHighEnd - iMidEnd) * 255);
const rawEnergy = clamp(low * 0.42 + mid * 0.92 + high * 0.32, 0, 1);
const envRate = rawEnergy > this.vozEnergia ? 18 : 10;
this.vozEnergia = lerp(this.vozEnergia, rawEnergy, clamp(dt * envRate, 0, 1));
if (this.vozEnergia < 0.055) {
this.hablando = false;
this.targetOpen = 0;
this.targetWidth = 0.1;
} else {
this.hablando = true;
this.targetOpen = clamp((this.vozEnergia - 0.04) * 2.15, 0.15, 0.95);
const ratio = (mid + high * 0.6) - low * 1.15;
this.targetWidth = clamp(ratio * 2.2, -0.75, 0.75);
}
return;
}
if (this.scriptTimeline) {
const p = (now - this.scriptStart) / this.scriptDuration;
if (p >= 1) {
this.scriptTimeline = null;
this.hablando = false;
this.targetOpen = 0;
this.targetWidth = 0.15;
this.vozEnergia = lerp(this.vozEnergia, 0, clamp(dt * 10, 0, 1));
} else {
let seg = this.scriptTimeline[this.scriptTimeline.length - 1];
for (let i = 0; i < this.scriptTimeline.length; i++) {
const s = this.scriptTimeline[i];
if (p >= s.start && p <= s.end) {
seg = s;
break;
}
}
const localT = clamp((p - seg.start) / Math.max(0.0001, seg.end - seg.start), 0, 1);
const env = seg.pause ? 0 : (0.38 + 0.62 * Math.sin(localT * Math.PI));
this.hablando = !seg.pause;
this.targetOpen = seg.open * env;
this.targetWidth = seg.width;
this.vozEnergia = lerp(this.vozEnergia, this.targetOpen * 0.75, clamp(dt * 14, 0, 1));
}
return;
}
if (this.synthTalking) {
this.hablando = true;
if (now >= this._synthNextSyllable) {
this._synthSyllableCount++;
if (this._synthSyllableCount % 8 === 0) {
this._synthSyllableOpen = 0.04;
this._synthSyllableWidth = 0.25;
this._synthNextSyllable = now + 260 + Math.random() * 140;
} else {
const r = Math.random();
if (r < 0.26) { this._synthSyllableOpen = 0.52; this._synthSyllableWidth = 0.62; }       // E cálido
else if (r < 0.50) { this._synthSyllableOpen = 0.64; this._synthSyllableWidth = 0.05; }  // A media
else if (r < 0.68) { this._synthSyllableOpen = 0.36; this._synthSyllableWidth = 0.22; }  // Consonante/I
else if (r < 0.84) { this._synthSyllableOpen = 0.44; this._synthSyllableWidth = -0.45; } // O conversacional suave
else { this._synthSyllableOpen = 0.86; this._synthSyllableWidth = 0.08; }                // A acentuada
this._synthNextSyllable = now + 175 + Math.random() * 95;
}
this._synthSegStart = now;
this._synthSegDur = Math.max(120, this._synthNextSyllable - now);
}
const u = clamp((now - (this._synthSegStart || now)) / (this._synthSegDur || 200), 0, 1);
const shapeEnv = 0.28 + 0.72 * Math.sin(u * Math.PI);
this.targetOpen = this._synthSyllableOpen * shapeEnv;
this.targetWidth = this._synthSyllableWidth;
this.vozEnergia = lerp(this.vozEnergia, this.targetOpen * 0.72, clamp(dt * 14, 0, 1));
return;
}
this.hablando = false;
this.targetOpen = 0;
this.targetWidth = 0.15;
this.vozEnergia = lerp(this.vozEnergia, 0, clamp(dt * 9, 0, 1));
}
_drawSprite(key, alpha = 1) {
const s = this.rig.sprites[key];
if (!s || alpha <= 0.004) return;
const ctx = this.ctx;
const prevAlpha = ctx.globalAlpha;
ctx.globalAlpha = prevAlpha * alpha;
ctx.drawImage(this.atlas, s.x, s.y, s.w, s.h, s.dx, s.dy, s.w, s.h);
ctx.globalAlpha = prevAlpha;
}
_drawMouthSmooth(key) {
if (!key) return;
const s = this.rig.sprites[key];
if (!s) return;
const anchorX = s.dx + s.w * 0.5;
const anchorY = s.dy + s.h * 0.28; // anclado bajo la nariz para que solo baje el labio inferior/mentón
const extraDrop = this.hablando ? clamp(this.mouthOpen, 0, 1) * 1.4 : 0;
const scaleY = 1 + (this.hablando ? (this.mouthOpen - 0.35) * 0.045 : 0);
const ctx = this.ctx;
ctx.save();
ctx.translate(anchorX, anchorY + extraDrop);
ctx.scale(1, clamp(scaleY, 0.96, 1.045));
ctx.translate(-anchorX, -anchorY);
ctx.drawImage(this.atlas, s.x, s.y, s.w, s.h, s.dx, s.dy, s.w, s.h);
ctx.restore();
}
_loop(now) {
if (this._destroyed) return;
const dt = Math.min(0.05, Math.max(0.001, (now - this._lastTime) / 1000));
this._lastTime = now;
const t = now * 0.001;
this._actualizarObjetivosBoca(now, dt);
const openRate = this.targetOpen > this.mouthOpen ? 22.0 : 15.0;
this.mouthOpen = lerp(this.mouthOpen, this.targetOpen, clamp(dt * openRate, 0, 1));
this.mouthWidth = lerp(this.mouthWidth, this.targetWidth, clamp(dt * 12.0, 0, 1));
const wanted = this._elegirSpriteBoca(this.mouthOpen, this.mouthWidth, now);
if (wanted !== this.activeMouthSprite && (now - this._lastSpriteChange >= 100 || !this.hablando)) {
this.activeMouthSprite = wanted;
this._lastSpriteChange = now;
}
if (this.bodyFade < 1) {
this.bodyFade = clamp(this.bodyFade + dt / 0.19, 0, 1);
if (this.bodyFade >= 1) this.bodyPrevio = null;
}
if (this.opts.autoParpadeo && !this.blinkActive && now >= this.nextBlinkAt) {
this.blinkActive = true;
this.blinkProgress = 0;
const doubleBlink = Math.random() < 0.15;
this.nextBlinkAt = now + (doubleBlink ? 270 : 2800 + Math.random() * 2900);
}
let blinkAlpha = 0;
if (this.blinkActive) {
this.blinkProgress += dt / 0.135;
if (this.blinkProgress >= 1) {
this.blinkActive = false;
this.blinkProgress = 0;
} else {
const s = Math.sin(this.blinkProgress * Math.PI);
blinkAlpha = s > 0.35 ? 1.0 : s / 0.35;
}
}
const targetHappy =
this.estado === 'sonrisa' || this.estado === 'aprobacion'
? 1
: this.estado === 'explicar'
? 0.55 + this.vozEnergia * 0.35
: this.estado === 'apuntar_usuario'
? 0.45
: this.vozEnergia * 0.3;
this.eyesHappy = lerp(this.eyesHappy, clamp(targetHappy, 0, 1), clamp(dt * 7, 0, 1));
const bForce = -110 * this.bodyBounce - 14 * this.bodyBounceVel;
this.bodyBounceVel += bForce * dt;
this.bodyBounce += this.bodyBounceVel * dt;
let baseTilt = 0;
if (this.estado === 'sonrisa') baseTilt = 0.034;
else if (this.estado === 'explicar') baseTilt = Math.sin(t * 1.75) * (0.030 + this.vozEnergia * 0.028);
else if (this.estado === 'apuntar_usuario') baseTilt = -0.026;
else if (this.estado === 'senalar_ui') baseTilt = 0.046;
else if (this.estado === 'senalar_izquierda') baseTilt = -0.046;
else if (this.estado === 'aprobacion') baseTilt = 0.026;
const organicSway = Math.sin(t * 0.92) * 0.013 + Math.sin(t * 1.68) * 0.007;
const talkTilt = this.hablando ? Math.sin(t * 3.4) * 0.020 * (0.4 + this.vozEnergia) : 0;
this.headTargetAngle = baseTilt + organicSway + talkTilt;
this.headAngle = lerp(this.headAngle, this.headTargetAngle, clamp(dt * 6.5, 0, 1));
const speechNodTarget = this.hablando ? Math.sin(t * 6.4) * 2.8 * this.vozEnergia : 0;
const nForce = -130 * (this.headNod - speechNodTarget) - 15 * this.headNodVel;
this.headNodVel += nForce * dt;
this.headNod += this.headNodVel * dt;
const ctx = this.ctx;
const cw = this.canvas.width;
const ch = this.canvas.height;
const rw = this.rig.canvas.w;
const rh = this.rig.canvas.h;
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.clearRect(0, 0, cw, ch);
if (this.opts.fondo) {
ctx.fillStyle = this.opts.fondo;
ctx.fillRect(0, 0, cw, ch);
}
const scale = Math.min(cw / rw, ch / rh);
const offsetX = (cw - rw * scale) * 0.5;
const offsetY = ch - rh * scale;
ctx.save();
ctx.translate(offsetX, offsetY);
ctx.scale(scale, scale);
const breath = Math.sin(t * 2.1);
const speechPulse = this.vozEnergia * 0.010;
const bodyScaleY = 1 + breath * 0.008 + speechPulse + this.bodyBounce * 0.075;
const bodyScaleX = 1 - breath * 0.003 - this.bodyBounce * 0.03;
const bodyTilt = Math.sin(t * 0.85) * 0.0055 + (this.hablando ? Math.sin(t * 2.7) * 0.006 * this.vozEnergia : 0);
const anchorX = this.rig.pivot.neckX;
const anchorY = rh;
ctx.save();
ctx.translate(anchorX, anchorY);
ctx.rotate(bodyTilt);
ctx.scale(bodyScaleX, bodyScaleY);
ctx.translate(-anchorX, -anchorY);
const easeFade = this.bodyFade * this.bodyFade * (3 - 2 * this.bodyFade);
if (this.bodyPrevio && easeFade < 1) {
this._drawSprite(this.bodyPrevio, 1 - easeFade);
}
this._drawSprite(this.bodyActual, easeFade);
const nx = this.rig.pivot.neckX;
const ny = this.rig.pivot.neckY;
ctx.save();
ctx.translate(nx, ny + this.headNod);
ctx.rotate(this.headAngle);
const headScale = this.estado === 'apuntar_usuario' ? 1.016 : 1;
ctx.scale(headScale, headScale);
ctx.translate(-nx, -ny);
this._drawSprite('head_base', 1);
if (this.eyesHappy > 0.02 && this.rig.sprites.eyes_happy) {
this._drawSprite('eyes_happy', this.eyesHappy * (1 - blinkAlpha * 0.9));
}
if (blinkAlpha > 0.02 && this.rig.sprites.eyes_blink) {
this._drawSprite('eyes_blink', blinkAlpha);
}
if (this.activeMouthSprite) {
this._drawMouthSmooth(this.activeMouthSprite);
}
ctx.restore();
ctx.restore();
ctx.restore();
this._raf = requestAnimationFrame(this._loop);
}
destruir() {
this._destroyed = true;
cancelAnimationFrame(this._raf);
this.detenerHabla();
this.desconectarMicrofono();
if (this._ro) this._ro.disconnect();
if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
this.container.innerHTML = '';
}
}
global.CarlosGuia = CarlosGuia;
if (typeof module !== 'undefined' && module.exports) {
module.exports = CarlosGuia;
}
})(typeof window !== 'undefined' ? window : globalThis);