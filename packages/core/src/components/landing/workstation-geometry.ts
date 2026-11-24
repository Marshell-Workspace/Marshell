import { growthState } from "./ascii-timeline";

export const WORKSTATION = {
  laptopY: 0,
  laptopBottom: 44,
  keyboardTop: 27,
  keyboardBottom: 39,
  tableTop: 45,
  tableFront: 58,
  tableBottom: 68,
  floor: 236,
  hoverSize: 128,
  screenAvatarSize: 75,
  progressLeft: -50,
  progressRight: 134,
  progressY: -242,
} as const;

export function progressGeometry(time: number) {
  const state = growthState(time);
  return {
    ...state,
    left: WORKSTATION.progressLeft,
    right:
      WORKSTATION.progressLeft +
      (WORKSTATION.progressRight - WORKSTATION.progressLeft) * state.fraction,
  };
}

export function typingPose(time: number, near: boolean) {
  const breath = Math.sin(time * 1.3) * 0.8;
  return {
    shoulder: near
      ? ([-140, -85 + breath] as const)
      : ([-171, -82 + breath] as const),
    elbow: near
      ? ([-89, 16 + breath * 0.35] as const)
      : ([-111, 12 + breath * 0.35] as const),
    wrist: near ? ([13, 30] as const) : ([-5, 27] as const),
    fingerLift: (1 + Math.sin(time * 5.2 + (near ? 0 : 2))) * 0.65,
  };
}
