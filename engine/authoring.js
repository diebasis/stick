(() => {
  'use strict';

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  class Timeline {
    constructor({ fps = 60, duration = 1.0, loop = true, tracks = {} } = {}) {
      this.fps = fps;
      this.duration = duration;
      this.loop = loop;
      this.tracks = tracks;
      this.time = 0;
      this.playing = false;
    }

    addKey(trackName, time, value) {
      if (!this.tracks[trackName]) this.tracks[trackName] = [];
      this.tracks[trackName].push({ time, value });
      this.tracks[trackName].sort((a, b) => a.time - b.time);
      return this;
    }

    removeKey(trackName, index) {
      if (!this.tracks[trackName]) return this;
      this.tracks[trackName].splice(index, 1);
      return this;
    }

    valueAt(trackName, t) {
      const keys = this.tracks[trackName] ?? [];
      if (!keys.length) return 0;
      if (keys.length === 1) return keys[0].value;

      if (this.loop && this.duration > 0) {
        t = ((t % this.duration) + this.duration) % this.duration;
      }

      if (t <= keys[0].time) return keys[0].value;
      if (t >= keys[keys.length - 1].time) return this.loop ? keys[0].value : keys[keys.length - 1].value;

      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i];
        const b = keys[i + 1];
        if (t >= a.time && t <= b.time) {
          const d = Math.max(1e-6, b.time - a.time);
          const p = clamp((t - a.time) / d, 0, 1);
          return lerp(a.value, b.value, p);
        }
      }
      return keys[keys.length - 1].value;
    }

    sample(t = this.time) {
      const out = {};
      for (const name of Object.keys(this.tracks)) out[name] = this.valueAt(name, t);
      return out;
    }

    play(reset = false) { if (reset) this.time = 0; this.playing = true; return this; }
    pause() { this.playing = false; return this; }

    update(dt) {
      if (!this.playing) return this.sample();
      this.time += dt;
      if (!this.loop && this.time >= this.duration) {
        this.time = this.duration;
        this.playing = false;
      }
      return this.sample();
    }

    toJSON() {
      return {
        fps: this.fps,
        duration: this.duration,
        loop: this.loop,
        tracks: this.tracks,
      };
    }

    static fromJSON(json) {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      return new Timeline(parsed);
    }
  }

  class MotionLibrary {
    constructor({ version = '1.0.0', motions = {} } = {}) {
      this.version = version;
      this.motions = motions;
    }

    setMotion(name, timeline) {
      this.motions[name] = timeline instanceof Timeline ? timeline.toJSON() : timeline;
      return this;
    }

    getMotion(name) {
      const raw = this.motions[name];
      if (!raw) return null;
      return Timeline.fromJSON(raw);
    }

    list() { return Object.keys(this.motions); }

    importJSON(json) {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      if (!parsed || typeof parsed !== 'object') throw new Error('MotionLibrary JSON inválido');
      this.version = parsed.version ?? this.version;
      this.motions = parsed.motions ?? {};
      return this;
    }

    exportJSON(pretty = true) {
      return JSON.stringify({ version: this.version, motions: this.motions }, null, pretty ? 2 : 0);
    }
  }

  const DEFAULT_MOTION_LIBRARY = new MotionLibrary({
    version: '1.0.0',
    motions: {
      locomotion_idle: {
        fps: 60,
        duration: 1,
        loop: true,
        tracks: {
          torsoLeanDeg: [{ time: 0, value: 0 }, { time: 0.5, value: 0 }, { time: 1, value: 0 }],
          armLift: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }, { time: 1, value: 0 }],
        },
      },
      wave_upper: {
        fps: 60,
        duration: 1,
        loop: false,
        tracks: {
          armLift: [{ time: 0, value: 6 }, { time: 0.25, value: 18 }, { time: 0.5, value: 10 }, { time: 0.75, value: 20 }, { time: 1, value: 6 }],
          torsoLeanDeg: [{ time: 0, value: 1 }, { time: 1, value: 2 }],
        },
      },
    },
  });

  const api = Object.freeze({ Timeline, MotionLibrary, DEFAULT_MOTION_LIBRARY });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.StickEngineAuthoring = api;
})();
