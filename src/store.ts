import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { PlayerMap, RoomMap, ChatMessage, ServerToClientEvents, ClientToServerEvents } from './types.js';

interface AppState {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  players: PlayerMap;
  rooms: RoomMap;
  messages: ChatMessage[];
  reports: any[];
  myId: string | null;
  error: string | null;
  startTimer: number | null;
  connect: (data: { id: string, nickname: string, avatar?: string }) => void;
  setError: (msg: string | null) => void;
  clearMessages: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  socket: null,
  players: {},
  rooms: {},
  messages: [],
  reports: [],
  myId: null,
  error: null,
  startTimer: null,

  connect: (data: { id: string, nickname: string, avatar?: string }) => {
    if (get().socket) return;
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('/');
    
    socket.on('connect', () => {
      set({ myId: data.id, socket });
      socket.emit('joinGlobal', data);
    });

    socket.on('myProfile', (profile) => {
      set(state => ({
        myId: profile.id,
        players: { ...state.players, [profile.id]: profile }
      }));
    });

    socket.on('stateSync', ({ players, rooms }) => {
      set(state => {
        const myId = state.myId;
        const myPlayer = myId ? state.players[myId] : null;
        
        // Preserve local role since broadcast strips it for alive players
        if (myId && myPlayer && myPlayer.role && players[myId]) {
           players[myId].role = myPlayer.role;
        }

        return { players, rooms };
      });
    });

    socket.on('chatMessage', (msg) => {
      set((state) => ({ messages: [...state.messages, msg] }));
    });

    socket.on('updateReports', (reports) => {
      set({ reports });
    });

    socket.on('error', (msg) => {
       set({ error: msg });
       setTimeout(() => set({ error: null }), 3000);
    });

    socket.on('penaltyAlert', (msg) => {
       set({ error: msg });
       setTimeout(() => set({ error: null }), 5000);
    });

    socket.on('kicked', () => {
       set({ error: 'Вы были исключены из комнаты' });
       setTimeout(() => set({ error: null }), 3000);
    });

    socket.on('timerUpdate', ({ timeLeft }) => {
       set({ startTimer: timeLeft });
    });

    socket.on('startCanceled', (msg) => {
       set({ startTimer: null, error: msg });
       setTimeout(() => set({ error: null }), 3000);
    });

    socket.on('gameStarted', (roomId) => {
       set({ startTimer: null });
       // Switch to game UI is handled by stateSync updating room status
    });
  },

  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [] })
}));
