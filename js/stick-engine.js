(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function invLerp(a, b, v) {
    if (a === b) return 0;
    return clamp((v - a) / (b - a), 0, 1);
  }

  function smoothstep(edge0, edge1, x) {
    const t = invLerp(edge0, edge1, x);
    return t * t * (3 - 2 * t);
  }

  function damp(current, target, smoothing, dt) {
    const t = 1 - Math.pow(1 - clamp(smoothing, 0, 1), dt * 60);
    return lerp(current, target, t);
  }

  function normalizeAngle(angle) {
    let a = angle;
    while (a <= -Math.PI) a += TAU;
    while (a > Math.PI) a -= TAU;
    return a;
  }

  function perpendicular(angle) {
    return new Vec2(Math.cos(angle + Math.PI / 2), Math.sin(angle + Math.PI / 2));
  }

  function cross2(a, b) {
    return a.x * b.y - a.y * b.x;
  }

  class Vec2 {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }

    set(x, y) {
      this.x = Number.isFinite(x) ? x : 0;
      this.y = Number.isFinite(y) ? y : 0;
      return this;
    }

    copy(v) {
      this.x = v.x;
      this.y = v.y;
      return this;
    }

    clone() {
      return new Vec2(this.x, this.y);
    }

    add(v) {
      this.x += v.x;
      this.y += v.y;
      return this;
    }

    sub(v) {
      this.x -= v.x;
      this.y -= v.y;
      return this;
    }

    mul(s) {
      this.x *= s;
      this.y *= s;
      return this;
    }

    length() {
      return Math.hypot(this.x, this.y);
    }

    lengthSq() {
      return this.x * this.x + this.y * this.y;
    }

    normalize() {
      const len = this.length();
      if (len > 1e-8) {
        this.x /= len;
        this.y /= len;
      }
      return this;
    }

    angle() {
      return Math.atan2(this.y, this.x);
    }

    static fromAngle(rad, len = 1) {
      return new Vec2(Math.cos(rad) * len, Math.sin(rad) * len);
    }

    static add(a, b) {
      return new Vec2(a.x + b.x, a.y + b.y);
    }

    static sub(a, b) {
      return new Vec2(a.x - b.x, a.y - b.y);
    }

    static mul(v, s) {
      return new Vec2(v.x * s, v.y * s);
    }

    static distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    static lerp(a, b, t) {
      return new Vec2(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
    }
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  class ActionTimeline {
    constructor() {
      this.name = 'idle';
      this.time = 0;
      this.once = null;
    }

    set(name) {
      if (this.name !== name) {
        this.name = name;
        this.time = 0;
      }
    }

    trigger(name, duration = 0.8) {
      this.once = { name, time: 0, duration };
    }

    update(dt) {
      this.time += dt;
      if (this.once) {
        this.once.time += dt;
        if (this.once.time >= this.once.duration) this.once = null;
      }
    }

    get activeGesture() {
      return this.once;
    }
  }

  function gaitCycle(t, speed = 1, energy = 0.7) {
    const phase = t * speed * TAU;
    const sin = Math.sin(phase);
    const cos = Math.cos(phase);
    const double = Math.sin(phase * 2);
    return {
      phase,
      sin,
      cos,
      double,
      legRPhase: phase,
      legLPhase: phase + Math.PI,
      armR: -sin,
      armL: sin,
      hipSway: sin * 4.2 * energy,
      torsoCounter: -sin * 2.2 * energy,
      vertical: Math.max(0, Math.cos(phase * 2)) * 4.8 * energy,
    };
  }

  function jumpCurve(t) {
    const p = clamp(t, 0, 1);
    let y = 0;
    let squash = 0;
    let air = 0;

    if (p < 0.16) {
      const q = smoothstep(0, 0.16, p);
      y = 18 * q;
      squash = q;
    } else if (p < 0.78) {
      const q = invLerp(0.16, 0.78, p);
      y = -104 * Math.sin(q * Math.PI);
      air = Math.sin(q * Math.PI);
      squash = Math.max(0, 1 - q * 6) * 0.35;
    } else {
      const q = smoothstep(0.78, 1, p);
      y = 12 * (1 - q);
      squash = 1 - q;
    }

    return { y, squash, air };
  }

  function waveAmount(gesture) {
    if (!gesture || !gesture.name.startsWith('wave')) return 0;
    const p = clamp(gesture.time / gesture.duration, 0, 1);
    const envelope = Math.sin(p * Math.PI);
    const shake = Math.sin(p * Math.PI * 9);
    return envelope * (0.8 + shake * 0.2);
  }

  function solveTwoBone(root, target, upperLength, lowerLength, bend = 1, pole = null) {
    const delta = Vec2.sub(target, root);
    const rawDistance = delta.length();
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
      const poleDelta = Vec2.sub(pole, root);
      const poleSide = Math.sign(cross2(delta, poleDelta));
      if (poleSide !== 0) bendSign = poleSide;
    }

    const jointAngle = Math.acos(cosAngle) * bendSign;
    const mid = Vec2.add(root, Vec2.fromAngle(baseAngle + jointAngle, upperLength));

    return {
      root: root.clone(),
      mid,
      end,
      reachable: rawDistance <= upperLength + lowerLength,
    };
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

  class StickFigure {
    constructor(options = {}) {
      this.position = new Vec2(options.x ?? 0, options.y ?? 0);
      this.velocity = new Vec2();
      this.target = new Vec2(options.x ?? 0, (options.y ?? 0) - 110);
      this.smoothedTarget = this.target.clone();
      this.lookTarget = this.target.clone();
      this.scale = options.scale ?? 1;
      this.energy = options.energy ?? 0.72;
      this.smoothing = options.smoothing ?? 0.18;
      this.facing = 1;
      this.action = 'idle';
      this.walkSpeed = 0;
      this.motion = 0;
      this.crouchEase = 0;
      this.time = 0;
      this.groundY = options.groundY ?? 420;
      this.jumpTime = 1;
      this.jumpDuration = 0.86;
      this.isCrouching = false;
      this.reachRight = true;
      this.reachLeft = false;
      this.footLock = true;
      this.debug = false;
      this.lengths = { ...DEFAULT_LENGTHS, ...(options.lengths ?? {}) };
      this.joints = new Map();
      this.bones = [];
      this.lastPose = null;
      this._gesture = null;
    }

    setAction(action) {
      this.action = action;
      if (action === 'run') this.walkSpeed = 1.7;
      else if (action === 'walk') this.walkSpeed = 1;
      else this.walkSpeed = 0;
      this.isCrouching = action === 'crouch';
    }

    jump() {
      if (this.jumpTime >= 1) this.jumpTime = 0;
    }

    move(horizontal, run = false) {
      const targetSpeed = horizontal * (run ? 240 : 132);
      this.velocity.x = damp(this.velocity.x, targetSpeed, 0.22, 1 / 60);
      if (horizontal !== 0) {
        this.facing = Math.sign(horizontal);
        this.setAction(run ? 'run' : 'walk');
      } else if (this.action === 'walk' || this.action === 'run') {
        this.setAction('idle');
      }
    }

    reset(x, groundY) {
      this.position.set(x, groundY);
      this.groundY = groundY;
      this.velocity.set(0, 0);
      this.jumpTime = 1;
      this.setAction('idle');
    }

    update(dt, bounds) {
      this.time += dt;
      this.position.x += this.velocity.x * dt;
      if (bounds) this.position.x = clamp(this.position.x, bounds.left, bounds.right);

      this.smoothedTarget.x = damp(this.smoothedTarget.x, this.target.x, this.smoothing, dt);
      this.smoothedTarget.y = damp(this.smoothedTarget.y, this.target.y, this.smoothing, dt);
      this.lookTarget.x = damp(this.lookTarget.x, this.target.x, this.smoothing * 0.75, dt);
      this.lookTarget.y = damp(this.lookTarget.y, this.target.y, this.smoothing * 0.75, dt);

      const targetMotion = this.action === 'walk' || this.action === 'run' ? 1 : 0;
      const targetCrouch = this.action === 'crouch' ? 1 : 0;
      this.motion = damp(this.motion, targetMotion, 0.13, dt);
      this.crouchEase = damp(this.crouchEase, targetCrouch, 0.18, dt);

      if (Math.abs(this.velocity.x) < 0.02) this.velocity.x = 0;
      if (this.jumpTime < 1) this.jumpTime = Math.min(1, this.jumpTime + dt / this.jumpDuration);
      this.lastPose = this.solvePose();
    }

    solvePose() {
      const L = this.scaledLengths();
      const actionIsRun = this.action === 'run';
      const motion = clamp(this.motion, 0, 1);
      const moving = motion > 0.025;
      const gaitSpeed = actionIsRun ? 1.72 : 1.08;
      const gaitEnergy = this.energy * motion;
      const gait = gaitCycle(this.time, gaitSpeed, gaitEnergy);
      const jump = this.jumpTime < 1 ? jumpCurve(this.jumpTime) : { y: 0, squash: 0, air: 0 };
      const crouch = clamp(this.crouchEase, 0, 1);
      const legTotal = L.upperLeg + L.lowerLeg;
      const hipStandingY = this.groundY - legTotal * 0.88;
      const bodyBob = moving ? gait.vertical * (actionIsRun ? 1.14 : 0.82) : Math.sin(this.time * 1.6) * 1.2 * this.scale;
      const crouchDrop = crouch * 38 * this.scale;
      const anticipationDrop = jump.squash * 9 * this.scale;
      const root = new Vec2(
        this.position.x + gait.hipSway * 0.18 * this.facing,
        hipStandingY + jump.y + crouchDrop + anticipationDrop - bodyBob
      );

      const breathe = (1 - motion) * Math.sin(this.time * 1.35) * 1.45 * DEG;
      const lean = (moving ? this.facing * (actionIsRun ? 7.5 : 4.2) * motion : 0) * DEG;
      const counterLean = gait.torsoCounter * DEG;
      const crouchLean = crouch * this.facing * 6 * DEG;
      const torsoAngle = -Math.PI / 2 + breathe + lean + counterLean + crouchLean;
      const hip = root.clone();
      const spineLength = L.spine * (1 - crouch * 0.13 + jump.squash * 0.035);
      const chest = Vec2.add(hip, Vec2.fromAngle(torsoAngle, spineLength));
      const neck = Vec2.add(chest, Vec2.fromAngle(torsoAngle, L.neck));

      const lookVector = Vec2.sub(this.lookTarget, neck);
      let headAngle = lookVector.lengthSq() > 2 ? lookVector.angle() : torsoAngle;
      const headLimit = 54 * DEG;
      const headOffset = clamp(normalizeAngle(headAngle - torsoAngle), -headLimit, headLimit);
      headAngle = torsoAngle + headOffset;
      const head = Vec2.add(neck, Vec2.fromAngle(headAngle, L.head * 0.72));

      const side = perpendicular(torsoAngle);
      const shoulderL = Vec2.add(chest, Vec2.mul(side, -L.shoulderWidth / 2));
      const shoulderR = Vec2.add(chest, Vec2.mul(side, L.shoulderWidth / 2));
      const hipL = Vec2.add(hip, Vec2.mul(side, -L.hipWidth / 2));
      const hipR = Vec2.add(hip, Vec2.mul(side, L.hipWidth / 2));

      const armReach = L.upperArm + L.forearm - 12 * this.scale;
      const armSwingPx = (actionIsRun ? 34 : 24) * this.energy * this.scale * motion;
      const armDrop = armReach * (0.86 - crouch * 0.08);
      const idleArmDrift = (1 - motion) * Math.sin(this.time * 1.15) * 5.5 * this.scale;

      // As mãos são posicionadas em coordenadas relativas ao corpo e espelhadas por "facing".
      // Isso impede que a caminhada para a esquerda mantenha o braço/perna com lógica de direita.
      const rightDefault = Vec2.add(shoulderR, new Vec2(
        -this.facing * gait.sin * armSwingPx + this.facing * 7 * this.scale + this.facing * idleArmDrift,
        armDrop + Math.abs(gait.cos) * 4.0 * this.scale * motion
      ));
      const leftDefault = Vec2.add(shoulderL, new Vec2(
        this.facing * gait.sin * armSwingPx - this.facing * 7 * this.scale - this.facing * idleArmDrift,
        armDrop + Math.abs(Math.sin(gait.phase + Math.PI)) * 2.4 * this.scale * motion
      ));

      const wave = waveAmount(this.gesture);
      const waveSide = this.gesture?.name === 'waveLeft' ? 'left' : 'right';
      const wavePulse = Math.sin(this.time * 18) * 12 * this.scale;
      const rightWaveTarget = Vec2.add(shoulderR, new Vec2((40 + wavePulse * 0.15) * this.scale * this.facing, (-74 - Math.abs(wavePulse)) * this.scale));
      const leftWaveTarget = Vec2.add(shoulderL, new Vec2((40 + wavePulse * 0.15) * this.scale * this.facing, (-74 - Math.abs(wavePulse)) * this.scale));
      const handRTarget = this.reachRight ? this.limitTarget(shoulderR, this.smoothedTarget, L.upperArm + L.forearm - 2) : rightDefault;
      const mirroredTarget = new Vec2(this.position.x - (this.smoothedTarget.x - this.position.x), this.smoothedTarget.y);
      const handLTarget = this.reachLeft ? this.limitTarget(shoulderL, mirroredTarget, L.upperArm + L.forearm - 2) : leftDefault;

      const finalRightTarget = wave > 0 && waveSide === 'right' ? Vec2.lerp(handRTarget, rightWaveTarget, wave) : handRTarget;
      const finalLeftTarget = wave > 0 && waveSide === 'left' ? Vec2.lerp(handLTarget, leftWaveTarget, wave) : handLTarget;

      // Pole vectors: cada cotovelo tem uma direção preferida de dobra.
      // Isso evita a inversão visual em que os cotovelos dobravam para dentro ao virar o boneco.
      const armRPole = Vec2.add(shoulderR, Vec2.add(Vec2.mul(side, L.shoulderWidth * 1.05), new Vec2(-this.facing * 24 * this.scale, 42 * this.scale)));
      const armLPole = Vec2.add(shoulderL, Vec2.add(Vec2.mul(side, -L.shoulderWidth * 1.05), new Vec2(-this.facing * 24 * this.scale, 42 * this.scale)));
      const armR = solveTwoBone(shoulderR, finalRightTarget, L.upperArm, L.forearm, -this.facing, armRPole);
      const armL = solveTwoBone(shoulderL, finalLeftTarget, L.upperArm, L.forearm, this.facing, armLPole);

      const stride = (actionIsRun ? 48 : 32) * this.energy * this.scale * motion;
      const lift = (actionIsRun ? 31 : 19) * this.energy * this.scale * motion;
      const stanceWidth = L.hipWidth * 0.36;

      const footOnCycle = (hipJoint, sideSign, phase) => {
        const swing = Math.max(0, Math.sin(phase));

        // Correção importante do ciclo de marcha:
        // - Na fase aérea (sin > 0), o pé precisa viajar de trás para frente.
        // - Na fase de apoio (sin <= 0), o pé fica no chão e passa de frente para trás
        //   em relação ao corpo, compensando o avanço do quadril.
        //
        // A versão anterior usava +cos(phase). Isso fazia o pé levantado se mover
        // de frente para trás, criando a impressão de que o personagem caminhava
        // "para trás" apesar de o corpo e os joelhos apontarem corretamente.
        const strideProgress = -Math.cos(phase);
        const x = hip.x + sideSign * stanceWidth + this.facing * strideProgress * stride;
        const y = this.groundY - swing * lift;
        const groundTarget = new Vec2(x, y);
        const relaxedAir = Vec2.add(hipJoint, new Vec2(sideSign * 10 * this.scale, legTotal * (0.73 + jump.squash * 0.05)));
        const airborne = clamp(jump.air, 0, 1);
        return Vec2.lerp(groundTarget, relaxedAir, airborne);
      };

      let footRTarget = footOnCycle(hipR, 1, gait.legRPhase);
      let footLTarget = footOnCycle(hipL, -1, gait.legLPhase);

      if (!this.footLock) {
        footRTarget = Vec2.add(hipR, new Vec2(14 * this.scale, legTotal * 0.76));
        footLTarget = Vec2.add(hipL, new Vec2(-14 * this.scale, legTotal * 0.76));
      }

      if (crouch > 0.01) {
        const crouchR = new Vec2(hip.x + 28 * this.scale, this.groundY);
        const crouchL = new Vec2(hip.x - 28 * this.scale, this.groundY);
        footRTarget = Vec2.lerp(footRTarget, crouchR, crouch);
        footLTarget = Vec2.lerp(footLTarget, crouchL, crouch);
      }

      // Pole vectors das pernas: os joelhos sempre preferem dobrar para a frente do personagem.
      // Sem isso, a solução de dois ossos pode escolher o outro lado da cadeia e criar o efeito de "joelho invertido".
      const kneePoleR = Vec2.add(hipR, new Vec2(this.facing * 68 * this.scale, 36 * this.scale));
      const kneePoleL = Vec2.add(hipL, new Vec2(this.facing * 68 * this.scale, 36 * this.scale));
      const legR = solveTwoBone(hipR, footRTarget, L.upperLeg, L.lowerLeg, this.facing, kneePoleR);
      const legL = solveTwoBone(hipL, footLTarget, L.upperLeg, L.lowerLeg, this.facing, kneePoleL);

      const joints = {
        hip,
        chest,
        neck,
        head,
        shoulderL,
        shoulderR,
        elbowL: armL.mid,
        handL: armL.end,
        elbowR: armR.mid,
        handR: armR.end,
        hipL,
        hipR,
        kneeL: legL.mid,
        footL: legL.end,
        kneeR: legR.mid,
        footR: legR.end,
      };

      this.joints.clear();
      for (const [name, point] of Object.entries(joints)) this.joints.set(name, point);

      this.bones = [
        ['hipL', 'kneeL'],
        ['kneeL', 'footL'],
        ['shoulderL', 'elbowL'],
        ['elbowL', 'handL'],
        ['hip', 'chest'],
        ['chest', 'neck'],
        ['hipR', 'kneeR'],
        ['kneeR', 'footR'],
        ['shoulderR', 'elbowR'],
        ['elbowR', 'handR'],
      ];

      return { joints, bones: this.bones, headAngle, torsoAngle, jump, crouch, gait, motion };
    }

    limitTarget(root, target, maxDistance) {
      const delta = Vec2.sub(target, root);
      const distance = delta.length();
      if (distance <= maxDistance) return target.clone();
      return Vec2.add(root, delta.normalize().mul(maxDistance));
    }

    scaledLengths() {
      const out = {};
      for (const [key, value] of Object.entries(this.lengths)) out[key] = value * this.scale;
      return out;
    }

    set gesture(value) {
      this._gesture = value;
    }

    get gesture() {
      return this._gesture ?? null;
    }
  }

  class CanvasRenderer {
    constructor(canvas) {
      if (!canvas) throw new Error('Canvas #stage não encontrado.');
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) throw new Error('Não foi possível obter o contexto 2D do canvas.');
      this.width = canvas.width;
      this.height = canvas.height;
      this.dpr = 1;
      this.theme = {
        bone: '#f7fbff',
        boneCore: '#ffffff',
        boneShadow: 'rgba(1, 8, 24, 0.82)',
        joint: '#7ddcff',
        target: '#ffd166',
        floor: 'rgba(150, 205, 255, 0.35)',
        grid: 'rgba(150, 205, 255, 0.07)',
      };
      this.resize();
      window.addEventListener('resize', () => this.resize(), { passive: true });
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const cssWidth = Math.max(1, rect.width || this.canvas.clientWidth || 960);
      const cssHeight = Math.max(1, rect.height || this.canvas.clientHeight || 560);
      this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const nextWidth = Math.floor(cssWidth * this.dpr);
      const nextHeight = Math.floor(cssHeight * this.dpr);
      if (this.canvas.width !== nextWidth) this.canvas.width = nextWidth;
      if (this.canvas.height !== nextHeight) this.canvas.height = nextHeight;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.width = cssWidth;
      this.height = cssHeight;
    }

    clear() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      const grd = ctx.createLinearGradient(0, 0, 0, this.height);
      grd.addColorStop(0, '#071122');
      grd.addColorStop(0.54, '#050b18');
      grd.addColorStop(1, '#030712');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    drawWorld(groundY) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = this.theme.grid;
      ctx.lineWidth = 1;
      const spacing = 42;
      for (let x = -spacing; x < this.width + spacing; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
        ctx.stroke();
      }
      for (let y = -spacing; y < this.height + spacing; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = this.theme.floor;
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(this.width, groundY);
      ctx.stroke();
      ctx.setLineDash([]);
      const floorGrad = ctx.createLinearGradient(0, groundY, 0, this.height);
      floorGrad.addColorStop(0, 'rgba(125, 220, 255, 0.10)');
      floorGrad.addColorStop(1, 'rgba(125, 220, 255, 0.015)');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, groundY + 1, this.width, this.height - groundY);
      ctx.restore();
    }

    drawStick(figure) {
      const pose = figure.lastPose;
      if (!pose) return;
      const joints = pose.joints;
      const ctx = this.ctx;
      ctx.save();
      this.drawShadow(joints);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.strokeStyle = this.theme.boneShadow;
      ctx.lineWidth = Math.max(13.5, 13.5 * figure.scale);
      for (const [a, b] of figure.bones) this.line(joints[a], joints[b]);

      ctx.strokeStyle = this.theme.bone;
      ctx.lineWidth = Math.max(7.2, 7.2 * figure.scale);
      for (const [a, b] of figure.bones) this.line(joints[a], joints[b]);

      ctx.strokeStyle = this.theme.boneCore;
      ctx.globalAlpha = 0.82;
      ctx.lineWidth = Math.max(2.4, 2.4 * figure.scale);
      for (const [a, b] of figure.bones) this.line(joints[a], joints[b]);
      ctx.globalAlpha = 1;

      this.drawHead(joints.neck, joints.head, pose.headAngle, figure.scale);
      this.drawHandsAndFeet(joints, figure.scale);
      if (figure.debug) this.drawDebug(figure);
      ctx.restore();
    }

    drawShadow(joints) {
      const ctx = this.ctx;
      const feet = [joints.footL, joints.footR];
      const center = new Vec2((feet[0].x + feet[1].x) / 2, Math.max(feet[0].y, feet[1].y) + 8);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, 64, 11, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    drawHead(neck, head, angle, scale) {
      const ctx = this.ctx;
      const radius = 21 * scale;
      ctx.save();
      ctx.fillStyle = '#071122';
      ctx.strokeStyle = this.theme.bone;
      ctx.lineWidth = Math.max(5, 5 * scale);
      ctx.beginPath();
      ctx.arc(head.x, head.y, radius, 0, TAU);
      ctx.fill();
      ctx.stroke();

      const eye = Vec2.add(head, Vec2.fromAngle(angle, radius * 0.42));
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, Math.max(3.2, 3.2 * scale), 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    drawHandsAndFeet(joints, scale) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = '#071122';
      ctx.strokeStyle = this.theme.bone;
      ctx.lineWidth = Math.max(3.5, 3.5 * scale);

      for (const key of ['handL', 'handR']) {
        const p = joints[key];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7.5 * scale, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      ctx.lineWidth = Math.max(5, 5 * scale);
      for (const key of ['footL', 'footR']) {
        const p = joints[key];
        ctx.beginPath();
        ctx.moveTo(p.x - 13 * scale, p.y);
        ctx.lineTo(p.x + 13 * scale, p.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawDebug(figure) {
      const ctx = this.ctx;
      const joints = figure.lastPose.joints;
      ctx.save();
      ctx.fillStyle = this.theme.joint;
      ctx.strokeStyle = 'rgba(120, 215, 255, 0.42)';
      ctx.lineWidth = 1;
      ctx.font = '11px system-ui, sans-serif';
      for (const [name, p] of Object.entries(joints)) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, TAU);
        ctx.fill();
        ctx.strokeText(name, p.x + 7, p.y - 5);
      }
      this.drawTarget(figure.smoothedTarget, 'IK');
      this.drawTarget(figure.lookTarget, 'LOOK');
      ctx.restore();
    }

    drawTarget(p, label = '') {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = this.theme.target;
      ctx.fillStyle = 'rgba(255, 209, 102, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x - 20, p.y);
      ctx.lineTo(p.x + 20, p.y);
      ctx.moveTo(p.x, p.y - 20);
      ctx.lineTo(p.x, p.y + 20);
      ctx.stroke();
      if (label) ctx.fillText(label, p.x + 18, p.y - 18);
      ctx.restore();
    }

    line(a, b) {
      if (!a || !b) return;
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  class InputController {
    constructor(canvas, figure, timeline) {
      this.canvas = canvas;
      this.figure = figure;
      this.timeline = timeline;
      this.keys = new Set();
      this.pointer = { x: 0, y: 0, active: false };
      this.bind();
    }

    bind() {
      window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        this.keys.add(key);
        if ([' ', 'w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowdown'].includes(key)) event.preventDefault();
        if (key === 'w') this.figure.jump();
        if (key === ' ') this.timeline.trigger('waveRight', 1.0);
      });

      window.addEventListener('keyup', (event) => {
        this.keys.delete(event.key.toLowerCase());
      });

      const updatePointer = (event) => {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = event.clientX - rect.left;
        this.pointer.y = event.clientY - rect.top;
        this.pointer.active = true;
        this.figure.target.set(this.pointer.x, this.pointer.y);
      };

      this.canvas.addEventListener('pointermove', updatePointer);
      this.canvas.addEventListener('pointerdown', (event) => {
        updatePointer(event);
        this.canvas.setPointerCapture?.(event.pointerId);
      });
      this.canvas.addEventListener('pointerleave', () => {
        this.pointer.active = false;
      });
    }

    update() {
      const left = this.keys.has('a') || this.keys.has('arrowleft');
      const right = this.keys.has('d') || this.keys.has('arrowright');
      const run = this.keys.has('shift');
      const crouch = this.keys.has('s') || this.keys.has('arrowdown');
      const horizontal = (right ? 1 : 0) - (left ? 1 : 0);

      if (crouch) {
        this.figure.setAction('crouch');
        this.figure.velocity.x = 0;
      } else {
        if (this.figure.action === 'crouch' && horizontal === 0) this.figure.setAction('idle');
        this.figure.move(horizontal, run);
      }
    }
  }

  function boot() {
    const canvas = document.querySelector('#stage');
    const renderer = new CanvasRenderer(canvas);
    const timeline = new ActionTimeline();
    const figure = new StickFigure({
      x: renderer.width * 0.5,
      y: renderer.height * 0.78,
      groundY: renderer.height * 0.78,
    });
    const input = new InputController(canvas, figure, timeline);

    const statusMode = document.querySelector('#statusMode');
    const statusFps = document.querySelector('#statusFps');
    const buttons = Array.from(document.querySelectorAll('[data-action]'));
    const reachToggle = document.querySelector('#reachToggle');
    const leftReachToggle = document.querySelector('#leftReachToggle');
    const footLockToggle = document.querySelector('#footLockToggle');
    const debugToggle = document.querySelector('#debugToggle');
    const energySlider = document.querySelector('#energySlider');
    const scaleSlider = document.querySelector('#scaleSlider');
    const smoothSlider = document.querySelector('#smoothSlider');
    const resetBtn = document.querySelector('#resetBtn');

    function markActive(action) {
      for (const button of buttons) {
        const a = button.dataset.action;
        const active = a === action || (a === 'waveRight' && timeline.activeGesture?.name === 'waveRight');
        button.classList.toggle('is-active', active);
      }
    }

    function modeLabel(mode) {
      const labels = {
        idle: 'Idle',
        walk: 'Andando',
        run: 'Correndo',
        crouch: 'Agachado',
        waveRight: 'Acenando',
        waveLeft: 'Acenando',
        jump: 'Pulando',
      };
      return labels[mode] ?? mode;
    }

    function resetFigure() {
      figure.reset(renderer.width * 0.5, renderer.height * 0.78);
      figure.target.set(renderer.width * 0.62, renderer.height * 0.35);
      timeline.set('idle');
      figure.setAction('idle');
      markActive('idle');
    }

    function createPublicApi(actor, actions) {
      return {
        actor,
        play(name) {
          actions.set(name);
          actor.setAction(name);
          return this;
        },
        jump() {
          actor.jump();
          return this;
        },
        wave(side = 'right') {
          actions.trigger(side === 'left' ? 'waveLeft' : 'waveRight', 1.0);
          return this;
        },
        reach(hand, x, y) {
          actor.target.set(x, y);
          actor.reachRight = hand === 'rightHand' || hand === 'both';
          actor.reachLeft = hand === 'leftHand' || hand === 'both';
          return this;
        },
        lookAt(x, y) {
          actor.target.set(x, y);
          return this;
        },
        setEnergy(value) {
          actor.energy = Number(value);
          return this;
        },
        setScale(value) {
          actor.scale = Number(value);
          return this;
        },
        setDebug(value) {
          actor.debug = Boolean(value);
          return this;
        },
      };
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'jump') {
          figure.jump();
        } else if (action === 'waveRight') {
          timeline.trigger('waveRight', 1.0);
        } else if (action === 'crouch' && figure.action === 'crouch') {
          timeline.set('idle');
          figure.setAction('idle');
        } else {
          timeline.set(action);
          figure.setAction(action);
        }
        markActive(action);
      });
    });

    reachToggle.addEventListener('input', () => { figure.reachRight = reachToggle.checked; });
    leftReachToggle.addEventListener('input', () => { figure.reachLeft = leftReachToggle.checked; });
    footLockToggle.addEventListener('input', () => { figure.footLock = footLockToggle.checked; });
    debugToggle.addEventListener('input', () => { figure.debug = debugToggle.checked; });
    energySlider.addEventListener('input', () => { figure.energy = Number(energySlider.value); });
    scaleSlider.addEventListener('input', () => { figure.scale = Number(scaleSlider.value); });
    smoothSlider.addEventListener('input', () => { figure.smoothing = Number(smoothSlider.value); });
    resetBtn.addEventListener('click', resetFigure);

    let last = performance.now();
    let fpsTime = 0;
    let fpsFrames = 0;
    let frameCount = 0;

    function updateStatus(dt) {
      fpsTime += dt;
      fpsFrames += 1;
      if (fpsTime >= 0.35) {
        statusFps.textContent = String(Math.round(fpsFrames / fpsTime));
        fpsTime = 0;
        fpsFrames = 0;
      }
      const mode = timeline.activeGesture?.name ?? figure.action;
      statusMode.textContent = modeLabel(mode);
      markActive(figure.action);
    }

    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
      last = now;
      renderer.resize();
      figure.groundY = renderer.height * 0.78;

      if (!input.pointer.active) {
        figure.target.set(
          renderer.width * 0.58 + Math.sin(now * 0.001) * 90,
          renderer.height * 0.38 + Math.cos(now * 0.0013) * 36
        );
      }

      input.update();
      timeline.update(dt);
      figure.gesture = timeline.activeGesture;
      figure.update(dt, { left: 80, right: renderer.width - 80 });

      renderer.clear();
      renderer.drawWorld(figure.groundY);
      renderer.drawStick(figure);

      frameCount += 1;
      if (frameCount === 1) statusFps.textContent = '...';
      updateStatus(dt);
      requestAnimationFrame(frame);
    }

    window.StickEngineDemo = createPublicApi(figure, timeline);
    resetFigure();
    requestAnimationFrame(frame);
  }

  function showBootError(error) {
    console.error(error);
    const box = document.querySelector('#bootError');
    const mode = document.querySelector('#statusMode');
    if (mode) mode.textContent = 'Erro';
    if (box) {
      box.hidden = false;
      box.textContent = `Erro ao iniciar a Stick Engine: ${error?.message || error}. Abra o console do navegador para detalhes.`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { boot(); } catch (error) { showBootError(error); }
    });
  } else {
    try { boot(); } catch (error) { showBootError(error); }
  }
})();
