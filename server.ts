import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import TelegramBot from 'node-telegram-bot-api';
import { Player, Room, PlayerMap, RoomMap, ChatMessage, ClientToServerEvents, ServerToClientEvents } from './src/types.js';
import { getUser, createUser, updateUserStatus, banUser, unbanUser, updateProfileInDb, spendCoins, updateVipColor, addStats } from './src/db.js';

// Setup Telegram Bot if token exists
// You can get real-time info and manage users via the bot.
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;
const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN, { polling: true }) : null;

// In-Memory State (Active matches and online players)
const players: PlayerMap = {};
const rooms: RoomMap = {};
const socketToPlayerId: Record<string, string> = {};

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  reason: string;
  timestamp: number;
}
export const reports: Report[] = [];

function broadcastToAdmins(io: any) {
  const adminIds = Object.values(players).filter(p => p.isAdmin).map(p => p.id);
  for (const id of adminIds) {
    const p = players[id];
    if (p && p.socketId) {
      io.to(p.socketId).emit('updateReports', reports);
    }
  }
}

if (bot) {
  bot.on('message', (msg) => {
    if (msg.chat.id.toString() !== TELEGRAM_ADMIN_ID) return;
    const text = msg.text || '';
    
    // Command: /status
    if (text === '/status') {
      bot.sendMessage(msg.chat.id, `Сервер работает. Игроков онлайн: ${Object.keys(players).length}, Активных Комнат: ${Object.keys(rooms).length}`);
    }
    
    // Command: /ban [userId]
    if (text.startsWith('/ban ')) {
      const targetId = text.split(' ')[1];
      if (targetId) {
        banUser(targetId);
        // If player is currently online, kick them OUT
        if (players[targetId]) {
           const targetSocket = players[targetId].socketId;
           if (targetSocket) {
              // We'll signal them inside io loop or handle it if we have io access here.
              // We need access to io.
           }
        }
        bot.sendMessage(msg.chat.id, `Игрок ${targetId} успешно забанен.`);
      }
    }
  });
}

function broadcastState(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  // Send light state to everyone (only necessary parts)
  const sanitizedPlayers: PlayerMap = {};
  Object.keys(players).forEach(id => {
     const p = players[id];
     // Only send role info if player is dead OR the game is over. 
     // DO NOT SEND roles of alive players to anyone!
     const pRoom = p.roomId ? rooms[p.roomId] : null;
     const isGameOver = pRoom?.status === 'FINISHED';
     
     sanitizedPlayers[id] = {
        ...p,
        role: (p.isAlive === false || isGameOver) ? p.role : undefined, // Hide true role for alive!
     };
  });
  
  io.sockets.sockets.forEach(socket => {
      // For each connected user, send them the state, but embed THEIR OWN role back
      // since they need to know it for their UI
      // For some reason socket.id maps to multiple sockets or something... actually socket is a socket instance.
      // Wait, socketToPlayerId is inside the io connection scope, so it's not accessible here globally.
      // We will just expose real roles to the socket if needed via a direct hit, or client tracks it via internal state.
      // Easiest is to keep roles secret in the broadcast and just emit a targeted "myRole" if it's missing, or maybe emit state targeting their IDs.
  });

  // Since socketToPlayerId is not available globally, we'll just emit everything to everyone
  // BUT we will hide ALL alive roles.
  io.emit('stateSync', { players: sanitizedPlayers, rooms });
}

// Timer management
const startTimers: Record<string, NodeJS.Timeout> = {};

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const httpServer = createServer(app);
  
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', playersCount: Object.keys(players).length });
  });

  io.on('connection', (socket) => {
    // Basic setup on connection
    socket.on('joinGlobal', ({ id, nickname, avatar }) => {
      // 1. Fetch from DB
      let dbUser = getUser(id);
      if (!dbUser) {
         dbUser = createUser(id, nickname || 'Guest_' + Math.floor(Math.random() * 1000), avatar || '');
      }

      // If user joined with new WebApp avatar/nickname, update it in DB
      if (avatar && avatar !== dbUser.avatar) {
         updateProfileInDb(id, dbUser.nickname, avatar);
         dbUser.avatar = avatar;
      }

      if (dbUser.is_banned) {
         socket.emit('error', 'Ваш аккаунт заблокирован.');
         socket.disconnect();
         return;
      }

      socketToPlayerId[socket.id] = id;

      players[id] = {
        id,
        socketId: socket.id,
        nickname: dbUser.nickname,
        avatar: dbUser.avatar,
        coins: dbUser.coins,
        isAdmin: !!dbUser.is_admin,
        status: dbUser.status as any,
        vipColor: dbUser.vip_color,
        matchesPlayed: dbUser.matches_played,
        wins: dbUser.wins,
      };

      if (dbUser.status === 'PENALTY') {
         socket.emit('penaltyAlert', 'У вас активный штраф за выход из незаконченной игры.');
      }

      if (dbUser.status === 'IN_GAME' || dbUser.status === 'IN_ROOM') {
         // Auto rejoin channel socket wise if they belong to a room still
         const existingPlayer = players[id];
         if (existingPlayer && existingPlayer.roomId) {
            socket.join(existingPlayer.roomId);
         }
      }

      broadcastState(io);
    });

    socket.on('updateProfile', (nickname, avatar) => {
      const pId = socketToPlayerId[socket.id];
      if (!pId) return;
      const p = players[pId];
      if (p) {
        updateProfileInDb(pId, nickname, avatar);
        p.nickname = nickname;
        p.avatar = avatar;
        broadcastState(io);
      }
    });

    socket.on('buyItem', (itemId) => {
      const pId = socketToPlayerId[socket.id];
      const p = players[pId];
      if (!p) return;

      if (itemId.startsWith('color_')) {
         const color = itemId.split('_')[1];
         if (p.coins >= 50) {
            if (spendCoins(pId, 50)) {
               updateVipColor(pId, color);
               p.coins -= 50;
               p.vipColor = color;
               socket.emit('error', 'Цвет ника успешно куплен!'); // abuse error for toast
               broadcastState(io);
            }
         } else {
            socket.emit('error', 'Недостаточно монет (нужно 50).');
         }
      } else if (itemId === 'boost_don' || itemId === 'boost_sheriff' || itemId === 'armor') {
         if (p.coins >= 100) {
            if (spendCoins(pId, 100)) {
               p.coins -= 100;
               p.inventory = p.inventory || [];
               p.inventory.push(itemId);
               socket.emit('error', 'Преимущество куплено! Оно хранится в инвентаре.');
               broadcastState(io);
            }
         } else {
            socket.emit('error', 'Недостаточно монет (нужно 100).');
         }
      }
    });

    socket.on('createRoom', (name, isPrivate, maxPlayers, password) => {
      const pId = socketToPlayerId[socket.id];
      const p = players[pId];
      if (!p) return;
      if (p.status === 'PENALTY') {
        socket.emit('error', 'Вы не можете создавать комнаты из-за штрафа за лив.');
        return;
      }
      if (p.status !== 'IN_MENU') return;

      const roomId = 'room_' + Date.now();
      rooms[roomId] = {
        id: roomId,
        name: name || 'Room ' + Math.floor(Math.random() * 1000),
        hostId: pId,
        isPrivate,
        password,
        maxPlayers,
        players: [pId],
        status: 'WAITING'
      };
      
      p.roomId = roomId;
      p.status = 'IN_ROOM';
      updateUserStatus(pId, 'IN_ROOM');
      socket.join(roomId);
      broadcastState(io);
    });

    socket.on('joinRoom', (roomId, password) => {
      const pId = socketToPlayerId[socket.id];
      const p = players[pId];
      if (!p || !rooms[roomId]) return;
      
      // AFK & Leaver Protection (Система 'Узы матча')
      if (p.status === 'IN_GAME' || p.status === 'PENALTY') {
        socket.emit('error', 'Вы не можете зайти в новую игру, пока не завершился ваш предыдущий матч');
        return;
      }

      // If player already in another room, force leave it
      if (p.roomId) {
        handleLeaveRoom(io, socket.id);
      }

      const room = rooms[roomId];
      if (room.isPrivate && room.password !== password) {
         socket.emit('error', 'Неверный пароль');
         return;
      }
      if (room.players.length >= room.maxPlayers) {
        socket.emit('error', 'Комната полна');
        return;
      }
      if (room.status !== 'WAITING' && room.status !== 'STARTING') {
        socket.emit('error', 'Игра уже идет');
        return;
      }

      room.players.push(pId);
      p.roomId = roomId;
      p.status = 'IN_ROOM';
      updateUserStatus(pId, 'IN_ROOM');
      socket.join(roomId);

      // Smart Timer Reset Logic
      if (room.status === 'STARTING') {
        resetStartTimer(io, roomId);
      }

      broadcastState(io);
    });

    socket.on('leaveRoom', () => {
      handleLeaveRoom(io, socket.id);
    });

    socket.on('disconnect', () => {
       const pId = socketToPlayerId[socket.id];
       if (!pId) return;
       const p = players[pId];
       if (p) {
         if (p.status === 'IN_GAME') {
            p.status = 'PENALTY';
            updateUserStatus(pId, 'PENALTY');
         } else if (p.status === 'IN_ROOM') {
            handleLeaveRoom(io, socket.id);
         }
         // Clean up from memory to show them as offline
         if (p.status === 'IN_MENU') {
            updateUserStatus(pId, 'IN_MENU');
         }
         // We can leave their data around for the game to progress, but remove socket references
         // For now let's just clear memory if they are menu
         if (p.status === 'IN_MENU' || p.status === 'PENALTY') {
            delete players[pId];
         }
       }
       delete socketToPlayerId[socket.id];
       broadcastState(io);
    });

    socket.on('startGame', () => {
      const pId = socketToPlayerId[socket.id];
      const p = players[pId];
      if (!p || !p.roomId) return;
      const room = rooms[p.roomId];
      if (!room || room.hostId !== pId || room.status !== 'WAITING') return;

      if (room.players.length < 4) {
        socket.emit('error', 'Недостаточно игроков (минимум 4)');
        return;
      }

      resetStartTimer(io, room.id);
    });

    socket.on('proposeKick', (targetId) => {
      const pId = socketToPlayerId[socket.id];
      const p = players[pId];
      if (!p || !p.roomId) return;
      const room = rooms[p.roomId];
      if (!room || room.hostId !== pId || room.status !== 'WAITING') return;
      if (room.kickVote) return;
      
      room.kickVote = {
         targetId,
         votesFor: [pId], // host votes for
         votesAgainst: [],
         endsAt: Date.now() + 15000
      };
      
      io.to(room.id).emit('chatMessage', {
          id: Math.random().toString(),
          senderId: 'system',
          senderName: 'Голосование',
          text: `Начато голосование за исключение игрока ${players[targetId]?.nickname || '???'}.`,
          timestamp: Date.now(),
          isGlobal: false,
          roomId: room.id,
          isSystem: true
      });
      io.to(room.id).emit('kickVoteStarted', room.kickVote);
      broadcastState(io);

      setTimeout(() => {
         const cr = rooms[p.roomId!];
         if (cr && cr.kickVote && cr.kickVote.targetId === targetId) {
             const v = cr.kickVote;
             if (v.votesFor.length > v.votesAgainst.length) {
                const targetSocketObj = Object.entries(socketToPlayerId).find(([sId, pid]) => pid === targetId);
                cr.players = cr.players.filter(id => id !== targetId);
                const tp = players[targetId];
                if (tp) {
                   tp.roomId = undefined;
                   tp.status = 'IN_MENU';
                   updateUserStatus(targetId, 'IN_MENU');
                }
                if (targetSocketObj) {
                   const ts = io.sockets.sockets.get(targetSocketObj[0]);
                   if (ts) {
                       ts.leave(cr.id);
                       ts.emit('kicked');
                   }
                }
                io.to(cr.id).emit('chatMessage', {
                    id: Math.random().toString(),
                    senderId: 'system',
                    senderName: 'Система',
                    text: 'Игрок был исключен голосованием.',
                    timestamp: Date.now(),
                    isGlobal: false,
                    roomId: cr.id,
                    isSystem: true
                });
             } else {
                 io.to(cr.id).emit('chatMessage', {
                    id: Math.random().toString(),
                    senderId: 'system',
                    senderName: 'Система',
                    text: 'Голосование за кик провалилось.',
                    timestamp: Date.now(),
                    isGlobal: false,
                    roomId: cr.id,
                    isSystem: true
                });
             }
             cr.kickVote = undefined;
             broadcastState(io);
         }
      }, 15000);
    });

    socket.on('voteKick', (targetId, approve) => {
      const pId = socketToPlayerId[socket.id];
      const p = players[pId];
      if (!p || !p.roomId) return;
      const room = rooms[p.roomId];
      if (!room || !room.kickVote || room.kickVote.targetId !== targetId) return;

      const v = room.kickVote;
      if (v.votesFor.includes(pId) || v.votesAgainst.includes(pId)) return;

      if (approve) v.votesFor.push(pId);
      else v.votesAgainst.push(pId);
      broadcastState(io);
    });

    socket.on('submitDayVote', (targetId) => {
       const pId = socketToPlayerId[socket.id];
       const p = players[pId];
       if (!p || !p.roomId) return;
       const room = rooms[p.roomId];
       if (!room || room.status !== 'IN_GAME' || room.phase !== 'VOTING' || !p.isAlive) return;

       room.votes = room.votes || {};
       room.votes[pId] = targetId;
       broadcastState(io);
    });

    socket.on('submitNightAction', (targetId) => {
       const pId = socketToPlayerId[socket.id];
       const p = players[pId];
       if (!p || !p.roomId || !p.role) return;
       const room = rooms[p.roomId];
       if (!room || room.status !== 'IN_GAME' || room.phase !== 'NIGHT' || !p.isAlive) return;

       room.nightActions = room.nightActions || {};
       room.nightActions[p.role] = targetId;
       broadcastState(io);
    });

    socket.on('sendChat', (text, isGlobal, isMafiaOnly) => {
      const pId = socketToPlayerId[socket.id];
      const p = players[pId];
      if (!p) return;
      
      // Bartender effect
      let finalText = text;
      if (p.activeEffects && p.activeEffects.includes('BARTENDER') && !isGlobal) {
          finalText = text.split('').sort(() => 0.5 - Math.random()).join('') + ' ...ик...';
      }

      const msg: ChatMessage = {
        id: Math.random().toString(),
        senderId: pId,
        senderName: p.nickname,
        text: finalText,
        timestamp: Date.now(),
        isGlobal,
        roomId: p.roomId,
        isMafiaOnly
      };

      if (isGlobal) {
        io.emit('chatMessage', msg);
      } else if (p.roomId) {
         const room = rooms[p.roomId];
         if (!room) return;
         
         if (room.status === 'IN_GAME' && room.phase !== 'NIGHT' && room.phase !== 'DAY') {
             socket.emit('error', 'В этой фазе нельзя писать в чат (кроме мафии ночью).');
             return;
         }

         if (room.status === 'IN_GAME' && !p.isAlive) {
             socket.emit('error', 'Мертвые не разговаривают.');
             return;
         }
         
         if (isMafiaOnly && room.phase === 'NIGHT') {
             // Send only to mafia & don & medium
             room.players.forEach(pid => {
                 const rp = players[pid];
                 if (rp && (rp.role === 'MAFIA' || rp.role === 'DON' || rp.role === 'MEDIUM')) {
                    const modifiedMsg = { ...msg };
                    if (rp.role === 'MEDIUM') modifiedMsg.senderName = 'Неизвестный';
                    
                    const ts = Object.entries(socketToPlayerId).find(([sid, dbid]) => dbid === pid);
                    if (ts) io.to(ts[0]).emit('chatMessage', modifiedMsg);
                 }
             });
         } else {
             io.to(p.roomId).emit('chatMessage', msg);
         }
      }
    });

    // Report system
    socket.on('invitePlayer', (targetId) => {
      const pId = socketToPlayerId[socket.id];
      const p = players[pId];
      const target = players[targetId];

      if (p && p.roomId && target && target.status === 'IN_MENU') {
        const room = rooms[p.roomId];
        if (room && room.players.length < room.maxPlayers && target.socketId) {
          // Find all sockets for target
          const targetSockets = Object.keys(socketToPlayerId).filter(sid => socketToPlayerId[sid] === targetId);
          targetSockets.forEach(sid => {
            io.to(sid).emit('invited', {
              roomId: room.id,
              roomName: room.name,
              fromName: p.nickname
            });
          });
        }
      }
    });

    socket.on('reportPlayer', (targetId, reason, comment) => {
      const pId = socketToPlayerId[socket.id];
      const reporter = players[pId]?.nickname || 'Unknown';
      const target = players[targetId]?.nickname || targetId;
      
      reports.push({
        id: 'rep_' + Date.now(),
        reporterId: pId,
        reporterName: reporter,
        targetId: targetId,
        targetName: target,
        reason: `${reason} - ${comment}`,
        timestamp: Date.now()
      });
      broadcastToAdmins(io);

      if (bot && TELEGRAM_ADMIN_ID) {
        const msg = `🚨 РЕПОРТ\nОт: ${reporter} (ID: ${pId})\nНа: ${target} (ID: ${targetId})\nПричина: ${reason}\nКомментарий: ${comment}\n\nЧтобы забанить: /ban ${targetId}`;
        bot.sendMessage(TELEGRAM_ADMIN_ID, msg);
      }
    });

    socket.on('getReports', () => {
       const pId = socketToPlayerId[socket.id];
       if (players[pId]?.isAdmin) {
          socket.emit('updateReports', reports);
       }
    });

    socket.on('adminAction', (action, targetId) => {
       const pId = socketToPlayerId[socket.id];
       if (!players[pId]?.isAdmin) return;
       
       if (action === 'ban') {
          banUser(targetId);
          const tP = players[targetId];
          if (tP) {
             tP.status = 'PENALTY';
             if (tP.socketId) {
                io.to(tP.socketId).emit('error', 'Ваш аккаунт заблокирован администратором.');
                io.to(tP.socketId).disconnectSockets(true);
             }
             delete players[targetId];
          }
       } else if (action === 'dismiss') {
          // just remove report
          const idx = reports.findIndex(r => r.targetId === targetId);
          if (idx !== -1) reports.splice(idx, 1);
          broadcastToAdmins(io);
       }
    });
  });

  // Helper to get roles based on player count
function getRolesForPlayerCount(count: number): string[] {
  // Base roles: Sheriff, Doctor, Don
  // count >= 4
  const roles = ['SHERIFF', 'DOCTOR', 'DON'];
  
  if (count === 4) {
    roles.push('CITIZEN');
  } else if (count === 5) {
    roles.push('CITIZEN', 'MAFIA');
  } else if (count === 6) {
    roles.push('CITIZEN', 'MAFIA', 'MEDIUM');
  } else if (count === 7) {
    roles.push('CITIZEN', 'JESTER', 'MAFIA', 'MEDIUM');
  } else if (count >= 8) {
    roles.push('CITIZEN', 'JESTER', 'MAFIA', 'MEDIUM', 'TERRORIST', 'BARTENDER');
    // Add more citizens for remaining
    while(roles.length < count) roles.push('CITIZEN');
  }
  
  // Shuffle roles
  return roles.sort(() => Math.random() - 0.5);
}

function startGameLogic(io: Server<ClientToServerEvents, ServerToClientEvents>, roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  room.status = 'IN_GAME';
  room.phase = 'DAY';
  room.dayCount = 1;
  room.gameLog = ['Игра началась! Город просыпается.'];
  room.nightActions = {};
  room.votes = {};

  const roles = getRolesForPlayerCount(room.players.length);
  
  // Appply boosts
  const pIds = [...room.players];
  const dons = pIds.filter(id => players[id]?.inventory?.includes('boost_don')).sort(() => Math.random() - 0.5);
  const sheriffs = pIds.filter(id => players[id]?.inventory?.includes('boost_sheriff')).sort(() => Math.random() - 0.5);
  
  if (dons.length > 0) {
     const donIdx = roles.indexOf('DON');
     if (donIdx !== -1) {
        roles.splice(donIdx, 1);
        room.players.forEach(pid => {
           if (pid === dons[0]) {
              players[pid]!.role = 'DON';
              players[pid]!.inventory = players[pid]!.inventory!.filter(i => i !== 'boost_don');
           }
        });
     }
  }

  if (sheriffs.length > 0) {
     const shIdx = roles.indexOf('SHERIFF');
     if (shIdx !== -1) {
        roles.splice(shIdx, 1);
        room.players.forEach(pid => {
           if (pid === sheriffs[0]) {
              players[pid]!.role = 'SHERIFF';
              players[pid]!.inventory = players[pid]!.inventory!.filter(i => i !== 'boost_sheriff');
           }
        });
     }
  }

  room.players.forEach((pid) => {
    const p = players[pid];
    if (p) {
      if (!p.role) {
         p.role = roles.pop();
      }
      p.status = 'IN_GAME';
      p.isAlive = true;
      p.activeEffects = [];
      
      // Let the specific player know their specific role since it is stripped from broadcast
      const socketIds = Object.keys(socketToPlayerId).filter(sid => socketToPlayerId[sid] === pid);
      socketIds.forEach(sid => {
         io.to(sid).emit('myProfile', p); // this contains the role
      });
    }
  });

  io.to(roomId).emit('gameStarted', roomId);
  broadcastState(io);
  startPhaseTimer(io, roomId, 'DAY');
}

function startPhaseTimer(io: Server<ClientToServerEvents, ServerToClientEvents>, roomId: string, phase: 'DAY' | 'VOTING' | 'NIGHT' | 'RESULTS') {
   const room = rooms[roomId];
   if (!room) return;
   
   room.phase = phase;
   room.votes = {};
   room.nightActions = {};
   
   const durations = {
      DAY: 60,
      VOTING: 30,
      NIGHT: 45,
      RESULTS: 10
   };

   const duration = durations[phase] || 30;
   room.phaseEndsAt = Date.now() + duration * 1000;
   broadcastState(io);

   let timeLeft = duration;
   
   if (startTimers[roomId]) clearInterval(startTimers[roomId]);

   startTimers[roomId] = setInterval(() => {
     timeLeft--;
     if (timeLeft <= 0) {
       clearInterval(startTimers[roomId]);
       advancePhase(io, roomId);
     }
   }, 1000);
}

function advancePhase(io: Server<ClientToServerEvents, ServerToClientEvents>, roomId: string) {
   const room = rooms[roomId];
   if (!room) return;

   if (room.phase === 'DAY') {
      startPhaseTimer(io, roomId, 'VOTING');
   } else if (room.phase === 'VOTING') {
      // Resolve voting
      const voteCounts: Record<string, number> = {};
      Object.values(room.votes || {}).forEach(targetId => {
         voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      });
      
      let maxVotes = 0;
      let executedId: string | null = null;
      let tie = false;

      Object.entries(voteCounts).forEach(([tid, count]) => {
         if (count > maxVotes) {
            maxVotes = count;
            executedId = tid;
            tie = false;
         } else if (count === maxVotes) {
            tie = true;
         }
      });

      room.gameLog = [];

      if (!tie && executedId) {
         const executedPlayer = players[executedId];
         if (executedPlayer && executedPlayer.roomId === roomId && executedPlayer.isAlive) {
            executedPlayer.isAlive = false;
            room.gameLog.push(`Город решил казнить: ${executedPlayer.nickname}. Роль: ${executedPlayer.role}`);
            
            if (executedPlayer.role === 'JESTER') {
               room.gameLog.push(`Шут казнен! ШУТ ПОБЕДИЛ!`);
               endGame(io, roomId, 'JESTER');
               return;
            } else if (executedPlayer.role === 'TERRORIST') {
               // Kill a random voter
               const voters = Object.entries(room.votes || {}).filter(([vid, tid]) => tid === executedId).map(entry => entry[0]);
               if (voters.length > 0) {
                  const randomVoterId = voters[Math.floor(Math.random() * voters.length)];
                  const randomVoter = players[randomVoterId];
                  if (randomVoter && randomVoter.isAlive) {
                      randomVoter.isAlive = false;
                      room.gameLog.push(`Террорист забрал с собой ${randomVoter.nickname} (${randomVoter.role})!`);
                  }
               }
            }
         }
      } else {
         room.gameLog.push(`Голосование закончилось ничьей. Никто не казнен.`);
      }

      if (checkWinConditions(io, roomId)) return;
      startPhaseTimer(io, roomId, 'NIGHT');

   } else if (room.phase === 'NIGHT') {
      room.gameLog = [];
      const drTarget = room.nightActions?.['DOCTOR'];
      const sheriffTarget = room.nightActions?.['SHERIFF'];
      const mafiaTarget = room.nightActions?.['DON'] || room.nightActions?.['MAFIA'];

      if (mafiaTarget) {
         if (mafiaTarget === drTarget) {
            room.gameLog.push(`Ночью мафия пыталась убить игрока, но доктор спас его!`);
         } else {
            const victim = players[mafiaTarget];
            if (victim && victim.isAlive) {
               if (victim.inventory && victim.inventory.includes('armor')) {
                   victim.inventory = victim.inventory.filter(i => i !== 'armor');
                   room.gameLog.push(`Ночью мафия стреляла в ${victim.nickname}, но бронежилет спас ему жизнь!`);
               } else {
                   victim.isAlive = false;
                   room.gameLog.push(`Ночью был убит ${victim.nickname}. Роль: ${victim.role}`);
               }
            }
         }
      } else {
         room.gameLog.push(`Ночью никого не убили.`);
      }

      if (checkWinConditions(io, roomId)) return;

      // Send sheriff result privately
      if (sheriffTarget) {
         const t = players[sheriffTarget];
         const sheriffId = room.players.find(pid => players[pid]?.role === 'SHERIFF' && players[pid]?.isAlive);
         if (t && sheriffId) {
            const isMafia = t.role === 'MAFIA' || t.role === 'DON';
            const sheriffSocketId = Object.entries(socketToPlayerId).find(([sid, dbid]) => dbid === sheriffId);
            if (sheriffSocketId) {
                io.to(sheriffSocketId[0]).emit('chatMessage', {
                  id: Math.random().toString(),
                  senderId: 'system',
                  senderName: 'Проверка шерифа',
                  text: `Игрок ${t.nickname} — ${isMafia ? 'МАФИЯ' : 'МИРНЫЙ'}.`,
                  timestamp: Date.now(),
                  isGlobal: false,
                  roomId: room.id,
                  isSystem: true
                });
            }
         }
      }

      // Bartender action
      room.players.forEach(pid => {
         const p = players[pid];
         if (p && p.activeEffects) p.activeEffects = []; // reset daily effects
      });
      const bartenderTarget = room.nightActions?.['BARTENDER'];
      if (bartenderTarget) {
         const bt = players[bartenderTarget];
         if (bt && bt.isAlive) bt.activeEffects!.push('BARTENDER');
      }

      room.dayCount = (room.dayCount || 1) + 1;
      startPhaseTimer(io, roomId, 'RESULTS');
   } else if (room.phase === 'RESULTS') {
      startPhaseTimer(io, roomId, 'DAY');
   }
}

function checkWinConditions(io: Server<ClientToServerEvents, ServerToClientEvents>, roomId: string): boolean {
    const room = rooms[roomId];
    if (!room) return false;

    let mafias = 0;
    let innocents = 0;

    room.players.forEach(pid => {
       const p = players[pid];
       if (p && p.isAlive) {
          if (p.role === 'MAFIA' || p.role === 'DON') mafias++;
          else innocents++;
       }
    });

    if (mafias === 0) {
       endGame(io, roomId, 'TOWN');
       return true;
    } else if (mafias >= innocents) {
       endGame(io, roomId, 'MAFIA');
       return true;
    }
    return false;
}

function endGame(io: Server<ClientToServerEvents, ServerToClientEvents>, roomId: string, winner: string) {
    const room = rooms[roomId];
    if (!room) return;
    
    if (startTimers[roomId]) {
       clearInterval(startTimers[roomId]);
       delete startTimers[roomId];
    }
    
    room.status = 'FINISHED';
    room.gameLog = room.gameLog || [];
    room.gameLog.push(`ИГРА ОКОНЧЕНА. ПОБЕДА: ${winner === 'MAFIA' ? 'МАФИЯ' : winner === 'TOWN' ? 'ГОРОД' : 'ШУТ'}!`);
    
    // Give rewards and reset statuses
    room.players.forEach(pid => {
       const p = players[pid];
       if (p) {
          if (p.status === 'IN_GAME') {
             p.status = 'IN_ROOM';
             
             // Calculate if this player won based on factions
             let isWin = false;
             if (winner === 'TOWN' && p.role && !['MAFIA', 'DON', 'JESTER'].includes(p.role)) isWin = true;
             else if (winner === 'MAFIA' && ['MAFIA', 'DON'].includes(p.role!)) isWin = true;
             else if (winner === 'JESTER' && p.role === 'JESTER') isWin = true;

             p.coins += isWin ? 30 : 10;
             p.matchesPlayed = (p.matchesPlayed || 0) + 1;
             if (isWin) p.wins = (p.wins || 0) + 1;

             addStats(pid, isWin); // from DB
             updateUserStatus(pid, 'IN_ROOM');
          }
          p.role = undefined;
          p.isAlive = undefined;
       }
    });

    // Reset room state for possible restart
    room.phase = undefined;
    room.status = 'WAITING';
    
    broadcastState(io);
}

function resetStartTimer(io: Server<ClientToServerEvents, ServerToClientEvents>, roomId: string) {
    const room = rooms[roomId];
    if (!room) return;

    // Logic: if < 4 players, cancel start
    if (room.players.length < 4) {
      if (startTimers[roomId]) {
        clearInterval(startTimers[roomId]);
        delete startTimers[roomId];
      }
      room.status = 'WAITING';
      io.to(roomId).emit('startCanceled', 'Старт отменен: недостаточно игроков');
      broadcastState(io);
      return;
    }

    room.status = 'STARTING';
    
    if (startTimers[roomId]) {
      clearInterval(startTimers[roomId]);
    }

    let timeLeft = 20;
    startTimers[roomId] = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(startTimers[roomId]);
        delete startTimers[roomId];
        // Start Actual Game!
        startGameLogic(io, roomId);
      } else {
        io.to(roomId).emit('timerUpdate', { roomId, timeLeft });
      }
    }, 1000);
    
    io.to(roomId).emit('timerUpdate', { roomId, timeLeft });
    broadcastState(io);
  }

  function handleLeaveRoom(io: Server<ClientToServerEvents, ServerToClientEvents>, socketId: string) {
    const pId = socketToPlayerId[socketId];
    if (!pId) return;
    const p = players[pId];
    if (!p || !p.roomId) return;
    const roomId = p.roomId;
    const room = rooms[roomId];

    if (room) {
      if (room.status === 'IN_GAME') {
         p.status = 'PENALTY';
         updateUserStatus(pId, 'PENALTY');
         p.isAlive = false;
         
         const isMafia = p.role === 'MAFIA' || p.role === 'DON';
         room.gameLog = room.gameLog || [];
         room.gameLog.push(`Игрок ${p.nickname} позорно сбежал из города.`);
         checkWinConditions(io, room.id);
      }

      room.players = room.players.filter(id => id !== pId);
      
      if (room.players.length === 0) {
        delete rooms[roomId];
        if (startTimers[roomId]) {
           clearInterval(startTimers[roomId]);
           delete startTimers[roomId];
        }
      } else {
        if (room.hostId === pId) {
          room.hostId = room.players[0]; // pass host
        }
        if (room.status === 'STARTING') {
          if (room.players.length < 4) {
             clearInterval(startTimers[roomId]);
             delete startTimers[roomId];
             room.status = 'WAITING';
             io.to(roomId).emit('startCanceled', 'Старт отменен: недостаточно игроков');
          } else {
             resetStartTimer(io, roomId);
          }
        }
      }
    }

    p.roomId = undefined;
    if (p.status !== 'PENALTY') {
       p.status = 'IN_MENU';
       updateUserStatus(pId, 'IN_MENU');
    }
    const targetSocket = io.sockets.sockets.get(socketId);
    if(targetSocket) {
        targetSocket.leave(roomId);
    }
    broadcastState(io);
  }


  // Vite Handle
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
