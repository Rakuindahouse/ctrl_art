export interface WindowConfig {
  width: number;
  height: number;
  alwaysOnTop: boolean;
}

export interface GamepadConfig {
  deadzone: number;
  moveSpeed: number;
  scaleSpeed: number;
  gamepadIndex: number; // -1 = 最初に見つかったもの自動選択
}

export interface FloatAnimConfig {
  amplitude: number;
  period: number;
}

export interface AnimationConfig {
  float: {
    enabled: boolean;
    vertical: FloatAnimConfig;
    horizontal: FloatAnimConfig;
  };
}

export interface LipSyncConfig {
  enabled: boolean;
  micDeviceId: string;
  threshold: number;
  closeDelay: number;
  useMouthClosed: boolean;
}

export interface MouthPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CostumeConfig {
  id: string;
  expressions: string[];
  mouthOpenPath?: string;
  mouthClosedPath?: string;
  mouthPosition?: MouthPosition;
}

export interface ButtonMap {
  expr1: number;
  expr2: number;
  expr3: number;
  expr4: number;
  expr5: number;
  toggleFloat: number;
  toggleLipSync: number;
  resetHold: number;
  openSettings: number;
  prevCostume: number;
  nextCostume: number;
  prevCharacter: number;
  nextCharacter: number;
}

export interface CharacterConfig {
  id: string;
  name: string;
  defaultPosition: { x: number; y: number };
  defaultScale?: { x: number; y: number };
  costumes: CostumeConfig[];
}

export interface LastState {
  characterIndex: number;
  costumeIndex: number;
  expressionIndex: number;
  position: { x: number; y: number };
  scale: { x: number; y: number };
  floatEnabled: boolean;
  lipSyncEnabled: boolean;
}

export interface AppConfig {
  window: WindowConfig;
  gamepad: GamepadConfig;
  animation: AnimationConfig;
  lipsync: LipSyncConfig;
  buttonMap: ButtonMap;
  characters: CharacterConfig[];
  lastState?: LastState;
}
