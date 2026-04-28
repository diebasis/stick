(() => {
  'use strict';

  const engine = StickEngine.create(document.querySelector('#stage'));
  const authoring = StickEngineAuthoring;
  const motionLib = new authoring.MotionLibrary().importJSON(authoring.DEFAULT_MOTION_LIBRARY.exportJSON(false));

  const pointer = { active: false, x: 0, y: 0, dragging: null };
  const keys = new Set();

  const statusEl = document.querySelector('#status');
  const poseSelect = document.querySelector('#poseSelect');
  const poseJson = document.querySelector('#poseJson');
  const timelineName = document.querySelector('#timelineName');
  const timelineJson = document.querySelector('#timelineJson');
  const motionSelect = document.querySelector('#motionSelect');

  let activeTimeline = null;

  function refreshPoses() {
    const cur = poseSelect.value || 'idle';
    poseSelect.innerHTML = engine.listPoses().map(p => `<option value="${p}">${p}</option>`).join('');
    if (engine.listPoses().includes(cur)) poseSelect.value = cur;
  }

  function refreshMotions() {
    const cur = motionSelect.value || motionLib.list()[0] || '';
    motionSelect.innerHTML = motionLib.list().map(m => `<option value="${m}">${m}</option>`).join('');
    if (motionLib.list().includes(cur)) motionSelect.value = cur;
  }

  function updateStatus() {
    statusEl.textContent = JSON.stringify({
      engine: engine.getState(),
      activeTimeline: activeTimeline ? activeTimeline.toJSON() : null,
    }, null, 2);
  }

  function selectedCharacter() { return engine.getCharacter(); }

  function applyKeyboard() {
    const c = selectedCharacter();
    if (!c) return;

    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');
    const run = keys.has('shift');
    const crouch = keys.has('s') || keys.has('arrowdown');

    if (crouch) { engine.play('crouch'); return; }
    if (left || right) {
      c.facing = right ? 1 : -1;
      engine.play(run ? 'run' : 'walk');
      return;
    }

    const base = c.track.topBase()?.name;
    if (base === 'walk' || base === 'run' || base === 'crouch') engine.play('idle');
  }

  function autoLook(now) {
    if (pointer.active) return;
    engine.lookAt(engine.renderer.width * 0.58 + Math.sin(now * 0.001) * 100, engine.renderer.height * 0.38 + Math.cos(now * 0.0014) * 36);
  }

  function nearestJoint(c, x, y, r = 24) {
    let best = null;
    let bestSq = r * r;
    for (const [name, p] of Object.entries(c.joints)) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestSq) { bestSq = d; best = name; }
    }
    return best;
  }

  function applyTimeline(dt) {
    if (!activeTimeline) return;
    const c = selectedCharacter();
    if (!c) return;
    const sample = activeTimeline.update(dt);
    c.poseBias = { ...c.poseBias, ...sample };
  }

  // Action buttons
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'jump') engine.jump();
      else if (action === 'wave') engine.overlay('wave');
      else engine.play(action);
    });
  });

  document.querySelector('#addCharacterBtn').addEventListener('click', () => {
    const offset = (engine.characters.length - 1) * 100;
    const c = engine.addCharacter({ x: engine.renderer.width * 0.45 + offset, y: engine.renderer.height * 0.78, scale: 1 });
    engine.selectCharacter(c.id);
    const sel = document.querySelector('#characterSelect');
    sel.innerHTML = engine.characters.map(ch => `<option value="${ch.id}">${ch.id}</option>`).join('');
    sel.value = c.id;
  });

  document.querySelector('#removeCharacterBtn').addEventListener('click', () => {
    if (engine.characters.length <= 1) return;
    engine.removeCharacter(engine.activeCharacterId);
    const sel = document.querySelector('#characterSelect');
    sel.innerHTML = engine.characters.map(ch => `<option value="${ch.id}">${ch.id}</option>`).join('');
    sel.value = engine.activeCharacterId;
  });

  const charSel = document.querySelector('#characterSelect');
  charSel.innerHTML = engine.characters.map(ch => `<option value="${ch.id}">${ch.id}</option>`).join('');
  charSel.addEventListener('change', () => engine.selectCharacter(charSel.value));

  // parameter controls
  document.querySelector('#energy').addEventListener('input', (e) => engine.setEnergy(e.target.value));
  document.querySelector('#scale').addEventListener('input', (e) => engine.setScale(e.target.value));
  document.querySelector('#smoothing').addEventListener('input', (e) => engine.setSmoothing(e.target.value));
  document.querySelector('#debug').addEventListener('input', (e) => engine.setDebug(e.target.checked));

  // poses
  refreshPoses();
  poseJson.value = engine.exportPosesJSON(true);
  poseSelect.addEventListener('change', () => {
    const pose = engine.getPose(poseSelect.value);
    poseJson.value = pose ? JSON.stringify(pose, null, 2) : '';
  });
  document.querySelector('#poseSaveBtn').addEventListener('click', () => {
    const c = selectedCharacter();
    if (!c) return;
    engine.registerPose(poseSelect.value || 'custom', {
      torsoLeanDeg: c.poseBias.torsoLeanDeg ?? 0,
      headTiltDeg: c.poseBias.headTiltDeg ?? 0,
      armLift: c.poseBias.armLift ?? 0,
      hipDrop: c.poseBias.hipDrop ?? 0,
    });
    refreshPoses();
    poseJson.value = engine.exportPosesJSON(true);
  });
  document.querySelector('#poseExportBtn').addEventListener('click', () => poseJson.value = engine.exportPosesJSON(true));
  document.querySelector('#poseImportBtn').addEventListener('click', () => {
    try { engine.importPosesJSON(poseJson.value); refreshPoses(); }
    catch (e) { alert(`Erro no JSON de poses: ${e.message}`); }
  });

  // timeline + motion library
  refreshMotions();
  timelineJson.value = JSON.stringify(motionLib.getMotion(motionSelect.value)?.toJSON() ?? {}, null, 2);
  motionSelect.addEventListener('change', () => {
    timelineJson.value = JSON.stringify(motionLib.getMotion(motionSelect.value)?.toJSON() ?? {}, null, 2);
  });

  document.querySelector('#timelineNewBtn').addEventListener('click', () => {
    activeTimeline = new authoring.Timeline({ duration: 1.0, loop: true, tracks: {} });
    timelineName.value = 'custom_motion';
    timelineJson.value = JSON.stringify(activeTimeline.toJSON(), null, 2);
  });

  document.querySelector('#timelineLoadBtn').addEventListener('click', () => {
    try {
      activeTimeline = authoring.Timeline.fromJSON(timelineJson.value).play(true);
      timelineName.value = timelineName.value || 'loaded_motion';
    } catch (e) {
      alert(`Timeline inválida: ${e.message}`);
    }
  });

  document.querySelector('#timelineSaveLibBtn').addEventListener('click', () => {
    if (!activeTimeline) return;
    const name = timelineName.value.trim() || 'custom_motion';
    motionLib.setMotion(name, activeTimeline);
    refreshMotions();
  });

  document.querySelector('#timelinePlayBtn').addEventListener('click', () => {
    const motion = motionLib.getMotion(motionSelect.value);
    if (!motion) return;
    activeTimeline = motion.play(true);
    timelineJson.value = JSON.stringify(activeTimeline.toJSON(), null, 2);
  });

  document.querySelector('#timelineStopBtn').addEventListener('click', () => {
    if (activeTimeline) activeTimeline.pause();
  });

  document.querySelector('#motionExportBtn').addEventListener('click', () => {
    timelineJson.value = motionLib.exportJSON(true);
  });

  document.querySelector('#motionImportBtn').addEventListener('click', () => {
    try {
      motionLib.importJSON(timelineJson.value);
      refreshMotions();
    } catch (e) {
      alert(`Motion library inválida: ${e.message}`);
    }
  });

  // input handlers
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keys.add(key);
    if ([' ', 'w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowdown'].includes(key)) event.preventDefault();
    if (key === 'w') engine.jump();
    if (key === ' ') engine.overlay('wave');
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

  const editorToggle = document.querySelector('#editorToggle');
  const canvas = document.querySelector('#stage');
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;

    const c = selectedCharacter();
    if (!c) return;
    if (editorToggle.checked && pointer.dragging) {
      if (pointer.dragging === 'head') c.poseBias.headTiltDeg = (pointer.x - c.joints.neck.x) * 0.2;
      if (pointer.dragging.startsWith('hand')) c.poseBias.armLift = Math.max(-20, Math.min(30, (c.joints.hip.y - pointer.y) * 0.05));
      if (pointer.dragging === 'hip') c.poseBias.hipDrop = Math.max(-25, Math.min(35, (pointer.y - c.joints.hip.y) * 0.2));
      return;
    }
    engine.lookAt(pointer.x, pointer.y);
  });
  canvas.addEventListener('pointerdown', () => {
    const c = selectedCharacter();
    if (!c || !editorToggle.checked) return;
    pointer.dragging = nearestJoint(c, pointer.x, pointer.y, 28);
  });
  canvas.addEventListener('pointerup', () => { pointer.dragging = null; });
  canvas.addEventListener('pointerleave', () => { pointer.active = false; pointer.dragging = null; });

  // engine hooks
  engine.onBeforeFrame = ({ now, dt }) => {
    autoLook(now);
    applyKeyboard();
    applyTimeline(dt);
  };
  engine.onAfterFrame = () => updateStatus();

  engine.setDebug(true);
  engine.start();
  window.StickEngineApp = { engine, motionLib };
})();
