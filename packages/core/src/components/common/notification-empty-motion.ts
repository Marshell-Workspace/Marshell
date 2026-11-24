/** All coordinates are in the illustration's 380-unit-wide SVG space. */
export interface ScenePoint {
  x: number;
  y: number;
}

export interface NotificationSceneGeometry {
  anchor: ScenePoint;
  card: { height: number; width: number; x: number; y: number };
  height: number;
  scale: number;
}

export const SCENE_DURATION_SECONDS = 3.2;
export const DEFAULT_SCENE_GEOMETRY: NotificationSceneGeometry = {
  anchor: { x: 233, y: 152 },
  card: { x: 131, y: 143, width: 234, height: 136 },
  height: 300,
  scale: 1,
};

const SHOULDER = { x: 131, y: 99 };
const ARM_SCALE = 0.047;
const PALM_RADIUS = Math.hypot(1630, 178) * ARM_SCALE;
// Lower the held card enough to reveal its heading before the pull.
const RAISED_ANGLE = -12;
const PULLED_ANGLE = 15;
const CATCH_START = 0.76;
const CATCH_OFFSET = -10;
const CATCH_VELOCITY = 280;
const LANDING_DAMPING = 15;
const LANDING_FREQUENCY = 8;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const phase = (p: number, start: number, end: number) =>
  Math.max(0, Math.min(1, (p - start) / (end - start)));
const smooth = (t: number) => t * t * (3 - 2 * t);
const reachEase = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function rotate(point: ScenePoint, pivot: ScenePoint, degrees: number) {
  const angle = (degrees * Math.PI) / 180;
  const x = point.x - pivot.x;
  const y = point.y - pivot.y;
  return {
    x: pivot.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: pivot.y + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

/** Fixed-length painted links; the cuff and hand stay together on the forearm. */
function armPose(angle: number, elbowBend = 0) {
  const lower = rotate({ x: 880, y: 28 }, { x: 0, y: 0 }, -elbowBend);
  const vector = { x: 750 + lower.x, y: 150 + lower.y };
  const radius = Math.hypot(vector.x, vector.y) * ARM_SCALE;
  const artworkAngle = angle - (Math.atan2(vector.y, vector.x) * 180) / Math.PI;
  const palm = rotate(
    { x: SHOULDER.x + radius, y: SHOULDER.y },
    SHOULDER,
    angle
  );
  const transform = `translate(${SHOULDER.x}px, ${SHOULDER.y}px) rotate(${artworkAngle}deg) scale(${ARM_SCALE}) translate(-180px, -300px)`;
  // The shoulder cap follows the sleeve silhouette instead of exposing a
  // rectangular body crop or a separately pasted circular patch.
  const shoulderEdge = (x: number, y: number) =>
    rotate(
      {
        x: SHOULDER.x + (x - 180) * ARM_SCALE,
        y: SHOULDER.y + (y - 300) * ARM_SCALE,
      },
      SHOULDER,
      artworkAngle
    );
  const top = shoulderEdge(410, 127);
  const bottom = shoulderEdge(410, 510);
  const shoulderPath = `M117 89 Q128 88 ${top.x} ${top.y} L${bottom.x} ${bottom.y} Q128 110 120 112 Z`;
  const forearmTransform = `${transform} translate(930px, 450px) rotate(${-elbowBend}deg) translate(-930px, -450px)`;
  return {
    palm,
    radius,
    shoulderPath,
    artworkAngle: artworkAngle - elbowBend,
    transform,
    forearmTransform,
  };
}

/**
 * Reach → close grip → pull with contact → release → rope catch → rest.
 * During the grip the palm is derived from the card, never a separate tween.
 */
export function notificationSceneFrame(
  p: number,
  geometry: NotificationSceneGeometry
) {
  const bodyY = geometry.height - 300;
  const raisedHandY = bodyY + armPose(RAISED_ANGLE, 10).palm.y;
  const gripEdgeY = geometry.card.y + geometry.card.height - 3;
  const peekY = raisedHandY - gripEdgeY;
  const hiddenY = -geometry.card.y - geometry.card.height - 26;
  const pullEndY = bodyY + armPose(PULLED_ANGLE, 18).palm.y - gripEdgeY;
  const catchTime = Math.max(0, p - CATCH_START) * SCENE_DURATION_SECONDS;
  // Match the incoming velocity at the rope catch. One small compression then
  // dissipates, rather than restarting a bouncy oscillation at impact.
  const catchSine =
    (CATCH_VELOCITY + LANDING_DAMPING * CATCH_OFFSET) / LANDING_FREQUENCY;
  const landing =
    Math.exp(-LANDING_DAMPING * catchTime) *
    (CATCH_OFFSET * Math.cos(LANDING_FREQUENCY * catchTime) +
      catchSine * Math.sin(LANDING_FREQUENCY * catchTime));
  let cardY = mix(hiddenY, peekY, smooth(phase(p, 0.03, 0.18)));
  if (p >= 0.36) {
    cardY = mix(peekY, pullEndY, smooth(phase(p, 0.36, 0.56)));
  }
  if (p >= 0.61) {
    const fall = phase(p, 0.61, CATCH_START);
    const tangent =
      CATCH_VELOCITY * (CATCH_START - 0.61) * SCENE_DURATION_SECONDS;
    cardY =
      pullEndY * (2 * fall ** 3 - 3 * fall ** 2 + 1) +
      CATCH_OFFSET * (-2 * fall ** 3 + 3 * fall ** 2) +
      tangent * (fall ** 3 - fall ** 2);
  }
  if (p >= CATCH_START) {
    cardY = p === 1 ? 0 : landing;
  }
  const cardAngle =
    p < 0.61
      ? 0
      : p < CATCH_START
        ? 0.85 * smooth(phase(p, 0.61, CATCH_START))
        : p === 1
          ? 0
          : 0.85 * (1 + 12 * catchTime) * Math.exp(-12 * catchTime);
  // Build a small elbow bend as effort increases, then relax it onto the card.
  // Fixed link lengths and a shared cuff/hand prevent stretching or wrist twisting.
  const elbowBend =
    (10 * reachEase(phase(p, 0.1, 0.29)) + 8 * smooth(phase(p, 0.36, 0.56))) *
    (1 - smooth(phase(p, 0.61, 0.99)));
  const radius = armPose(0, elbowBend).radius;
  const restY = geometry.card.y - 2 - bodyY;
  const restAngle =
    (Math.asin(Math.max(-1, Math.min(1, (restY - SHOULDER.y) / PALM_RADIUS))) *
      180) /
    Math.PI;
  let angle = mix(48, RAISED_ANGLE, reachEase(phase(p, 0.1, 0.29)));
  if (p >= 0.36 && p <= 0.61) {
    // Derive the angle from the card edge to maintain exact vertical contact.
    angle =
      (Math.asin((gripEdgeY + cardY - bodyY - SHOULDER.y) / radius) * 180) /
      Math.PI;
  } else if (p > 0.61) {
    angle = mix(PULLED_ANGLE, restAngle, smooth(phase(p, 0.61, 0.99)));
  }
  const arm = armPose(angle, elbowBend);
  const localHand = arm.palm;
  const hand = { x: localHand.x, y: localHand.y + bodyY };
  const gripAmount =
    smooth(phase(p, 0.27, 0.32)) * (1 - smooth(phase(p, 0.56, 0.61)));
  const openHandAngle = arm.artworkAngle;
  const bellAngle =
    p < CATCH_START || p === 1
      ? 0
      : 14 * Math.exp(-7 * catchTime) * Math.sin(25 * catchTime);
  const impactProgress = phase(p, CATCH_START, 0.95);
  const impactOpacity =
    p >= CATCH_START && p < 0.95
      ? Math.sin(Math.PI * impactProgress) * (1 - impactProgress)
      : 0;
  return {
    upperArmTransform: arm.transform,
    shoulderPath: arm.shoulderPath,
    forearmTransform: arm.forearmTransform,
    elbowBend,
    wristFlex: 0,
    shoulderAngle: angle,
    bellAngle,
    bodyTransform: `translateY(${bodyY}px)`,
    cardAngle,
    cardY,
    gripAmount,
    hand,
    handTransform: `translate(${localHand.x}px, ${localHand.y}px)`,
    openHandAngle,
    impactOpacity,
    impactProgress,
    headAngle:
      -3 * smooth(phase(p, 0.08, 0.29)) +
      3 * smooth(phase(p, 0.36, 0.56)) +
      2 * smooth(phase(p, 0.76, 0.84)) -
      2 * smooth(phase(p, 0.84, 0.96)),
    reach: arm.radius,
    ropePath: `M${geometry.anchor.x} -8 V${Math.max(0, geometry.anchor.y + cardY)}`,
  };
}
