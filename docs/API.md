# Stick Engine API (v1.0.0-experimental)

## Inicialização

```js
const engine = StickEngine.create(canvas, {
  boundsPadding: 80,
  poses: { ... },
  actions: { ... }
});
```

## Runtime principal

- `engine.start()` / `engine.pause()` / `engine.step(dt)`
- `engine.onBeforeFrame = ({dt, now, engine}) => {}`
- `engine.onAfterFrame = ({dt, now, engine}) => {}`

## Personagens

- `engine.addCharacter(options)`
- `engine.removeCharacter(id)`
- `engine.getCharacter(id?)`
- `engine.selectCharacter(id)`

## Ações

- `engine.play(name, characterId?)`
- `engine.overlay(name, characterId?)` (ações sobrepostas, ex.: wave)
- `engine.jump(characterId?)`
- `engine.crouch(enabled, characterId?)`
- `engine.stop(characterId?)`

## IK e alvo

- `engine.lookAt(x, y, characterId?)`
- `engine.reach('rightHand'|'leftHand'|'both', x, y, characterId?)`

## Ajustes

- `engine.setFacing('left'|'right'|-1|1, characterId?)`
- `engine.setEnergy(value, characterId?)`
- `engine.setScale(value, characterId?)`
- `engine.setSmoothing(value, characterId?)`
- `engine.setFootLock(boolean, characterId?)`
- `engine.setReach(rightEnabled, leftEnabled, characterId?)`
- `engine.setDebug(boolean, characterId?)`

## Poses

- `engine.listPoses()`
- `engine.getPose(name)`
- `engine.registerPose(name, poseDef)`
- `engine.removePose(name)`
- `engine.exportPosesJSON(pretty?)`
- `engine.importPosesJSON(jsonText)`

### Formato JSON de pose

```json
{
  "idle": {
    "torsoLeanDeg": 0,
    "headTiltDeg": 0,
    "armLift": 0,
    "hipDrop": 0
  },
  "wave": {
    "torsoLeanDeg": 2,
    "headTiltDeg": 0,
    "armLift": 14,
    "hipDrop": 0
  }
}
```

## Estado

- `engine.getState(characterId?)` retorna FPS, personagem ativo, ação base, ação overlay e parâmetros.