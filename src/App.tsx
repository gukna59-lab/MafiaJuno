import React, { useState, useEffect } from 'react';
import { useStore } from './store.js';
import { LogOut, Users, MessageSquare, Play, Info, ShieldAlert, Flag } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Subcomponents
function NicknameScreen({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl">
        <h1 className="text-2xl font-bold mb-4 text-center">Mafia Juno</h1>
        <input 
          autoFocus
          className="w-full bg-slate-800 border items-center justify-center disabled:opacity-50 border-slate-700 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="Введи никнейм..." 
          value={name} 
          maxLength={15}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onJoin(name.trim())}
        />
        <button 
          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-lg transition-colors"
          onClick={() => name.trim() && onJoin(name.trim())}
        >
          Войти
        </button>
      </div>
    </div>
  );
}

function GlobalChat() {
  const { messages, socket, myId } = useStore();
  const [text, setText] = useState('');
  
  const handleSend = () => {
    if (text.trim() && socket) {
      socket.emit('sendChat', text.trim(), true);
      setText('');
    }
  };

  return (
    <div className="flex flex-col h-64 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="bg-slate-800 px-4 py-2 font-semibold text-sm flex items-center gap-2">
        <MessageSquare size={16} /> Глобальный чат
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 flex flex-col-reverse">
        {[...messages].reverse().filter(m => m.isGlobal).map(m => (
          <div key={m.id} className="text-sm">
            <span className={cn("font-medium", m.senderId === myId ? "text-rose-400" : "text-blue-400")}>
              {m.senderName}:
            </span>{' '}
            <span className="text-slate-300">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="flex p-2 bg-slate-800 gap-2">
        <input 
          type="text" 
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 bg-slate-700 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-500"
          placeholder="Сообщение..."
        />
      </div>
    </div>
  );
}

function MainMenu() {
  const { players, rooms, socket, myId } = useStore();
  const me = myId ? players[myId] : null;

  const handleEditProfile = () => {
    const newNick = window.prompt('Новый никнейм:', me?.nickname);
    if (newNick && newNick.trim() && socket) {
        socket.emit('updateProfile', newNick.trim(), me?.avatar || '');
    }
  };

  const [activeTab, setActiveTab] = useState<'ROOMS' | 'SHOP'>('ROOMS');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Users currently online in the menu (including self for now, or filter out)
  const onlinePlayers = Object.values(players).filter(p => p.status === 'IN_MENU' || p.status === 'IN_ROOM');

  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col gap-6 min-h-screen">
      {/* Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-72 bg-slate-900 border-r border-slate-800 h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-left">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Users size={20}/> Онлайн ({onlinePlayers.length})</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {onlinePlayers.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-slate-800 p-2 rounded relative group cursor-default">
                  <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
                     {p.avatar ? (
                       <img src={p.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-700 object-cover shrink-0" />
                     ) : (
                       <div className="w-8 h-8 bg-slate-700 text-slate-300 rounded-full flex items-center justify-center font-bold shrink-0">{p.nickname.charAt(0).toUpperCase()}</div>
                     )}
                     <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate text-sm" style={{color: p.vipColor || undefined}}>{p.nickname} {p.id === myId && "(Ты)"}</span>
                        <span className="text-xs text-slate-400">{p.status === 'IN_ROOM' ? 'В комнате' : 'В меню'}</span>
                     </div>
                  </div>
                  {p.id !== myId && p.status === 'IN_ROOM' && p.roomId && (
                    <button 
                      onClick={() => {
                        socket?.emit('joinRoom', p.roomId);
                        setIsDrawerOpen(false);
                      }}
                      className="text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition absolute right-2"
                    >
                      Войти
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setIsDrawerOpen(false)} className="mt-4 w-full bg-slate-800 p-2 rounded text-slate-400 hover:text-white font-medium">Закрыть</button>
          </div>
        </div>
      )}

      <header className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-4 cursor-pointer hover:bg-slate-800 p-2 rounded-lg transition" title="Изменить профиль" onClick={handleEditProfile}>
          {me?.avatar ? (
            <img src={me.avatar} alt="Avatar" className="w-12 h-12 rounded-full border border-slate-700 object-cover" />
          ) : (
            <div className="w-12 h-12 bg-rose-900 text-rose-200 rounded-full flex items-center justify-center font-bold text-xl">
               {me?.nickname.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="font-bold text-lg" style={{color: me?.vipColor || 'white'}}>{me?.nickname}</h2>
            <div className="text-sm text-yellow-500 font-medium">{me?.coins} монет</div>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg transition hidden md:block" title="Список друзей (Онлайн)"
          >
             <Users size={20} />
          </button>
          
          <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setActiveTab('ROOMS')} className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition", activeTab === 'ROOMS' ? "bg-slate-700 text-white" : "text-slate-400")}>Игры</button>
            <button onClick={() => setActiveTab('SHOP')} className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition", activeTab === 'SHOP' ? "bg-slate-700 text-white" : "text-slate-400")}>Магазин</button>
          </div>
          <div className="text-slate-400 flex items-center gap-2">
            {me?.status === 'PENALTY' && (
              <span className="bg-red-900/50 text-red-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                <ShieldAlert size={14}/> Штраф
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-4">
          {activeTab === 'ROOMS' ? (
            <>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <h2 className="font-semibold text-lg flex items-center gap-2"><Users size={20}/> Список комнат</h2>
                <button 
                  onClick={() => socket?.emit('createRoom', `${me?.nickname}'s Room`, false, 10)}
                  className="bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                  disabled={me?.status === 'PENALTY'}
                >
                  Создать игру
                </button>
              </div>
              
              <div className="space-y-3">
                {Object.values(rooms).length === 0 ? (
                  <div className="text-center p-8 text-slate-500 border border-slate-800 border-dashed rounded-xl">
                    Нет активных комнат
                  </div>
                ) : (
                  Object.values(rooms).map(room => (
                    <div key={room.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold">{room.name}</h3>
                        <div className="text-sm text-slate-400">{room.players.length}/{room.maxPlayers} игроков • {room.status}</div>
                      </div>
                      <button 
                        onClick={() => socket?.emit('joinRoom', room.id)}
                        className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Войти
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
               <h2 className="font-bold text-xl mb-4 text-yellow-400">Магазин (твой баланс: {me?.coins} 🪙)</h2>
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2 p-4 border border-slate-700 rounded-xl bg-slate-800/50">
                    <span className="font-bold text-rose-400">VIP-ник (Розовый)</span>
                    <span className="text-sm text-slate-400">Сделай свой ник выделяющимся в лобби и чате.</span>
                    <button onClick={() => socket?.emit('buyItem', 'color_#fb7185')} className="mt-auto bg-amber-600 hover:bg-amber-500 font-bold py-2 rounded-lg text-white">Купить (50 🪙)</button>
                  </div>
                  <div className="flex flex-col gap-2 p-4 border border-slate-700 rounded-xl bg-slate-800/50">
                    <span className="font-bold text-emerald-400">VIP-ник (Зеленый)</span>
                    <span className="text-sm text-slate-400">Сделай свой ник выделяющимся в лобби и чате.</span>
                    <button onClick={() => socket?.emit('buyItem', 'color_#34d399')} className="mt-auto bg-amber-600 hover:bg-amber-500 font-bold py-2 rounded-lg text-white">Купить (50 🪙)</button>
                  </div>
                  <div className="flex flex-col gap-2 p-4 border border-slate-700 rounded-xl bg-slate-800/50">
                    <span className="font-bold text-indigo-400 flex items-center gap-1"><ShieldAlert size={16}/> Бронежилет</span>
                    <span className="text-sm text-slate-400">Защитит вас от одного выстрела мафии ночью в следующей игре.</span>
                    <button onClick={() => socket?.emit('buyItem', 'armor')} className="mt-auto bg-amber-600 hover:bg-amber-500 font-bold py-2 rounded-lg text-white">Купить (100 🪙)</button>
                  </div>
                  <div className="flex flex-col gap-2 p-4 border border-slate-700 rounded-xl bg-slate-800/50">
                    <span className="font-bold text-rose-500 flex items-center gap-1">Контракт Дона</span>
                    <span className="text-sm text-slate-400">Повышает шанс стать Доном мафии в вашей следующей игре (1 раз).</span>
                    <button onClick={() => socket?.emit('buyItem', 'boost_don')} className="mt-auto bg-amber-600 hover:bg-amber-500 font-bold py-2 rounded-lg text-white">Купить (100 🪙)</button>
                  </div>
                  <div className="flex flex-col gap-2 p-4 border border-slate-700 rounded-xl bg-slate-800/50">
                    <span className="font-bold text-blue-400 flex items-center gap-1">Звезда Шерифа</span>
                    <span className="text-sm text-slate-400">Повышает шанс стать Шерифом в вашей следующей игре (1 раз).</span>
                    <button onClick={() => socket?.emit('buyItem', 'boost_sheriff')} className="mt-auto bg-amber-600 hover:bg-amber-500 font-bold py-2 rounded-lg text-white">Купить (100 🪙)</button>
                  </div>
               </div>
            </div>
          )}
          
          {me?.status === 'PENALTY' && (
             <div className="bg-red-950 border border-red-900 p-4 rounded-xl text-red-200 text-sm">
                <b>Система "Узы матча":</b> Вы вышли из незаконченной игры и получили временный штраф. Вы сможете присоединиться к новым комнатам после завершения вашего матча.
             </div>
          )}
        </div>
        
        <div className="flex flex-col gap-4">
          <GlobalChat />
          
          {/* Admin Panel Link or info */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-slate-400 text-center">
            Telegram Админка работает через бота.
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomView() {
  const { players, rooms, socket, myId, startTimer, messages } = useStore();
  const [chatText, setChatText] = useState('');
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  
  const me = myId ? players[myId] : null;
  const room = me?.roomId ? rooms[me.roomId] : null;

  if (!me || !room) return null;

  const isHost = room.hostId === myId;
  const isNight = room.phase === 'NIGHT';
  const isVoting = room.phase === 'VOTING';

  const handleSendGroup = () => {
    if (chatText.trim() && socket) {
      if (isNight && (me.role === 'MAFIA' || me.role === 'DON')) {
        socket.emit('sendChat', chatText.trim(), false, true); // mafia chat
      } else {
        socket.emit('sendChat', chatText.trim(), false);
      }
      setChatText('');
    }
  };

  const handleReport = (targetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const reason = window.prompt("Причина репорта?");
    if (reason && socket) {
      socket.emit('reportPlayer', targetId, reason, 'Отправлено из игры');
      alert("Репорт отправлен админу!");
    }
  };

  const handlePlayerAction = (targetId: string) => {
     if (room.status === 'WAITING' && isHost) {
        socket?.emit('proposeKick', targetId);
     } else if (room.status === 'IN_GAME') {
        if (isVoting) {
           socket?.emit('submitDayVote', targetId);
        } else if (isNight && me.role) {
           socket?.emit('submitNightAction', targetId);
        }
     }
  };

  const roleDesc: Record<string, string> = {
    'SHERIFF': 'Проверяй роли игроков ночью.',
    'DOCTOR': 'Спасай одного игрока за ночь.',
    'DON': 'Ты глава мафии. Решай, кого убить!',
    'MAFIA': 'Помогай Дону устранять мирных.',
    'CITIZEN': 'Вычисли мафию на дневном обсуждении.',
    'MEDIUM': 'Читай ночной чат мафии, но не знай кто есть кто.',
    'JESTER': 'Сделай так, чтобы тебя казнили днем.',
    'TERRORIST': 'Если тебя казнят, ты заберешь одного из голосовавших с собой.',
    'BARTENDER': 'Спаивай одну цель ночью. Завтра ее слова в чате будут перепутаны!'
  };

  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col h-screen">
      <header className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800 shrink-0 relative">
        <div>
           <h2 className="font-bold text-lg">{room.name}</h2>
           {room.status === 'IN_GAME' ? (
              <span className="text-sm text-yellow-400 font-bold">День {room.dayCount || 1} • {room.phase === 'DAY' ? 'ОБСУЖДЕНИЕ' : room.phase === 'VOTING' ? 'ГОЛОСОВАНИЕ' : room.phase === 'NIGHT' ? 'НОЧЬ' : 'ИТОГИ'}</span>
           ) : (
              <span className="text-sm text-slate-400">В лобби: {room.players.length} / {room.maxPlayers}</span>
           )}
        </div>
        <div className="flex items-center gap-3">
           {room.status === 'IN_GAME' && me.role && (
             <div className="relative">
                <button onMouseEnter={() => setShowRoleInfo(true)} onMouseLeave={() => setShowRoleInfo(false)} className="bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold">
                   <Info size={16}/> Твоя роль: {me.role}
                </button>
                {showRoleInfo && (
                   <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                      <h4 className="font-bold text-white mb-1">{me.role}</h4>
                      <p className="text-sm text-slate-300">{roleDesc[me.role]}</p>
                   </div>
                )}
             </div>
           )}
           <button onClick={() => socket?.emit('leaveRoom')} className="text-slate-400 hover:text-white p-2">
             <LogOut size={20}/>
           </button>
        </div>
      </header>

      {room.status === 'STARTING' && startTimer !== null && (
        <div className="bg-rose-600/20 border border-rose-600 text-rose-200 my-4 p-4 rounded-xl text-center font-bold animate-pulse">
           Игра начнется через {startTimer} сек...
        </div>
      )}

      {room.kickVote && (
         <div className="bg-red-900/40 border border-red-700 p-4 rounded-xl my-4 flex justify-between items-center">
            <div>
               <h3 className="font-bold text-red-100">Голосование на кик: {players[room.kickVote.targetId]?.nickname}</h3>
               <p className="text-sm text-red-300">За: {room.kickVote.votesFor.length} | Против: {room.kickVote.votesAgainst.length}</p>
            </div>
            <div className="flex gap-2">
               <button onClick={() => socket?.emit('voteKick', room.kickVote!.targetId, true)} className="bg-red-600 px-4 py-2 rounded-lg font-bold">За</button>
               <button onClick={() => socket?.emit('voteKick', room.kickVote!.targetId, false)} className="bg-slate-700 px-4 py-2 rounded-lg font-bold">Против</button>
            </div>
         </div>
      )}

      {/* Game Logs for Morning */}
      {room.status === 'IN_GAME' && (room.phase === 'DAY' || room.phase === 'RESULTS') && room.gameLog && room.gameLog.length > 0 && (
          <div className="bg-amber-900/20 border border-amber-900/50 rounded-xl p-4 my-4 space-y-1">
             {room.gameLog.map((log, i) => (
                <div key={i} className="text-amber-200 text-sm font-medium">📜 {log}</div>
             ))}
          </div>
      )}

      <div className="flex flex-1 gap-4 mt-4 overflow-hidden">
        {/* Chat / Action Zone */}
        <div className="flex-1 flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative">
           {isNight && (me.role !== 'MAFIA' && me.role !== 'DON') && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-10">
                 <div className="text-center">
                    <div className="text-indigo-400 text-6xl mb-4">🌙</div>
                    <h3 className="text-2xl font-bold text-indigo-300">Ночь</h3>
                    <p className="text-indigo-200/60 mt-2">Город спит. Выберите действие справа, если у вас активная роль.</p>
                 </div>
              </div>
           )}

           <div className="flex-1 p-4 overflow-y-auto space-y-2 relative z-0 flex flex-col-reverse">
              {[...messages].filter(m => !m.isGlobal && m.roomId === room.id).reverse().map(m => (
                 <div key={m.id} className="text-sm">
                   {m.isSystem ? (
                      <span className="text-yellow-500 font-bold">⚙ Система: {m.text}</span>
                   ) : (
                     <>
                        <strong className={cn(m.senderId === myId ? "text-rose-400" : "text-blue-400", m.isMafiaOnly && "text-red-500")} style={{color: players[m.senderId]?.vipColor || undefined}}>
                        {m.senderName}: 
                        </strong> <span className={cn("text-slate-300", m.isMafiaOnly && "text-red-200")}>{m.text}</span>
                     </>
                   )}
                 </div>
              ))}
           </div>
           
           <div className="p-3 bg-slate-800 flex gap-2 relative z-20">
             <input 
               className="flex-1 bg-slate-700 rounded px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
               value={chatText}
               disabled={(room.status === 'IN_GAME' && room.phase !== 'DAY' && room.phase !== 'RESULTS' && !(isNight && (me.role === 'MAFIA' || me.role === 'DON'))) || !me.isAlive}
               onChange={e => setChatText(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handleSendGroup()}
               placeholder={!me.isAlive ? "Мертвые не общаются" : isNight && (me.role === 'MAFIA' || me.role === 'DON') ? "Секретный чат мафии..." : "Чат комнаты..."}
             />
           </div>
        </div>

        {/* Players List Right sidebar */}
        <div className="w-64 bg-slate-900 rounded-xl border border-slate-800 flex flex-col">
           <div className="p-3 font-semibold border-b border-slate-800 flex justify-between items-center">
             <span>Игроки ({room.players.length})</span>
           </div>
           <div className="flex-1 overflow-y-auto p-2">
             <div className="grid grid-cols-2 gap-1">
             {room.players.map(pid => {
               const p = players[pid];
               if(!p) return null;
               
               const myVoteTargets = isVoting ? room.votes?.[myId!] : isNight ? room.nightActions?.[me.role || ''] : undefined;
               const isTargeted = myVoteTargets === pid;

               return (
                 <div 
                   key={pid} 
                   onClick={() => handlePlayerAction(pid)}
                   className={cn(
                      "p-1.5 rounded flex items-center group transition text-xs overflow-hidden relative",
                      (isVoting || isNight || (room.status === 'WAITING' && isHost)) && pid !== myId ? "hover:bg-slate-700 cursor-pointer" : "cursor-default hover:bg-slate-800",
                      isTargeted && "ring-1 ring-rose-500 bg-rose-500/10",
                      p.isAlive === false && "opacity-40 grayscale blur-[0.5px]"
                   )}
                 >
                   <div className="flex items-center gap-1.5 overflow-hidden pointer-events-none w-full">
                     {p.avatar ? (
                       <img src={p.avatar} alt="Avatar" className="w-5 h-5 rounded-full border border-slate-700 object-cover shrink-0" />
                     ) : (
                       <div className="w-5 h-5 bg-slate-700 text-slate-300 rounded-full flex items-center justify-center shrink-0">{p.nickname.charAt(0).toUpperCase()}</div>
                     )}
                     <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium truncate text-white" style={{color: p.vipColor || undefined}}>{p.nickname} {pid === room.hostId && "👑"}</span>
                        {p.isAlive === false && <span className="text-[9px] text-red-400 truncate">Мертв ({p.role})</span>}
                        {p.role && p.isAlive && room.status === 'FINISHED' && <span className="text-[9px] text-indigo-300 truncate">{p.role}</span>}
                     </div>
                   </div>
                   <div className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-slate-800 to-transparent flex items-center justify-end px-1 opacity-0 group-hover:opacity-100 transition z-10">
                     <button 
                       onClick={(e) => handleReport(pid, e)}
                       className="text-slate-500 hover:text-red-400 p-1" 
                       title="Пожаловаться"
                     >
                       <Flag size={12}/>
                     </button>
                   </div>
                 </div>
               );
             })}
             </div>
           </div>
           
           {isHost && room.status === 'WAITING' && (
             <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-900 rounded-b-xl">
               <button 
                 onClick={() => socket?.emit('startGame')}
                 className="w-full bg-rose-600 hover:bg-rose-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2"
               >
                 <Play size={18}/> НАЧАТЬ ИГРУ
               </button>
             </div>
           )}
        </div>
      </div>
    </div>
  )
}



// Main
export default function App() {
  const { socket, myId, players, error, connect } = useStore();

  useEffect(() => {
    // Hide standard frame limits, this is a web app.
    document.body.className = "bg-slate-950 text-slate-100 font-sans selection:bg-rose-500/30";

    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe.user;
      connect({ id: String(user.id), nickname: user.first_name || user.username || 'Игрок', avatar: user.photo_url });
    }
  }, []);

  if (!socket || !myId) {
    return <NicknameScreen onJoin={(name) => {
      // Create a persistent local ID for non-TB browsers
      let localId = localStorage.getItem('mafiaId');
      if (!localId) {
        localId = 'web_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('mafiaId', localId);
      }
      connect({ id: localId, nickname: name });
    }} />;
  }

  const me = players[myId];
  if (!me) return <div className="flex h-screen items-center justify-center font-bold animate-pulse text-slate-500">Загрузка данных...</div>;

  return (
    <>
      {error && (
        <div className="fixed top-4 right-4 bg-red-600/90 backdrop-blur text-white px-4 py-3 rounded-xl shadow-lg z-50 animate-in slide-in-from-top flex items-center gap-3 max-w-sm">
           <ShieldAlert size={20} />
           <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      
      {me.status === 'IN_ROOM' || me.status === 'IN_GAME' ? (
        <RoomView />
      ) : (
        <MainMenu />
      )}
    </>
  );
}
