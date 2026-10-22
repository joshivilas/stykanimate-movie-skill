'use strict';

const A = require('../scripts/animation.cjs');

module.exports = function buildExample() {
  const rig = A.createRig({ id: 2, name: 'Example actor' });
  const sky = A.figureType(1, 'Backdrop', [A.segment(1, 0, 960, 1100, '#edf1df', 'Sky')]);
  const floor = A.figureType(3, 'Ground', [A.segment(1, 0, 960, 3, '#9eb5a1', 'Floor')]);
  const finish = A.walkPose(rig, { fromX: 220, toX: 480, start: 0, end: 6, time: 6, ground: 440 }).pose;
  const wave = structuredClone(finish);
  wave.hands[1] = [finish.hip[0] + 30, finish.hip[1] - rig.torso - 28];
  const gesture = A.track([[6, finish], [7, wave], [8, wave], [9, finish]], { poses: true });
  return A.createMovie({
    name: 'Walk and wave', seconds: 10, types: [sky, rig.type, floor],
    sample(time) {
      const pose = time < 6
        ? A.walkPose(rig, { fromX: 220, toX: 480, start: 0, end: 6, time, ground: 440 }).pose
        : gesture(time);
      if (time > 7 && time < 8) pose.hands[1][0] += Math.sin((time - 7) * Math.PI * 4) * 4;
      const actor = A.solveActor(rig, pose, { time });
      return [
        A.object({ id: 1, typeId: 1, x: 0, y: 270, angles: [0] }),
        A.object({ id: 3, typeId: 3, x: 0, y: 445, angles: [0] }),
        actor.object
      ];
    }
  });
};
