import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadRuntime } from "./load_runtime.mjs";
const { BQ } = loadRuntime(["base.js", "audio.js"]);
const A = BQ.audio;
let t0 = performance.now();
for (const n of A.SOUND_NAMES) { const s = A.sound(n); if (!s.length || s.some((v) => !Number.isFinite(v))) throw new Error("som inválido " + n); }
console.log("sons:", A.SOUND_NAMES.length, "em", Math.round(performance.now() - t0), "ms");
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", "C:/app.Modelar-Concorrentes-MKT/house/videos/reboco-novo/assets/narracao-norm.mp3", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], { maxBuffer: 1 << 29 });
const voice = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
t0 = performance.now();
const lv = A.lufs(voice);
console.log("LUFS voz (JS):", lv.toFixed(2), "em", Math.round(performance.now() - t0), "ms");
const events = A.SOUND_NAMES.map((name, i) => ({ t: 1 + i * 3, name, db: 0 }));
t0 = performance.now();
const { data, report } = A.mix({ voice, events, duration: 71.3 });
console.log("mix em", Math.round(performance.now() - t0), "ms ·", JSON.stringify({ voiceIn: report.voiceLufsIn, mix: report.mixLufs, final: report.finalLufs, peak: report.peakDb }));
console.log("diferenças efeito-voz (dB):", report.events.map((e) => `${e.name}:${e.diffDb}`).join(" "));
// grava WAV para conferir com ffmpeg
const buf = Buffer.alloc(44 + data.length * 2); buf.write("RIFF", 0); buf.writeUInt32LE(36 + data.length * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(48000, 24); buf.writeUInt32LE(96000, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(data.length * 2, 40);
for (let i = 0; i < data.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767))), 44 + i * 2);
writeFileSync("tmp-mix.wav", buf);
const vbuf = Buffer.alloc(0);
