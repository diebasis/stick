(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(current, target, smoothing, dt) {
    const t = 1 - Math.pow(1 - clamp(smoothing, 0, 1), dt * 60);
    return lerp(current, target, t);
  }
  function finite(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  class Vec2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    set(x, y) { this.x = finite(x, 0); this.y = finite(y, 0); return this; }
    copy(v) { this.x = v.x; this.y = v.y; return this; }
    clone() { return new Vec2(this.x, this.y); }
    add(v) { this.x += v.x; this.y += v.y; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }
    mul(s) { this.x *= s; this.y *= s; return this; }
    len() { return Math.hypot(this.x, this.y); }
    lenSq() { return this.x * this.x + this.y * this.y; }
    normalize() { const l = this.len(); if (l > 1e-8) { this.x /= l; this.y /= l; } return this; }
    angle() { return Math.atan2(this.y, this.x); }
    static add(a, b) { return new Vec2(a.x + b.x, a.y + b.y); }
    static sub(a, b) { return new Vec2(a.x - b.x, a.y - b.y); }
    static mul(v, s) { return new Vec2(v.x * s, v.y * s); }
    static lerp(a, b, t) { return new Vec2(lerp(a.x, b.x, t), lerp(a.y, b.y, t)); }
    static fromAngle(rad, len = 1) { return new Vec2(Math.cos(rad) * len, Math.sin(rad) * len); }
  }

  function normalizeAngle(angle) {
    let a = angle;
    while (a <= -Math.PI) a += TAU;
    while (a > Math.PI) a -= TAU;
    return a;
  }

  function solveTwoBone(root, target, upperLength, lowerLength, bend = 1, pole = null) {
    const delta = Vec2.sub(target, root);
    const rawDistance = delta.len();
    const maxReach = upperLength + lowerLength - 0.0001;
    const minReach = Math.abs(upperLength - lowerLength) + 0.0001;
    const safeDistance = clamp(rawDistance || 0.0001, minReach, maxReach);
    const baseAngle = rawDistance > 0.0001 ? Math.atan2(delta.y, delta.x) : Math.PI / 2;
    const endDistance = Math.min(rawDistance || maxReach, maxReach);
    const end = Vec2.add(root, Vec2.fromAngle(baseAngle, endDistance));

    const cosAngle = clamp(
      (upperLength * upperLength + safeDistance * safeDistance - lowerLength * lowerLength) / (2 * upperLength * safeDistance),
      -1,
      1
    );

    let bendSign = Math.sign(bend || 1);
    if (pole && rawDistance > 0.0001) {
      const a = delta;
      const b = Vec2.sub(pole, root);
      const cross = a.x * b.y - a.y * b.x;
      const poleSide = Math.sign(cross);
      if (poleSide !== 0) bendSign = poleSide;
    }

    const jointAngle = Math.acos(cosAngle) * bendSign;
    const mid = Vec2.add(root, Vec2.fromAngle(baseAngle + jointAngle, upperLength));
    return { root: root.clone(), mid, end };
  }

  const DEFAULT_LENGTHS = Object.freeze({
    spine: 72,
    neck: 12,
    head: 22,
    shoulderWidth: 50,
    hipWidth: 34,
    upperArm: 52,
    forearm: 48,
    upperLeg: 62,
    lowerLeg: 56,
  });

  const DEFAULT_POSES = Object.freeze({
    idle: { torsoLeanDeg: 0, headTiltDeg: 0, armLift: 0, hipDrop: 0 },
    walkContact: { torsoLeanDeg: 3, headTiltDeg: -2, armLift: 2, hipDrop: 2 },
    runContact: { torsoLeanDeg: 8, headTiltDeg: -3, armLift: 6, hipDrop: 5 },
    crouch: { torsoLeanDeg: 8, headTiltDeg: 3, armLift: 8, hipDrop: 12 },
    jumpAir: { torsoLeanDeg: 1, headTiltDeg: 0, armLift: 10, hipDrop: -8 },
    wave: { torsoLeanDeg: 2, headTiltDeg: 0, armLift: 14, hipDrop: 0 },
  });

  const DEFAULT_ACTIONS = Object.freeze({
    idle: { duration: 0, loop: true, layer: 'base', blendIn: 0.2, blendOut: 0.2 },
    walk: { duration: 0, loop: true, layer: 'base', blendIn: 0.16, blendOut: 0.16 },
    run: { duration: 0, loop: true, layer: 'base', blendIn: 0.14, blendOut: 0.14 },
    crouch: { duration: 0, loop: true, layer: 'base', blendIn: 0.18, blendOut: 0.18 },
    jump: { duration: 0.86, loop: false, layer: 'base', blendIn: 0.05, blendOut: 0.15 },
    wave: { duration: 1.0, loop: false, layer: 'upper', blendIn: 0.08, blendOut: 0.12 },
  });

  class PoseLibrary {
    constructor(initial = DEFAULT_POSES) { this.map = JSON.parse(JSON.stringify(initial)); }
    list() { return Object.keys(this.map); }
    get(name) { return this.map[name] ? JSON.parse(JSON.stringify(this.map[name])) : null; }
    set(name, def) { if (typeof name === 'string') this.map[name] = JSON.parse(JSON.stringify(def ?? {})); return this; }
    remove(name) { delete this.map[name]; return this; }
    exportJSON(pretty = true) { return JSON.stringify(this.map, null, pretty ? 2 : 0); }
    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Formato de pose inválido');
      this.map = parsed;
      return this;
    }
  }

  class ActionTrack {
    constructor() { this.active = []; }
    play(name, cfg) {
      const now = performance.now() * 0.001;
      if (cfg.layer === 'base') this.active = this.active.filter(a => a.layer !== 'base');
      this.active.push({ name, layer: cfg.layer, cfg, time: 0, start: now, weight: 0, exiting: false });
    }
    stopLayer(layer) {
      for (const item of this.active) if (item.layer === layer) item.exiting = true;
    }
    update(dt) {
      for (const item of this.active) {
        item.time += dt;
        const inDur = Math.max(0.0001, item.cfg.blendIn || 0.1);
        const outDur = Math.max(0.0001, item.cfg.blendOut || 0.1);
        if (!item.exiting) item.weight = clamp(item.weight + dt / inDur, 0, 1);
        else item.weight = clamp(item.weight - dt / outDur, 0, 1);
        if (!item.cfg.loop && item.time >= item.cfg.duration) item.exiting = true;
      }
      this.active = this.active.filter(a => a.weight > 0.001 || (!a.exiting && a.cfg.loop));
    }
    weightOf(name) { return this.active.filter(a => a.name === name).reduce((s, a) => s + a.weight, 0); }
    topBase() { return this.active.filter(a => a.layer === 'base').sort((a, b) => b.weight - a.weight)[0] ?? null; }
    topUpper() { return this.active.filter(a => a.layer === 'upper').sort((a, b) => b.weight - a.weight)[0] ?? null; }
  }

  class StickCharacter {
    constructor(options = {}) {
      this.id = options.id ?? `char-${Math.random().toString(36).slice(2, 8)}`;
      this.position = new Vec2(options.x ?? 0, options.y ?? 0);
      this.velocity = new Vec2();
      this.target = new Vec2(options.x ?? 0, (options.y ?? 0) - 110);
      this.lookTarget = this.target.clone();
      this.smoothedTarget = this.target.clone();
      this.facing = 1;
      this.scale = options.scale ?? 1;
      this.energy = options.energy ?? 0.72;
      this.smoothing = options.smoothing ?? 0.18;
      this.groundY = options.groundY ?? 420;
      this.motion = 0;
      this.jumpTime = 1;
      this.jumpDuration = 0.86;
      this.time = 0;
      this.debug = false;
      this.reachRight = true;
      this.reachLeft = false;
      this.footLock = true;
      this.lengths = { ...DEFAULT_LENGTHS, ...(options.lengths ?? {}) };
      this.poseBias = { ...DEFAULT_POSES.idle };
      this.joints = {};
      this.bones = [];
      this.track = new ActionTrack();
      this.track.play('idle', DEFAULT_ACTIONS.idle);
      this.overlayWaveSide = 'right';
    }

    setBaseAction(name, actions) {
      if (!actions[name]) return;
      this.track.play(name, actions[name]);
    }

    overlayAction(name, actions) {
      if (!actions[name]) return;
      this.track.play(name, actions[name]);
    }

    jump(actions) {
      this.jumpTime = 0;
      if (actions.jump) this.setBaseAction('jump', actions);
    }

    scaled() {
      const out = {};
      for (const [k, v] of Object.entries(this.lengths)) out[k] = v * this.scale;
      return out;
    }

    poseForState(poses) {
      const base = this.track.topBase()?.name ?? 'idle';
      const upper = this.track.topUpper()?.name ?? null;
      let poseName = 'idle';
      if (this.jumpTime < 1) poseName = 'jumpAir';
      else if (base === 'run') poseName = 'runContact';
      else if (base === 'walk') poseName = 'walkContact';
      else if (base === 'crouch') poseName = 'crouch';
      const p = { ...(poses.get('idle') ?? {}) , ...(poses.get(poseName) ?? {}) };
      if (upper === 'wave') Object.assign(p, poses.get('wave') ?? {});
      return p;
    }

    update(dt, actions, poses, worldBounds) {
      this.time += dt;
      this.track.update(dt);
      this.poseBias = this.poseForState(poses);

      const base = this.track.topBase()?.name ?? 'idle';
      const movingAction = base === 'walk' || base === 'run';
      const speed = base === 'run' ? 240 : 132;
      const targetSpeed = movingAction ? this.facing * speed : 0;
      this.velocity.x = damp(this.velocity.x, targetSpeed, 0.12, dt);

      this.position.x += this.velocity.x * dt;
      if (worldBounds) this.position.x = clamp(this.position.x, worldBounds.left, worldBounds.right);

      this.smoothedTarget.x = damp(this.smoothedTarget.x, this.target.x, this.smoothing, dt);
      this.smoothedTarget.y = damp(this.smoothedTarget.y, this.target.y, this.smoothing, dt);
      this.lookTarget.x = damp(this.lookTarget.x, this.target.x, this.smoothing * 0.8, dt);
      this.lookTarget.y = damp(this.lookTarget.y, this.target.y, this.smoothing * 0.8, dt);

      if (this.jumpTime < 1) this.jumpTime = Math.min(1, this.jumpTime + dt / this.jumpDuration);
      this.motion = damp(this.motion, movingAction ? 1 : 0, 0.15, dt);

      this.solvePose();
    }

    solvePose() {
      const L = this.scaled();
      const moving = this.motion > 0.025;
      const runMix = this.track.weightOf('run');
      const gaitSpeed = lerp(1.08, 1.72, clamp(runMix, 0, 1));
      const phase = this.time * gaitSpeed * TAU;
      const s = Math.sin(phase);
      const c = Math.cos(phase);

      const jumpAir = this.jumpTime < 1 ? Math.sin(this.jumpTime * Math.PI) : 0;
      const jumpY = this.jumpTime < 1 ? -104 * Math.sin(this.jumpTime * Math.PI) : 0;
      const crouchMix = this.track.weightOf('crouch');
      const crouchDrop = crouchMix * 38 * this.scale + (this.poseBias.hipDrop || 0) * this.scale;

      const legTotal = L.upperLeg + L.lowerLeg;
      const hipStandingY = this.groundY - legTotal * 0.88;
      const bob = moving ? Math.max(0, Math.cos(phase * 2)) * 4.8 * this.energy : Math.sin(this.time * 1.6) * 1.2 * this.scale;
      const hip = new Vec2(this.position.x + s * 4 * this.energy * 0.18 * this.facing, hipStandingY + jumpY + crouchDrop - bob);

      const poseLean = (this.poseBias.torsoLeanDeg || 0) * DEG * this.facing;
      const runLean = this.facing * lerp(4.2, 7.5, clamp(runMix, 0, 1)) * DEG * this.motion;
      const torsoAngle = -Math.PI / 2 + poseLean + runLean - s * 2.2 * DEG * this.energy;

      const chest = Vec2.add(hip, Vec2.fromAngle(torsoAngle, L.spine));
      const neck = Vec2.add(chest, Vec2.fromAngle(torsoAngle, L.neck));
      const look = Vec2.sub(this.lookTarget, neck);
      let headAngle = look.lenSq() > 2 ? look.angle() : torsoAngle;
      const headOffset = clamp(normalizeAngle(headAngle - torsoAngle), -54 * DEG, 54 * DEG);
      headAngle = torsoAngle + headOffset + (this.poseBias.headTiltDeg || 0) * DEG * this.facing;
      const head = Vec2.add(neck, Vec2.fromAngle(headAngle, L.head * 0.72));

      const side = Vec2.fromAngle(torsoAngle + Math.PI / 2, 1);
      const shoulderL = Vec2.add(chest, Vec2.mul(side, -L.shoulderWidth / 2));
      const shoulderR = Vec2.add(chest, Vec2.mul(side, L.shoulderWidth / 2));
      const hipL = Vec2.add(hip, Vec2.mul(side, -L.hipWidth / 2));
      const hipR = Vec2.add(hip, Vec2.mul(side, L.hipWidth / 2));

      const armReach = L.upperArm + L.forearm - 12 * this.scale;
      const armLift = (this.poseBias.armLift || 0) * this.scale;
      const armSwing = lerp(24, 34, clamp(runMix, 0, 1)) * this.energy * this.motion * this.scale;
      const armDrop = armReach * (0.86 - crouchMix * 0.08) - armLift;

      const waveWeight = this.track.weightOf('wave');
      const wavePulse = Math.sin(this.time * 18) * 12 * this.scale;
      const rightDefault = Vec2.add(shoulderR, new Vec2(-this.facing * s * armSwing + 7 * this.scale * this.facing, armDrop + Math.abs(c) * 4 * this.scale * this.motion));
      const leftDefault = Vec2.add(shoulderL, new Vec2(this.facing * s * armSwing - 7 * this.scale * this.facing, armDrop + Math.abs(Math.sin(phase + Math.PI)) * 2.2 * this.scale * this.motion));
      const waveRight = Vec2.add(shoulderR, new Vec2((44 + wavePulse * 0.2) * this.scale * this.facing, (-76 - Math.abs(wavePulse)) * this.scale));

      const mirror = new Vec2(this.position.x - (this.smoothedTarget.x - this.position.x), this.smoothedTarget.y);
      const handRTarget = this.reachRight ? this.limitTarget(shoulderR, this.smoothedTarget, L.upperArm + L.forearm - 2) : rightDefault;
      const handLTarget = this.reachLeft ? this.limitTarget(shoulderL, mirror, L.upperArm + L.forearm - 2) : leftDefault;
      const finalRight = Vec2.lerp(handRTarget, waveRight, clamp(waveWeight, 0, 1));

      const armRPole = Vec2.add(shoulderR, new Vec2(-this.facing * 24 * this.scale + side.x * L.shoulderWidth, 42 * this.scale + side.y * L.shoulderWidth));
      const armLPole = Vec2.add(shoulderL, new Vec2(-this.facing * 24 * this.scale - side.x * L.shoulderWidth, 42 * this.scale - side.y * L.shoulderWidth));
      const armR = solveTwoBone(shoulderR, finalRight, L.upperArm, L.forearm, -this.facing, armRPole);
      const armL = solveTwoBone(shoulderL, handLTarget, L.upperArm, L.forearm, this.facing, armLPole);

      const stride = lerp(32, 48, clamp(runMix, 0, 1)) * this.energy * this.motion * this.scale;
      const lift = lerp(19, 31, clamp(runMix, 0, 1)) * this.energy * this.motion * this.scale;
      const stanceWidth = L.hipWidth * 0.36;
      const footCycle = (hipJoint, sideSign, localPhase) => {
        const swing = Math.max(0, Math.sin(localPhase));
        const strideProgress = -Math.cos(localPhase);
        const groundTarget = new Vec2(hip.x + sideSign * stanceWidth + this.facing * strideProgress * stride, this.groundY - swing * lift);
        const relaxedAir = Vec2.add(hipJoint, new Vec2(sideSign * 10 * this.scale, legTotal * 0.73));
        return Vec2.lerp(groundTarget, relaxedAir, jumpAir);
      };

      let footRTarget = footCycle(hipR, 1, phase);
      let footLTarget = footCycle(hipL, -1, phase + Math.PI);
      if (!this.footLock) {
        footRTarget = Vec2.add(hipR, new Vec2(14 * this.scale, legTotal * 0.76));
        footLTarget = Vec2.add(hipL, new Vec2(-14 * this.scale, legTotal * 0.76));
      }

      const kneePoleR = Vec2.add(hipR, new Vec2(this.facing * 68 * this.scale, 36 * this.scale));
      const kneePoleL = Vec2.add(hipL, new Vec2(this.facing * 68 * this.scale, 36 * this.scale));
      const legR = solveTwoBone(hipR, footRTarget, L.upperLeg, L.lowerLeg, this.facing, kneePoleR);
      const legL = solveTwoBone(hipL, footLTarget, L.upperLeg, L.lowerLeg, this.facing, kneePoleL);

      this.joints = {
        hip, chest, neck, head, shoulderL, shoulderR,
        elbowL: armL.mid, handL: armL.end,
        elbowR: armR.mid, handR: armR.end,
        hipL, hipR, kneeL: legL.mid, kneeR: legR.mid, footL: legL.end, footR: legR.end,
      };
      this.bones = [
        ['hipL', 'kneeL'], ['kneeL', 'footL'],
        ['hipR', 'kneeR'], ['kneeR', 'footR'],
        ['hip', 'chest'], ['chest', 'neck'],
        ['shoulderL', 'elbowL'], ['elbowL', 'handL'],
        ['shoulderR', 'elbowR'], ['elbowR', 'handR'],
      ];
    }

    limitTarget(root, target, maxDistance) {
      const d = Vec2.sub(target, root);
      const distance = d.len();
      if (distance <= maxDistance) return target.clone();
      return Vec2.add(root, d.normalize().mul(maxDistance));
    }
  }

  class CanvasRenderer {
    constructor(canvas) {
      if (!canvas) throw new Error('Canvas não encontrado');
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) throw new Error('Canvas 2D indisponível');
      this.width = canvas.width;
      this.height = canvas.height;
      this.dpr = 1;
      this.theme = {
        bgA: '#071122', bgB: '#030712',
        bone: '#f7fbff', core: '#ffffff', shadow: 'rgba(1,8,24,.82)',
        joint: '#7ddcff', floor: 'rgba(150,205,255,.35)', grid: 'rgba(150,205,255,.07)',
      };
      this.resize();
      window.addEventListener('resize', () => this.resize(), { passive: true });
    }
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const cssW = Math.max(1, rect.width || this.canvas.clientWidth || 960);
      const cssH = Math.max(1, rect.height || this.canvas.clientHeight || 560);
      this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const nextW = Math.floor(cssW * this.dpr);
      const nextH = Math.floor(cssH * this.dpr);
      if (this.canvas.width !== nextW) this.canvas.width = nextW;
      if (this.canvas.height !== nextH) this.canvas.height = nextH;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.width = cssW; this.height = cssH;
    }
    clear() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      const g = ctx.createLinearGradient(0, 0, 0, this.height);
      g.addColorStop(0, this.theme.bgA); g.addColorStop(1, this.theme.bgB);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.width, this.height);
    }
    drawWorld(groundY) {
      const ctx = this.ctx;
      ctx.save(); ctx.strokeStyle = this.theme.grid; ctx.lineWidth = 1;
      for (let x = 0; x <= this.width; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke(); }
      for (let y = 0; y <= this.height; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke(); }
      ctx.strokeStyle = this.theme.floor; ctx.lineWidth = 2; ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(this.width, groundY); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    drawCharacter(character) {
      const joints = character.joints;
      if (!joints.hip) return;
      const ctx = this.ctx;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = this.theme.shadow; ctx.lineWidth = 13.5 * character.scale;
      for (const [a, b] of character.bones) this.line(joints[a], joints[b]);
      ctx.strokeStyle = this.theme.bone; ctx.lineWidth = 7.2 * character.scale;
      for (const [a, b] of character.bones) this.line(joints[a], joints[b]);
      ctx.strokeStyle = this.theme.core; ctx.globalAlpha = .82; ctx.lineWidth = 2.4 * character.scale;
      for (const [a, b] of character.bones) this.line(joints[a], joints[b]); ctx.globalAlpha = 1;

      ctx.fillStyle = '#071122';
      ctx.strokeStyle = this.theme.bone;
      ctx.lineWidth = 5 * character.scale;
      ctx.beginPath(); ctx.arc(joints.head.x, joints.head.y, 21 * character.scale, 0, TAU); ctx.fill(); ctx.stroke();

      if (character.debug) {
        ctx.fillStyle = this.theme.joint;
        ctx.strokeStyle = 'rgba(120,215,255,.45)';
        ctx.lineWidth = 1;
        for (const [name, p] of Object.entries(joints)) {
          ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill();
          ctx.strokeText(name, p.x + 7, p.y - 4);
        }
      }
      ctx.restore();
    }
    line(a, b) { const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  }

  class StickEngine {
    constructor(canvas, options = {}) {
      this.renderer = new CanvasRenderer(canvas);
      this.poses = new PoseLibrary(options.poses ?? DEFAULT_POSES);
      this.actions = { ...DEFAULT_ACTIONS, ...(options.actions ?? {}) };
      this.characters = [];
      this.activeCharacterId = null;
      this.boundsPadding = options.boundsPadding ?? 80;
      this._raf = 0;
      this._last = 0;
      this._fps = 0;
      this._fpsTime = 0;
      this._fpsFrames = 0;
      this.onBeforeFrame = null;
      this.onAfterFrame = null;
      this.addCharacter({ id: 'hero', x: this.renderer.width * 0.5, y: this.renderer.height * 0.78, groundY: this.renderer.height * 0.78 });
    }

    addCharacter(options = {}) {
      const c = new StickCharacter({ groundY: this.renderer.height * 0.78, ...options });
      this.characters.push(c);
      if (!this.activeCharacterId) this.activeCharacterId = c.id;
      return c;
    }
    removeCharacter(id) { this.characters = this.characters.filter(c => c.id !== id); if (this.activeCharacterId === id) this.activeCharacterId = this.characters[0]?.id ?? null; }
    getCharacter(id = this.activeCharacterId) { return this.characters.find(c => c.id === id) ?? null; }
    selectCharacter(id) { if (this.getCharacter(id)) this.activeCharacterId = id; return this; }

    play(name, id) { const c = this.getCharacter(id); if (!c || !this.actions[name]) return this; c.setBaseAction(name, this.actions); return this; }
    overlay(name, id) { const c = this.getCharacter(id); if (!c || !this.actions[name]) return this; c.overlayAction(name, this.actions); return this; }
    jump(id) { const c = this.getCharacter(id); if (c) c.jump(this.actions); return this; }
    crouch(enabled = true, id) { return this.play(enabled ? 'crouch' : 'idle', id); }
    stop(id) { return this.play('idle', id); }
    lookAt(x, y, id) { const c = this.getCharacter(id); if (c) c.target.set(x, y); return this; }
    reach(hand, x, y, id) {
      const c = this.getCharacter(id); if (!c) return this;
      c.target.set(x, y);
      c.reachRight = hand === 'rightHand' || hand === 'both';
      c.reachLeft = hand === 'leftHand' || hand === 'both';
      return this;
    }
    setFacing(dir, id) { const c = this.getCharacter(id); if (!c) return this; if (dir === 'left' || dir === -1) c.facing = -1; if (dir === 'right' || dir === 1) c.facing = 1; return this; }
    setEnergy(v, id) { const c = this.getCharacter(id); if (c) c.energy = clamp(finite(v, c.energy), 0, 1); return this; }
    setScale(v, id) { const c = this.getCharacter(id); if (c) c.scale = clamp(finite(v, c.scale), 0.5, 2); return this; }
    setSmoothing(v, id) { const c = this.getCharacter(id); if (c) c.smoothing = clamp(finite(v, c.smoothing), 0.01, 0.8); return this; }
    setFootLock(v, id) { const c = this.getCharacter(id); if (c) c.footLock = Boolean(v); return this; }
    setReach(right = true, left = false, id) { const c = this.getCharacter(id); if (c) { c.reachRight = Boolean(right); c.reachLeft = Boolean(left); } return this; }
    setDebug(v, id) { const c = this.getCharacter(id); if (c) c.debug = Boolean(v); return this; }

    listPoses() { return this.poses.list(); }
    getPose(name) { return this.poses.get(name); }
    registerPose(name, def) { this.poses.set(name, def); return this; }
    removePose(name) { this.poses.remove(name); return this; }
    exportPosesJSON(pretty = true) { return this.poses.exportJSON(pretty); }
    importPosesJSON(text) { this.poses.importJSON(text); return this; }

    getState(id = this.activeCharacterId) {
      const c = this.getCharacter(id);
      return {
        fps: this._fps,
        characters: this.characters.length,
        activeCharacterId: this.activeCharacterId,
        character: c ? {
          id: c.id,
          actionBase: c.track.topBase()?.name ?? 'idle',
          actionUpper: c.track.topUpper()?.name ?? null,
          facing: c.facing === 1 ? 'right' : 'left',
          energy: c.energy,
          scale: c.scale,
          smoothing: c.smoothing,
          footLock: c.footLock,
          reachRight: c.reachRight,
          reachLeft: c.reachLeft,
        } : null,
      };
    }

    step(dt, now = performance.now()) {
      this.renderer.resize();
      for (const c of this.characters) c.groundY = this.renderer.height * 0.78;
      if (typeof this.onBeforeFrame === 'function') this.onBeforeFrame({ dt, now, engine: this });
      for (const c of this.characters) {
        c.update(dt, this.actions, this.poses, { left: this.boundsPadding, right: this.renderer.width - this.boundsPadding });
      }

      this.renderer.clear();
      this.renderer.drawWorld(this.renderer.height * 0.78);
      for (const c of this.characters) this.renderer.drawCharacter(c);

      this._fpsFrames += 1; this._fpsTime += dt;
      if (this._fpsTime >= 0.35) { this._fps = Math.round(this._fpsFrames / this._fpsTime); this._fpsFrames = 0; this._fpsTime = 0; }
      if (typeof this.onAfterFrame === 'function') this.onAfterFrame({ dt, now, engine: this });
    }

    start() {
      if (this._raf) return this;
      this._last = performance.now();
      const frame = (now) => {
        const dt = Math.min(0.033, (now - this._last) / 1000 || 0.016);
        this._last = now;
        this.step(dt, now);
        this._raf = requestAnimationFrame(frame);
      };
      this._raf = requestAnimationFrame(frame);
      return this;
    }

    pause() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; return this; }
  }

  function create(canvas, options = {}) { return new StickEngine(canvas, options); }

  const api = Object.freeze({
    VERSION: '1.0.0-experimental',
    Vec2,
    StickEngine,
    StickCharacter,
    CanvasRenderer,
    DEFAULT_ACTIONS,
    DEFAULT_POSES,
    create,
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.StickEngine = api;
})();
