// Ponto de entrada do pacote de bibliotecas do estúdio (vira window.BQV).
// Imports nomeados para o esbuild descartar o que não é usado (demuxers etc.).
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import {
  Output, Mp4OutputFormat, BufferTarget, CanvasSource, VideoSampleSource, VideoSample,
  AudioBufferSource, canEncodeAudio, canEncodeVideo,
} from "mediabunny";

window.BQV = {
  THREE,
  addons: { EffectComposer, RenderPass, UnrealBloomPass, OutputPass, RoundedBoxGeometry, RoomEnvironment, Line2, LineMaterial, LineGeometry },
  Mediabunny: { Output, Mp4OutputFormat, BufferTarget, CanvasSource, VideoSampleSource, VideoSample, AudioBufferSource, canEncodeAudio, canEncodeVideo },
};
