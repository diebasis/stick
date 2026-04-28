const test = require('node:test');
const assert = require('node:assert/strict');

const { Timeline, MotionLibrary, DEFAULT_MOTION_LIBRARY } = require('../engine/authoring.js');

test('Timeline interpolates keyframes', () => {
  const tl = new Timeline({ duration: 1, loop: false, tracks: {} });
  tl.addKey('armLift', 0, 0).addKey('armLift', 1, 10);
  assert.equal(tl.valueAt('armLift', 0.5), 5);
});

test('Timeline play/update stops when loop false', () => {
  const tl = new Timeline({ duration: 1, loop: false, tracks: { v: [{ time: 0, value: 0 }, { time: 1, value: 1 }] } });
  tl.play(true);
  tl.update(1.2);
  assert.equal(tl.playing, false);
  assert.equal(tl.time, 1);
});

test('MotionLibrary imports/exports and returns timeline', () => {
  const lib = new MotionLibrary();
  lib.importJSON(DEFAULT_MOTION_LIBRARY.exportJSON(false));
  const names = lib.list();
  assert.ok(names.includes('wave_upper'));
  const motion = lib.getMotion('wave_upper');
  assert.ok(motion instanceof Timeline);
});
