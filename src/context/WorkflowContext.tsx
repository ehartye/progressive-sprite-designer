import { createContext, useContext, useReducer, useRef, ReactNode, Dispatch } from 'react';
import { WorkflowEngine } from '../lib/workflow';
import type { Phase } from '../lib/poses';
import SpriteApiClient from '../api/spriteApiClient';

// --- Types ---

export interface ApprovedSprite {
  poseId: string;
  poseName: string;
  imageData: string;
  mimeType: string;
  timestamp: number;
  prompt: string;
  modelId: string;
  customInstructions: string;
  referenceImageIds: string[];
}

export interface GeneratedOption {
  text?: string | null;
  image?: { data: string; mimeType: string } | null;
  error?: string;
}

export interface StatusMessage {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface CharacterFormData {
  gameType: string;
  name: string;
  description: string;
  equipment: string;
  colorNotes: string;
}

export interface WorkflowState {
  model: string;
  workflowActive: boolean;
  characterConfig: CharacterFormData;
  hierarchy: Phase[];
  currentPhaseIndex: number;
  currentPoseIndex: number;
  generatedOptions: GeneratedOption[];
  selectedIndex: number;
  approvedSprites: ApprovedSprite[];
  skippedPoseIds: string[];
  isGenerating: boolean;
  customInstructions: string;
  promptPreview: string;
  status: StatusMessage | null;
  totalPoses: number;
  generationSetId: number | null;
}

// --- Actions ---

type Action =
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_CHARACTER_CONFIG'; config: Partial<CharacterFormData> }
  | { type: 'WORKFLOW_STARTED'; hierarchy: Phase[]; totalPoses: number; generationSetId: number | null }
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_COMPLETE'; results: GeneratedOption[]; prompt: string }
  | { type: 'IMAGE_SELECTED'; index: number }
  | { type: 'POSE_APPROVED'; sprite: ApprovedSprite }
  | { type: 'POSE_SKIPPED'; poseId: string }
  | { type: 'POSE_NAVIGATED'; phaseIndex: number; poseIndex: number; prompt: string }
  | { type: 'SPRITE_REMOVED'; poseId: string }
  | { type: 'WORKFLOW_COMPLETE' }
  | { type: 'WORKFLOW_RESET' }
  | { type: 'SET_STATUS'; status: StatusMessage }
  | { type: 'CLEAR_STATUS' }
  | { type: 'SET_CUSTOM_INSTRUCTIONS'; text: string }
  | { type: 'SYNC_ENGINE'; approvedSprites: ApprovedSprite[]; skippedPoseIds: string[] }
  | { type: 'SET_GENERATION_SET_ID'; id: number };

// --- Initial State ---

const initialState: WorkflowState = {
  model: 'gemini-2.5-flash-image',
  workflowActive: false,
  characterConfig: { gameType: '', name: '', description: '', equipment: '', colorNotes: '' },
  hierarchy: [],
  currentPhaseIndex: 0,
  currentPoseIndex: 0,
  generatedOptions: [],
  selectedIndex: -1,
  approvedSprites: [],
  skippedPoseIds: [],
  isGenerating: false,
  customInstructions: '',
  promptPreview: '',
  status: null,
  totalPoses: 0,
  generationSetId: null,
};

// --- Reducer ---

function workflowReducer(state: WorkflowState, action: Action): WorkflowState {
  switch (action.type) {
    case 'SET_MODEL':
      return { ...state, model: action.model };
    case 'SET_CHARACTER_CONFIG':
      return { ...state, characterConfig: { ...state.characterConfig, ...action.config } };
    case 'WORKFLOW_STARTED':
      return {
        ...state,
        workflowActive: true,
        hierarchy: action.hierarchy,
        totalPoses: action.totalPoses,
        currentPhaseIndex: 0,
        currentPoseIndex: 0,
        generatedOptions: [],
        selectedIndex: -1,
        approvedSprites: [],
        skippedPoseIds: [],
        generationSetId: action.generationSetId,
      };
    case 'GENERATE_START':
      return { ...state, isGenerating: true, generatedOptions: [], selectedIndex: -1 };
    case 'GENERATE_COMPLETE':
      return { ...state, isGenerating: false, generatedOptions: action.results, promptPreview: action.prompt };
    case 'IMAGE_SELECTED':
      return { ...state, selectedIndex: action.index };
    case 'POSE_APPROVED':
      return {
        ...state,
        approvedSprites: [...state.approvedSprites.filter(s => s.poseId !== action.sprite.poseId), action.sprite],
        selectedIndex: -1,
      };
    case 'POSE_SKIPPED':
      return { ...state, skippedPoseIds: [...new Set([...state.skippedPoseIds, action.poseId])] };
    case 'POSE_NAVIGATED':
      return {
        ...state,
        currentPhaseIndex: action.phaseIndex,
        currentPoseIndex: action.poseIndex,
        generatedOptions: [],
        selectedIndex: -1,
        customInstructions: '',
        promptPreview: action.prompt,
      };
    case 'SPRITE_REMOVED':
      return {
        ...state,
        approvedSprites: state.approvedSprites.filter(s => s.poseId !== action.poseId),
      };
    case 'WORKFLOW_COMPLETE':
      return { ...state, isGenerating: false };
    case 'WORKFLOW_RESET':
      return { ...initialState, model: state.model };
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'CLEAR_STATUS':
      return { ...state, status: null };
    case 'SET_CUSTOM_INSTRUCTIONS':
      return { ...state, customInstructions: action.text };
    case 'SYNC_ENGINE':
      return { ...state, approvedSprites: action.approvedSprites, skippedPoseIds: action.skippedPoseIds };
    case 'SET_GENERATION_SET_ID':
      return { ...state, generationSetId: action.id };
    default:
      return state;
  }
}

// --- Context ---

interface WorkflowContextValue {
  state: WorkflowState;
  dispatch: Dispatch<Action>;
  engineRef: React.MutableRefObject<WorkflowEngine | null>;
  clientRef: React.MutableRefObject<SpriteApiClient>;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workflowReducer, initialState);
  const clientRef = useRef(new SpriteApiClient(initialState.model));
  const engineRef = useRef<WorkflowEngine | null>(null);

  return (
    <WorkflowContext.Provider value={{ state, dispatch, engineRef, clientRef }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflowContext(): WorkflowContextValue {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error('useWorkflowContext must be used within WorkflowProvider');
  return ctx;
}
