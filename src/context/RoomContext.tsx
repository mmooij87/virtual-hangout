'use client';

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

// Types
export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
}

export interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  addedBy: string;
  duration?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface RoomState {
  roomId: string | null;
  participants: Participant[];
  queue: QueueItem[];
  messages: ChatMessage[];
  votes: string[]; // List of participant IDs who voted next
  currentVideoIndex: number;
  playerState: 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended';
  currentTime: number;
  isConnected: boolean;
  localParticipant: Participant | null;
}

// Actions
type RoomAction =
  | { type: 'SET_ROOM_ID'; payload: string }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_LOCAL_PARTICIPANT'; payload: Participant }
  | { type: 'SET_PARTICIPANTS'; payload: Participant[] }
  | { type: 'ADD_PARTICIPANT'; payload: Participant }
  | { type: 'REMOVE_PARTICIPANT'; payload: string }
  | { type: 'UPDATE_PARTICIPANT'; payload: { id: string; updates: Partial<Participant> } }
  | { type: 'SET_QUEUE'; payload: QueueItem[] }
  | { type: 'ADD_TO_QUEUE'; payload: QueueItem }
  | { type: 'REMOVE_FROM_QUEUE'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_VOTES'; payload: string[] }
  | { type: 'SET_CURRENT_VIDEO_INDEX'; payload: number }
  | { type: 'SET_PLAYER_STATE'; payload: RoomState['playerState'] }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SYNC_STATE'; payload: Partial<RoomState> };

// Initial state
const initialState: RoomState = {
  roomId: null,
  participants: [],
  queue: [],
  messages: [],
  votes: [],
  currentVideoIndex: 0,
  playerState: 'unstarted',
  currentTime: 0,
  isConnected: false,
  localParticipant: null,
};

// Reducer
function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'SET_ROOM_ID':
      return { ...state, roomId: action.payload };

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };

    case 'SET_LOCAL_PARTICIPANT':
      return { ...state, localParticipant: action.payload };

    case 'SET_PARTICIPANTS':
      return { ...state, participants: action.payload };

    case 'ADD_PARTICIPANT':
      if (state.participants.find(p => p.id === action.payload.id)) {
        return state;
      }
      return { ...state, participants: [...state.participants, action.payload] };

    case 'REMOVE_PARTICIPANT':
      return {
        ...state,
        participants: state.participants.filter(p => p.id !== action.payload),
      };

    case 'UPDATE_PARTICIPANT':
      return {
        ...state,
        participants: state.participants.map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload.updates } : p
        ),
      };

    case 'SET_QUEUE':
      return { ...state, queue: action.payload };

    case 'ADD_TO_QUEUE':
      return { ...state, queue: [...state.queue, action.payload] };

    case 'REMOVE_FROM_QUEUE':
      return {
        ...state,
        queue: state.queue.filter(item => item.id !== action.payload),
      };

    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };

    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };

    case 'SET_VOTES':
      return { ...state, votes: action.payload };

    case 'SET_CURRENT_VIDEO_INDEX':
      return { ...state, currentVideoIndex: action.payload };

    case 'SET_PLAYER_STATE':
      return { ...state, playerState: action.payload };

    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };

    case 'SYNC_STATE':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// Context
interface RoomContextType {
  state: RoomState;
  dispatch: React.Dispatch<RoomAction>;
  currentVideo: QueueItem | null;
  nextVideo: () => void;
  previousVideo: () => void;
}

const RoomContext = createContext<RoomContextType | null>(null);

// Provider
export function RoomProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(roomReducer, initialState);

  const currentVideo = state.queue[state.currentVideoIndex] || null;

  const nextVideo = useCallback(() => {
    if (state.currentVideoIndex < state.queue.length - 1) {
      dispatch({ type: 'SET_CURRENT_VIDEO_INDEX', payload: state.currentVideoIndex + 1 });
    }
  }, [state.currentVideoIndex, state.queue.length]);

  const previousVideo = useCallback(() => {
    if (state.currentVideoIndex > 0) {
      dispatch({ type: 'SET_CURRENT_VIDEO_INDEX', payload: state.currentVideoIndex - 1 });
    }
  }, [state.currentVideoIndex]);

  return (
    <RoomContext.Provider value={{ state, dispatch, currentVideo, nextVideo, previousVideo }}>
      {children}
    </RoomContext.Provider>
  );
}

// Hook
export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}
