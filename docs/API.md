# API — Stick Engine Studio

## Engine runtime (`engine/stick-engine.js`)

### Criação
```js
const engine = StickEngine.create(canvas, options);
```

### Personagens
- `engine.addCharacter(options)`
- `engine.removeCharacter(id)`
- `engine.getCharacter(id?)`
- `engine.selectCharacter(id)`

### Ações
- `engine.play(action, characterId?)`
- `engine.overlay(action, characterId?)`
- `engine.jump(characterId?)`
- `engine.crouch(enabled, characterId?)`
- `engine.stop(characterId?)`

### IK e parâmetros
- `engine.lookAt(x, y, characterId?)`
- `engine.reach('rightHand'|'leftHand'|'both', x, y, characterId?)`
- `engine.setFacing('left'|'right'|-1|1, characterId?)`
- `engine.setEnergy(value, characterId?)`
- `engine.setScale(value, characterId?)`
- `engine.setSmoothing(value, characterId?)`
- `engine.setFootLock(boolean, characterId?)`
- `engine.setReach(rightEnabled, leftEnabled, characterId?)`
- `engine.setDebug(boolean, characterId?)`

### Poses
- `engine.listPoses()`
- `engine.getPose(name)`
- `engine.registerPose(name, def)`
- `engine.removePose(name)`
- `engine.exportPosesJSON(pretty?)`
- `engine.importPosesJSON(text)`

Formato de pose:
```json
{
  "torsoLeanDeg": 0,
  "headTiltDeg": 0,
  "armLift": 0,
  "hipDrop": 0
}
```

### Runtime
- `engine.start()`
- `engine.pause()`
- `engine.step(dt)`
- hooks:
  - `engine.onBeforeFrame = ({dt, now, engine}) => {}`
  - `engine.onAfterFrame = ({dt, now, engine}) => {}`

### Estado
- `engine.getState(characterId?)`

---

## Authoring (`engine/authoring.js`)

### Timeline
```js
const tl = new StickEngineAuthoring.Timeline({ duration: 1, loop: true });
tl.addKey('armLift', 0, 0);
tl.addKey('armLift', 1, 12);
tl.play(true);
```

Métodos:
- `addKey(trackName, time, value)`
- `removeKey(trackName, index)`
- `valueAt(trackName, t)`
- `sample(t?)`
- `play(reset?)`
- `pause()`
- `update(dt)`
- `toJSON()`
- `Timeline.fromJSON(json)`

### MotionLibrary (versionada)
```js
const lib = new StickEngineAuthoring.MotionLibrary({ version: '1.0.0' });
lib.setMotion('wave_upper', timeline);
const json = lib.exportJSON(true);
lib.importJSON(json);
```

Métodos:
- `setMotion(name, timelineOrJson)`
- `getMotion(name)`
- `list()`
- `importJSON(json)`
- `exportJSON(pretty?)`
