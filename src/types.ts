export type PlayerMap = Record<string, Player>;
export type RoomMap = Record<string, Room>;

export interface Player {
  id: string; // Real user ID (Telegram ID or Web generated)
  socketId: string; // Current transient connection ID
  nickname: string;
  avatar: string;
  coins: number;
  status: 'IN_MENU' | 'IN_ROOM' | 'IN_GAME' | 'PENALTY';
  roomId?: string; // Currently joined room
  // Game state
  role?: string;
  isAlive?: boolean;
  inventory?: string[];
  activeEffects?: string[]; // e.g., 'BARTENDER', 'ARMOR'
  vipColor?: string;
}

export type GamePhase = 'DAY' | 'VOTING' | 'NIGHT' | 'RESULTS';

export interface KickVote {
  targetId: string;
  votesFor: string[];
  votesAgainst: string[];
  endsAt: number;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  maxPlayers: number;
  players: string[]; // Player IDs
  status: 'WAITING' | 'STARTING' | 'IN_GAME' | 'FINISHED';
  startTimer?: number;
  // Game State
  phase?: GamePhase;
  phaseEndsAt?: number;
  dayCount?: number;
  nightActions?: Record<string, string>; // role -> targetId
  votes?: Record<string, string>; // voterId -> targetId
  kickVote?: KickVote;
  gameLog?: string[]; // To show what happened in the morning
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isGlobal: boolean;
  roomId?: string;
  isMafiaOnly?: boolean; // For mafia chat
  isSystem?: boolean;
}

export interface ServerToClientEvents {
  stateSync: (data: { players: PlayerMap; rooms: RoomMap }) => void;
  myProfile: (profile: Player) => void;
  chatMessage: (msg: ChatMessage) => void;
  error: (msg: string) => void;
  kicked: () => void;
  penaltyAlert: (msg: string) => void;
  timerUpdate: (data: { roomId: string; timeLeft: number }) => void;
  startCanceled: (msg: string) => void;
  gameStarted: (roomId: string) => void;
  kickVoteStarted: (vote: KickVote) => void;
}

export interface ClientToServerEvents {
  joinGlobal: (data: { id: string, nickname: string, avatar?: string }) => void;
  updateProfile: (nickname: string, avatar: string) => void;
  createRoom: (name: string, isPrivate: boolean, maxPlayers: number) => void;

  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  sendChat: (text: string, isGlobal: boolean, isMafiaOnly?: boolean) => void;
  
  // Game Actions
  startGame: () => void;
  proposeKick: (targetPlayerId: string) => void;
  voteKick: (targetPlayerId: string, approve: boolean) => void;
  submitDayVote: (targetPlayerId: string) => void;
  submitNightAction: (targetPlayerId: string) => void;
  buyItem: (itemId: string) => void;

  reportPlayer: (targetId: string, reason: string, comment: string) => void;
  adminAction: (action: string, payload: any) => void; // Simple admin RPC
}
