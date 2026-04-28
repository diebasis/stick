(() => {
  'use strict';

  const canvas = document.querySelector('#stage');
  const statusEl = document.querySelector('#status');
  const characterSelect = document.querySelector('#characterSelect');
  const poseSelect = document.querySelector('#poseSelect');
  const poseJson = document.querySelector('#poseJson');

  const engine = window.StickEngine.create(canvas);
  const pointer = { active: false, x: 0, y: 0, draggingJoint: null };
  const keys = new Set();

  function refreshCharacterSelect() {
    const current = engine.activeCharacterId;
    characterSelect.innerHTML = engine.characters.map(c => `<option value="${c.id}">${c.id}</option>`).join('');
    characterSelect.value = current;
  }

  function refreshPoseSelect() {
    const current = poseSelect.value || 'idle';
    poseSelect.innerHTML = engine.listPoses().map(name => `<option value="${name}">${name}</option>`).join('');
    if (engine.listPoses().includes(current)) poseSelect.value = current;
  }

  function selectedCharacter() { return engine.getCharacter(); }

  function applyKeyboard() {
    const c = selectedCharacter();
    if (!c) return;
    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');
    const run = keys.has('shift');
    const crouch = keys.has('s') || keys.has('arrowdown');

    if (crouch) { engine.crouch(true); return; }
    if (left || right) {
      c.facing = right ? 1 : -1;
      engine.play(run ? 'run' : 'walk');
      return;
    }
    const base = c.track.topBase()?.name;
    if (base === 'walk' || base === 'run' || base === 'crouch') engine.play('idle');
  }

  function findNearestJoint(character, x, y, radius = 20) {
    let best = null;
    let bestDist = radius * radius;
    for (const [name, p] of Object.entries(character.joints)) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = name; }
    }
    return best;
  }

  function updateStatus() {
    const state = engine.getState();
    statusEl.textContent = JSON.stringify(state, null, 2);
  }

  function autoLook(now) {
    if (pointer.active) return;
    engine.lookAt(engine.renderer.width * 0.58 + Math.sin(now * 0.001) * 120, engine.renderer.height * 0.38 + Math.cos(now * 0.0014) * 44);
  }

  // Ações
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'jump') engine.jump();
      else if (action === 'wave') engine.overlay('wave');
      else engine.play(action);
    });
  });

  // Personagens
  document.querySelector('#addCharacterBtn').addEventListener('click', () => {
    const offset = (engine.characters.length - 1) * 80;
    const c = engine.addCharacter({ x: engine.renderer.width * 0.5 + offset, y: engine.renderer.height * 0.78, scale: 1 });
    engine.selectCharacter(c.id);
    refreshCharacterSelect();
  });

  document.querySelector('#removeCharacterBtn').addEventListener('click', () => {
    if (engine.characters.length <= 1) return;
    engine.removeCharacter(engine.activeCharacterId);
    refreshCharacterSelect();
  });

  characterSelect.addEventListener('change', () => engine.selectCharacter(characterSelect.value));

  // Parâmetros
  document.querySelector('#energy').addEventListener('input', (e) => engine.setEnergy(e.target.value));
  document.querySelector('#scale').addEventListener('input', (e) => engine.setScale(e.target.value));
  document.querySelector('#smoothing').addEventListener('input', (e) => engine.setSmoothing(e.target.value));

  // Pose Editor
  document.querySelector('#savePoseBtn').addEventListener('click', () => {
    const name = poseSelect.value || 'customPose';
    const c = selectedCharacter();
    if (!c) return;
    const def = {
      torsoLeanDeg: c.poseBias.torsoLeanDeg ?? 0,
      headTiltDeg: c.poseBias.headTiltDeg ?? 0,
      armLift: c.poseBias.armLift ?? 0,
      hipDrop: c.poseBias.hipDrop ?? 0,
    };
    engine.registerPose(name, def);
    refreshPoseSelect();
    poseJson.value = JSON.stringify(engine.getPose(name), null, 2);
  });

  document.querySelector('#previewPoseBtn').addEventListener('click', () => {
    const name = poseSelect.value;
    const p = engine.getPose(name);
    if (!p) return;
    const c = selectedCharacter();
    c.poseBias = { ...p };
  });

  document.querySelector('#loadPoseBtn').addEventListener('click', () => {
    try {
      engine.importPosesJSON(poseJson.value);
      refreshPoseSelect();
    } catch (error) {
      alert(`JSON inválido: ${error.message}`);
    }
  });

  document.querySelector('#exportPoseBtn').addEventListener('click', () => {
    poseJson.value = engine.exportPosesJSON(true);
  });

  poseSelect.addEventListener('change', () => {
    const pose = engine.getPose(poseSelect.value);
    poseJson.value = pose ? JSON.stringify(pose, null, 2) : '';
  });

  // Input
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keys.add(key);
    if ([' ', 'w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowdown'].includes(key)) event.preventDefault();
    if (key === 'w') engine.jump();
    if (key === ' ') engine.overlay('wave');
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;

    const c = selectedCharacter();
    if (!c) return;

    if (document.querySelector('#editorToggle').checked && pointer.draggingJoint) {
      // editor simples: drag altera poseBias por heurística
      if (pointer.draggingJoint === 'head') c.poseBias.headTiltDeg = (pointer.x - c.joints.neck.x) * 0.2;
      if (pointer.draggingJoint.startsWith('hand')) c.poseBias.armLift = clamp((c.joints.hip.y - pointer.y) * 0.05, -20, 30);
      if (pointer.draggingJoint === 'hip') c.poseBias.hipDrop = clamp((pointer.y - c.joints.hip.y) * 0.2, -25, 35);
      return;
    }

    engine.lookAt(pointer.x, pointer.y);
  });

  canvas.addEventListener('pointerdown', () => {
    const c = selectedCharacter();
    if (!c) return;
    if (document.querySelector('#editorToggle').checked) {
      pointer.draggingJoint = findNearestJoint(c, pointer.x, pointer.y, 28);
    }
  });

  canvas.addEventListener('pointerup', () => { pointer.draggingJoint = null; });
  canvas.addEventListener('pointerleave', () => { pointer.active = false; pointer.draggingJoint = null; });

  // Helpers
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // Loop hooks
  engine.onBeforeFrame = ({ now }) => {
    autoLook(now);
    applyKeyboard();
  };
  engine.onAfterFrame = () => updateStatus();

  // Init
  refreshCharacterSelect();
  refreshPoseSelect();
  poseJson.value = engine.exportPosesJSON(true);
  engine.setDebug(true);
  engine.start();

  window.StickEngineDemo = engine;
})();