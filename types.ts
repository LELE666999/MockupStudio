
import React from 'react';

export type Mode = 'simple' | 'fbx' | 'stl';
export type MaterialPreset = 'matte' | 'aluminum' | 'titanium' | 'gold' | 'plastic';
// NEW: Added 'universal' mode
export type TransformMode = 'translate' | 'rotate' | 'scale' | 'universal';
export type TransformSpace = 'world' | 'local';
export type LightingMode = 'realistic' | 'flat';
export type ShadowType = 'none' | 'floor' | 'wall';
export type ExportResolution = '1080p' | '2k' | '4k' | '8k';

export interface ShadowConfig {
  type: ShadowType;
  opacity: number;
  blur: number;
  color: string;
  offset: number;
}

export interface TextConfig {
  id: string;
  content: string;
  font: string | null;
  fontSize: number;
  visible: boolean; // Added visibility control

  // Transform
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;

  // Appearance
  color: string;
  opacity: number;

  // Effects
  blur: number;
  glow: number;
}

// NEW: Interface for internal FBX meshes
export interface FBXSubMesh {
    name: string;
    visible: boolean;
    locked?: boolean; // If true, cannot be selected for screen mapping
}

export interface ModelConfig {
  simpleStyle?: 'slab' | 'fold';
  /** Inner opening angle: 0 closed, 180 flat. */
  foldAngle?: number;
  coverScreenshot?: string | null;
  coverScreenshotType?: 'image' | 'video';
  initialTransform?: {position:[number,number,number];rotation:[number,number,number];scale:number};
  bodyColorLocked?: boolean;
  sourceFile?: string;
  modelFormat?: 'fbx' | 'stl' | 'glb';
  id: string;
  name: string;
  visible: boolean;
  mode: Mode;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  width: number;
  height: number;
  depth: number;
  radius: number;
  edgeColor: string;
  bezelWidth: number;
  fbxFile: string | null;
  selectedScreenMesh: string | null;

  // NEW: Store parsed internal structure of FBX
  subMeshes: FBXSubMesh[];

  bodyMaterial: MaterialPreset;
  bodyColor: string;
  bodyColorOverride?: boolean;
  roughness: number;
  metalness: number;
  screenshot: string | null;
  screenshotType?: 'image' | 'video'; // NEW: Type of screenshot
  screenshotPrev: string | null; // NEW: Previous screenshot for transition
  screenshotPrevType?: 'image' | 'video'; // NEW: Type of previous screenshot
  screenshotMix: number; // NEW: 0 = prev, 1 = current
  imageTransitionDuration: number; // NEW: Duration of transition in seconds
  textureRotation: number;
  textureFlipX: boolean;
  textureFlipY: boolean;
  textureStretch: boolean; // NEW: Stretch image to fit screen UVs ignoring aspect ratio
  screenRoughness: number;
  screenEmissive: number;
  clearcoat?: number; // NEW: Clearcoat intensity
  sheen?: number; // NEW: Sheen intensity
}

export interface Keyframe {
  id: string;
  time: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'custom';
  bezier?: [number, number, number, number];
  state: Partial<AppState>;
}

export interface SavedProject {
  workspace?: {id:string;revision:string};
  format?: 'mockup3d';
  version?: 2;
  assets?: Record<string, string>;
  id: string;
  name: string;
  timestamp: number;
  data: Omit<AppState, 'savedProjects' | 'isExporting' | 'isPlaying'>;
}

export interface FocusAnchor {
  modelId:string;
  modelSource?:string;
  localPoint:[number,number,number];
  fallbackWorldPoint:[number,number,number];
}
export interface LensConfig {enabled:boolean;aperture:number;maxBlur:number;focus:FocusAnchor|null;shutter?:number;iso?:number;exposureMode?:'auto'|'manual'}
export interface StudioLighting {mode:'single'|'multicolor';colors:[string,string,string]}
export interface RainConfig {enabled:boolean;intensity:number;wind:number;dropSize:number;wetness:number;preview:boolean}
export interface StageObject {
 id:string;name:string;position:[number,number,number];rotation:[number,number,number];size:[number,number,number];color:string;roughness:number;
 material?:'stone'|'glass'|'metal'|'fabric'|'velvet'|'fur'|'knit'|'satin';shape?:'box'|'cylinder'|'rock'|'lattice'|'fluted'|'drape'|'cushion'|'ribbed-wall'|'ring'|'cyclorama'|'grooved-tray'|'satin-sheet'|'chrome-rack'|'brick-court';
 role?:'backdrop'|'prop';bevelRadius?:number;reflectivity?:number;
 surface?:'smooth'|'mineral'|'concrete'|'travertine'|'slate'|'terrazzo';textureScale?:number;detailStrength?:number;
 softness?:number;pileLength?:number;fiberDensity?:number;reliefDepth?:number;knitPattern?:'stockinette'|'cable';
 brickRows?:number;brickColumns?:number;moss?:number;rain?:RainConfig;
}
export interface AppState {
  activeStageId?:string|null;
  selectedModelIds?:string[];
  phoneViewBeforeScene?: {cameraPosition:[number,number,number];cameraTarget:[number,number,number];activeModelId:string|null;showGizmo:boolean;projectionMode?:'perspective'|'weak'|'orthographic'};
  stage?: Omit<StageObject,'id'|'name'> & {enabled:boolean;preset?:string;items?:StageObject[];studioLighting?:StudioLighting;studioEnvironment?:{rotation:number;blur:number;intensity:number}};
  renderStyle?: 'legacy'|'studio';
  lens?:LensConfig;
  lensAnimated?:boolean;
  isSelectingFocus?:boolean;
  bgColorLocked?: boolean;
  // --- Global Scene Settings ---
  bgImage: string | null;
  bgMediaType?: 'image' | 'video';
  bgBlur: number;
  bgColor: string;

  lightingMode: LightingMode;
  ambientIntensity: number;
  spotIntensity: number;
  lightColor: string;
  reflectionIntensity: number;

  shadowConfig: ShadowConfig;

  canvasAspectRatio: number | 'auto';
  customCanvasWidth: number;
  customCanvasHeight: number;

  cameraPosition: [number, number, number];
  projectionMode?: 'perspective' | 'weak' | 'orthographic';
  cameraTarget: [number, number, number];

  // --- Objects ---
  models: ModelConfig[];
  texts: TextConfig[];

  // --- Selection ---
  activeModelId: string | null;
  activeTextId: string | null;

  // --- UI/System ---
  isSelectingScreen: boolean;
  transformMode: TransformMode;
  transformSpace: TransformSpace;
  showGizmo: boolean;

  isExporting: boolean;
  exportDpr?: number;

  // --- Animation ---
  currentTime: number;
  totalDuration: number;
  motionMode?: 'segments' | 'continuous';
  isPlaying: boolean;
  keyframes: Keyframe[];

  savedProjects: SavedProject[];
}

export const DEFAULT_SIMPLE_MODEL: ModelConfig = {
  id: 'default',
  name: '简单样机',
  visible: true,
  mode: 'simple',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  width: 3,
  height: 6,
  depth: 0.2,
  radius: 0.15,
  edgeColor: '#333333',
  bezelWidth: 0.15,
  fbxFile: null,
  selectedScreenMesh: null,
  subMeshes: [], // Init empty
  bodyMaterial: 'titanium',
  bodyColor: '#ffffff',
  roughness: 0.2,
  metalness: 1.0,
  screenshot: null,
  screenshotPrev: null,
  screenshotMix: 1.0,
  imageTransitionDuration: 0.5,
  textureRotation: 0,
  textureFlipX: false,
  textureFlipY: false,
  textureStretch: false, // Default to keeping aspect ratio
  screenRoughness: 0.2,
  screenEmissive: 1.0,
  clearcoat: 0.5,
  sheen: 0.0,
};

export const DEFAULT_PURA_MODEL: ModelConfig = {
  ...DEFAULT_SIMPLE_MODEL,
  mode: 'fbx',
  name: 'Huawei Pura 70',
  fbxFile: '/Pura70pro.fbx',
  scale: 1,
  rotation: [0, 0, 0],
  bodyMaterial: 'aluminum',
  bodyColor: '#e0e0e0',
  roughness: 0.1,
  metalness: 0.9,
  screenRoughness: 0.3,
  screenEmissive: 0.8,
  clearcoat: 1.0,
  sheen: 0.5,
  subMeshes: [],
};

export const DEFAULT_DDDD_MODEL: ModelConfig = {
  ...DEFAULT_SIMPLE_MODEL,
  mode: 'fbx',
  name: '样机 D',
  fbxFile: "/d'd'd'd.fbx",
  scale: 1,
  rotation: [0, 0, 0],
  bodyMaterial: 'aluminum',
  bodyColor: '#e0e0e0',
  roughness: 0.1,
  metalness: 0.9,
  screenRoughness: 0.3,
  screenEmissive: 0.8,
  clearcoat: 1.0,
  sheen: 0.5,
  subMeshes: [],
};

export const DEFAULT_FONT_URL = null;

export const getInitialState = (): AppState => ({
  bgImage: null,
  bgBlur: 0,
  bgColor: '#1a1a1a',

  lightingMode: 'realistic',
  ambientIntensity: 0.5,
  spotIntensity: 1.5,
  lightColor: '#ffffff',
  reflectionIntensity: 0.0,

  shadowConfig: {
    type: 'none', // Changed to none by default
    opacity: 0.6,
    blur: 2.0,
    color: '#000000',
    offset: 0,
  },

  canvasAspectRatio: 'auto',
  customCanvasWidth: 1080,
  customCanvasHeight: 1920,

  cameraPosition: [0, 0, 8],
  renderStyle:'studio',
  lens:{enabled:false,aperture:2.8,maxBlur:12,focus:null},
  lensAnimated:false,
  isSelectingFocus:false,
  cameraTarget: [0, 0, 0],

  models: [{ ...DEFAULT_SIMPLE_MODEL, id: 'initial-model', name: '样机 1', position: [0,0,0], rotation: [0,0,0], scale: 1 }],
  activeModelId: 'initial-model',

  texts: [],
  activeTextId: null,

  isSelectingScreen: false,
  transformMode: 'universal', // Default to Universal for better UX
  transformSpace: 'local',
  showGizmo: false,
  isExporting: false,
  exportDpr: undefined,

  currentTime: 0,
  totalDuration: 5,
  isPlaying: false,
  keyframes: [],

  savedProjects: []
});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      spotLight: any;
      pointLight: any;
      directionalLight: any;
      mesh: any;
      group: any;
      primitive: any;
      sphereGeometry: any;
      boxGeometry: any;
      planeGeometry: any;
      extrudeGeometry: any;
      shapeGeometry: any;
      meshStandardMaterial: any;
      meshPhysicalMaterial: any;
      meshBasicMaterial: any;
      shadowMaterial: any;
      [elemName: string]: any;
    }
  }
}
