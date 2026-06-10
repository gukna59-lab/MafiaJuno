import React, { useState, useEffect, useRef } from 'react';
import { useStore } from './store.js';
import { LogOut, Users, MessageSquare, Play, Info, ShieldAlert, Flag, Moon, Sun } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Subcomponents
function NicknameScreen({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="flex items-center justify-center min-h-screen relative p-4 overflow-hidden z-0">
      <div className="absolute inset-0 pointer-events-none -z-10 bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 dark:bg-indigo-600/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-rose-500/20 dark:bg-rose-600/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '11s' }} />
      </div>
      
      <div className="max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] backdrop-blur-xl bg-opacity-80 dark:bg-opacity-80 animate-in zoom-in-95 duration-500">
        <h1 className="text-2xl font-bold mb-4 text-center">Mafia Juno</h1>
        <input 
          autoFocus
          className="w-full bg-slate-100 dark:bg-slate-800 border items-center justify-center disabled:opacity-50 border-slate-300 dark:border-slate-700 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="Введи никнейм..." 
          value={name} 
          maxLength={15}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onJoin(name.trim())}
        />
        <button 
          className="w-full bg-rose-600 hover:bg-rose-700 text-slate-900 dark:text-white font-semibold py-3 rounded-lg transition-colors"
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
    <div className="flex flex-col h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-semibold text-sm flex items-center gap-2">
        <MessageSquare size={16} /> Глобальный чат
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 flex flex-col-reverse">
        {[...messages].reverse().filter(m => m.isGlobal).map(m => (
          <div key={m.id} className="text-sm">
            <span className={cn("font-medium", m.senderId === myId ? "text-rose-400" : "text-blue-400")}>
              {m.senderName}:
            </span>{' '}
            <span className="text-slate-600 dark:text-slate-300">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="flex p-2 bg-slate-100 dark:bg-slate-800 gap-2">
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
  const { players, rooms, socket, myId, reports } = useStore();
  const me = myId ? players[myId] : null;

  useEffect(() => {
    if (me?.isAdmin) {
       socket?.emit('getReports');
    }
  }, [me?.isAdmin, socket]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEditProfile = () => {
    const newNick = window.prompt('Новый никнейм:', me?.nickname);
    if (newNick && newNick.trim() && socket) {
        socket.emit('updateProfile', newNick.trim(), me?.avatar || '');
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
           const result = event.target?.result as string;
           const img = new Image();
           img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 256;
              const MAX_HEIGHT = 256;
              let width = img.width;
              let height = img.height;
              
              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              socket?.emit('updateProfile', me?.nickname || 'Player', dataUrl);
           };
           img.src = result;
        };
        reader.readAsDataURL(file);
     }
  };

  const [activeTab, setActiveTab] = useState<'ROOMS' | 'SHOP' | 'ADMIN'>('ROOMS');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [createData, setCreateData] = useState({ show: false, name: `${me?.nickname}'s Room`, maxPlayers: 10, isPrivate: false, password: '' });
  const [joinData, setJoinData] = useState<{ show: boolean, roomId: string, password: '' }>({ show: false, roomId: '', password: '' });

  // Users currently online in the menu (including self for now, or filter out)
  const onlinePlayers = Object.values(players).filter(p => p.status === 'IN_MENU' || p.status === 'IN_ROOM');

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
       document.documentElement.classList.add('dark');
    } else {
       document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col gap-6 min-h-screen">
      {/* Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-left">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Users size={20}/> Онлайн ({onlinePlayers.length})</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {onlinePlayers.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-2 rounded relative group cursor-default">
                  <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
                     {p.avatar ? (
                       <img src={p.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 object-cover shrink-0" />
                     ) : (
                       <div className="w-8 h-8 bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center font-bold shrink-0">{p.nickname.charAt(0).toUpperCase()}</div>
                     )}
                     <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate text-sm" style={{color: p.vipColor || undefined}}>{p.nickname} {p.id === myId && "(Ты)"}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{p.status === 'IN_ROOM' ? 'В комнате' : 'В меню'}</span>
                     </div>
                  </div>
                  {p.id !== myId && p.status === 'IN_ROOM' && p.roomId && (
                    <button 
                      onClick={() => {
                        socket?.emit('joinRoom', p.roomId);
                        setIsDrawerOpen(false);
                      }}
                      className="text-xs font-bold bg-rose-600 hover:bg-rose-500 text-slate-900 dark:text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition absolute right-2"
                    >
                      Войти
                    </button>
                  )}
                  {p.id !== myId && p.status === 'IN_MENU' && me?.roomId && (
                    <button 
                      onClick={() => {
                        socket?.emit('invitePlayer', p.id);
                        document.dispatchEvent(new CustomEvent('toast', { detail: 'Приглашение отправлено' }));
                      }}
                      className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition absolute right-2"
                    >
                      Позвать
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setIsDrawerOpen(false)} className="mt-4 w-full bg-slate-100 dark:bg-slate-800 p-2 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white font-medium">Закрыть</button>
          </div>
        </div>
      )}

      <header className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <input type="file" ref={fileInputRef} onChange={handleAvatarSelect} className="hidden" accept="image/*" />
          <div className="cursor-pointer hover:opacity-80 transition" title="Изменить аватарку" onClick={() => fileInputRef.current?.click()}>
            {me?.avatar ? (
              <img src={me.avatar} alt="Avatar" className="w-12 h-12 rounded-full border border-slate-300 dark:border-slate-700 object-cover" />
            ) : (
              <div className="w-12 h-12 bg-rose-900 text-rose-200 rounded-full flex items-center justify-center font-bold text-xl">
                 {me?.nickname.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="cursor-pointer hover:bg-slate-100 dark:bg-slate-800 p-2 rounded-lg transition" title="Изменить профиль" onClick={handleEditProfile}>
            <h2 className="font-bold text-lg leading-tight" style={{color: me?.vipColor || 'white'}}>{me?.nickname}</h2>
            <div className="flex gap-3 text-xs font-medium mt-1">
              <span className="text-yellow-500">{me?.coins} 🪙</span>
              <span className="text-emerald-400">{me?.wins || 0} Поб.</span>
              <span className="text-slate-500 dark:text-slate-400">{me?.matchesPlayed || 0} Игр</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <button 
            onClick={toggleTheme}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 p-2 rounded-lg transition" title="Сменить тему"
          >
             {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 p-2 rounded-lg transition hidden md:block" title="Список друзей (Онлайн)"
          >
             <Users size={20} />
          </button>
          
          <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setActiveTab('ROOMS')} className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition", activeTab === 'ROOMS' ? "bg-slate-700 text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>Игры</button>
            <button onClick={() => setActiveTab('SHOP')} className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition", activeTab === 'SHOP' ? "bg-slate-700 text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>Магазин</button>
            {me?.isAdmin && <button onClick={() => setActiveTab('ADMIN')} className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition text-rose-400", activeTab === 'ADMIN' ? "bg-rose-900/50" : "text-rose-400/50 hover:text-rose-400")}>Админ</button>}
          </div>
          <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
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
          {activeTab === 'ROOMS' && (
            <>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h2 className="font-semibold text-lg flex items-center gap-2"><Users size={20}/> Список комнат</h2>
                <button 
                  onClick={() => setCreateData({...createData, show: true})}
                  className="bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 shadow-lg shadow-rose-900/20"
                  disabled={me?.status === 'PENALTY'}
                >
                  Создать игру
                </button>
              </div>
              
              <div className="space-y-3">
                {Object.values(rooms).length === 0 ? (
                  <div className="text-center p-8 text-slate-500 border border-slate-200 dark:border-slate-800 border-dashed rounded-xl">
                    Нет активных комнат
                  </div>
                ) : (
                  Object.values(rooms).map(room => (
                    <div key={room.id} className="bg-white dark:bg-slate-900/80 hover:bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center transition-all group relative overflow-hidden">
                      <div className="flex flex-col gap-1 z-10">
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          {room.isPrivate && <ShieldAlert size={14} className="text-amber-500" title="Приватная комната" />}
                          {room.name}
                        </h3>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                           <span className={room.players.length >= room.maxPlayers ? 'text-rose-400' : 'text-emerald-400'}>{room.players.length}/{room.maxPlayers}</span>
                           <span> • {room.status === 'WAITING' ? 'Ожидание игроков' : 'В игре'}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (room.status !== 'WAITING') {
                             document.dispatchEvent(new CustomEvent('toast', { detail: 'Игра уже началась!' }));
                             return;
                          }
                          if (room.isPrivate) {
                             setJoinData({ show: true, roomId: room.id, password: '' });
                          } else {
                             socket?.emit('joinRoom', room.id);
                          }
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all z-10",
                          room.status === 'WAITING' ? "bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                        )}
                      >
                        {room.status === 'WAITING' ? (room.isPrivate ? 'Код' : 'Войти') : 'Идет'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'ADMIN' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
               <h2 className="font-bold text-xl text-rose-400">Жалобы игроков</h2>
               <div className="space-y-3">
                 {reports.length === 0 ? (
                   <div className="text-center p-8 border border-slate-200 dark:border-slate-800 border-dashed rounded-xl text-slate-500">
                     Жалоб пока нет.
                   </div>
                 ) : (
                   reports.map(r => (
                      <div key={r.id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                        <div className="flex justify-between text-sm">
                           <span className="text-slate-500 dark:text-slate-400">От: <b>{r.reporterName}</b></span>
                           <span className="text-slate-500 dark:text-slate-400">{new Date(r.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm font-medium">На игрока: <b className="text-rose-500">{r.targetName}</b> (ID: {r.targetId})</p>
                        <p className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm">{r.reason}</p>
                        <div className="flex justify-end gap-2 mt-2">
                           <button onClick={() => socket?.emit('adminAction', 'dismiss', r.targetId)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-300 rounded font-bold text-sm">Отклонить</button>
                           <button onClick={() => socket?.emit('adminAction', 'ban', r.targetId)} className="px-4 py-2 bg-red-600 text-white rounded font-bold text-sm">Забанить</button>
                        </div>
                      </div>
                   ))
                 )}
               </div>
            </div>
          )}

          {activeTab === 'SHOP' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
               <h2 className="font-bold text-xl mb-4 text-yellow-400">Магазин (твой баланс: {me?.coins} 🪙)</h2>
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2 p-4 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                    <span className="font-bold text-rose-400">VIP-ник (Розовый)</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Сделай свой ник выделяющимся в лобби и чате.</span>
                    <button onClick={() => socket?.emit('buyItem', 'color_#fb7185')} className="mt-auto bg-amber-600 hover:bg-amber-500 font-bold py-2 rounded-lg text-slate-900 dark:text-white">Купить (50 🪙)</button>
                  </div>
                  <div className="flex flex-col gap-2 p-4 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                    <span className="font-bold text-emerald-400">VIP-ник (Зеленый)</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Сделай свой ник выделяющимся в лобби и чате.</span>
                    <button onClick={() => socket?.emit('buyItem', 'color_#34d399')} className="mt-auto bg-amber-600 hover:bg-amber-500 font-bold py-2 rounded-lg text-slate-900 dark:text-white">Купить (50 🪙)</button>
                  </div>
                  <div className="flex flex-col gap-2 p-4 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                    <span className="font-bold text-indigo-400 flex items-center gap-1"><ShieldAlert size={16}/> Бронежилет</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Защитит вас от одного выстрела мафии ночью в следующей игре.</span>
                    <button onClick={() => socket?.emit('buyItem', 'armor')} className="mt-auto bg-amber-600 hover:bg-amber-500 font-bold py-2 rounded-lg text-slate-900 dark:text-white">Купить (100 🪙)</button>
                  </div>
                  <div className="flex flex-col gap-2 p-4 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                    <span className="font-bold text-rose-500 flex items-center gap-1">Контракт Дона</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Повышает шанс стать Доном мафии в вашей следующей игре (1 раз).</span>
                    <button onClick={() => socket?.emit('buyItem', 'boost_don')} className="mt-auto bg-amber-600 hover:bg-amber-500 font-bold py-2 rounded-lg text-slate-900 dark:text-white">Купить (100 🪙)</button>
                  </div>
                  <div className="flex flex-col gap-2 p-4 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                    <span className="font-bold text-blue-400 flex items-center gap-1">Звезда Шерифа</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Повышает шанс стать Шерифом в вашей следующей игре (1 раз).</span>
                    <button onClick={() => socket?.emit('buyItem', 'boost_sheriff')} className="mt-auto bg-amber-600 hover:bg-amber-500 font-bold py-2 rounded-lg text-slate-900 dark:text-white">Купить (100 🪙)</button>
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-500 dark:text-slate-400 text-center">
             Mafia Juno Beta v0.2.0<br/>Powered by Google
          </div>
        </div>
      </div>

      {createData.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => setCreateData({...createData, show: false})}></div>
           <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95">
              <h2 className="text-xl font-bold">Настройки комнаты</h2>
              <input 
                value={createData.name} 
                onChange={e => setCreateData({...createData, name: e.target.value})} 
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-2 rounded-lg"
                placeholder="Название комнаты"
              />
              <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-300 dark:border-slate-700">
                <span>Макс. игроков</span>
                <input 
                  type="number" 
                  min={4} max={16} 
                  value={createData.maxPlayers} 
                  onChange={e => setCreateData({...createData, maxPlayers: Math.max(4, parseInt(e.target.value))})} 
                  className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-1 rounded-lg text-center"
                />
              </div>
              <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-300 dark:border-slate-700">
                <span>Приватная</span>
                <input type="checkbox" checked={createData.isPrivate} onChange={e => setCreateData({...createData, isPrivate: e.target.checked})} className="w-5 h-5 accent-rose-600"/>
              </div>
              {createData.isPrivate && (
                <input 
                  value={createData.password} 
                  onChange={e => setCreateData({...createData, password: e.target.value})} 
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-2 rounded-lg"
                  placeholder="Пароль (код)"
                />
              )}
              <div className="flex gap-2 mt-2">
                 <button onClick={() => setCreateData({...createData, show: false})} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold">Отмена</button>
                 <button onClick={() => {
                   socket?.emit('createRoom', createData.name, createData.isPrivate, createData.maxPlayers, createData.password);
                   setCreateData({...createData, show: false});
                 }} className="flex-1 bg-rose-600 text-slate-900 dark:text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-900/50 hover:bg-rose-500">Создать</button>
              </div>
           </div>
        </div>
      )}

      {joinData.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => setJoinData({...joinData, show: false})}></div>
           <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95">
              <h2 className="text-xl font-bold">Вход в комнату</h2>
              <input 
                autoFocus
                value={joinData.password} 
                onChange={e => setJoinData({...joinData, password: e.target.value})} 
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-2 rounded-lg"
                placeholder="Введите пароль..."
                onKeyDown={e => {
                  if(e.key === 'Enter') {
                    socket?.emit('joinRoom', joinData.roomId, joinData.password);
                    setJoinData({...joinData, show: false});
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                 <button onClick={() => setJoinData({...joinData, show: false})} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold">Отмена</button>
                 <button onClick={() => {
                   socket?.emit('joinRoom', joinData.roomId, joinData.password);
                   setJoinData({...joinData, show: false});
                 }} className="flex-1 bg-indigo-600 text-slate-900 dark:text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/50 hover:bg-indigo-500">Войти</button>
              </div>
           </div>
        </div>
      )}
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
     if (room.status === 'WAITING' && isHost && targetId !== myId) {
        if (window.confirm(`Предложить кик игрока ${players[targetId]?.nickname}?`)) {
           socket?.emit('proposeKick', targetId);
        }
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
      <header className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 relative">
        <div>
           <h2 className="font-bold text-lg">{room.name}</h2>
           {room.status === 'IN_GAME' ? (
              <span className="text-sm text-yellow-400 font-bold">День {room.dayCount || 1} • {room.phase === 'DAY' ? 'ОБСУЖДЕНИЕ' : room.phase === 'VOTING' ? 'ГОЛОСОВАНИЕ' : room.phase === 'NIGHT' ? 'НОЧЬ' : 'ИТОГИ'}</span>
           ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">В лобби: {room.players.length} / {room.maxPlayers}</span>
           )}
        </div>
        <div className="flex items-center gap-3">
           {room.status === 'IN_GAME' && me.role && (
             <>
                <button onClick={() => setShowRoleInfo(true)} className="bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg h-9 hover:bg-indigo-800 transition">
                   <Info size={16}/> Роль
                </button>
                {showRoleInfo && (
                   <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowRoleInfo(false)}></div>
                      <div className="relative w-full max-w-sm bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-300 dark:border-slate-700 rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 fade-in duration-300">
                         <button onClick={() => setShowRoleInfo(false)} className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full"><LogOut size={16} className="rotate-180"/></button>
                         <div className={cn(
                            "w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-inner border-[6px]",
                            ['DON', 'MAFIA'].includes(me.role) ? 'bg-red-950/80 border-red-500/50 text-red-500 shadow-red-900/50' :
                            ['JESTER', 'TERRORIST', 'BARTENDER'].includes(me.role) ? 'bg-amber-950/80 border-amber-500/50 text-amber-500 shadow-amber-900/50' :
                            'bg-blue-950/80 border-blue-500/50 text-blue-500 shadow-blue-900/50'
                         )}>
                            <span className="font-extrabold text-4xl">{me.role.charAt(0)}</span>
                         </div>
                         <h4 className={cn("font-black text-3xl uppercase tracking-widest mb-3", 
                            ['DON', 'MAFIA'].includes(me.role) ? 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]' :
                            ['JESTER', 'TERRORIST', 'BARTENDER'].includes(me.role) ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' :
                            'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]'
                         )}>{me.role}</h4>
                         <p className="text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-[250px]">
                           {roleDesc[me.role]}
                         </p>
                      </div>
                   </div>
                )}
             </>
           )}
           <button onClick={() => socket?.emit('leaveRoom')} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white p-2">
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
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
           {isNight && (me.role !== 'MAFIA' && me.role !== 'DON') && (
              <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-10">
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
                        </strong> <span className={cn("text-slate-600 dark:text-slate-300", m.isMafiaOnly && "text-red-200")}>{m.text}</span>
                     </>
                   )}
                 </div>
              ))}
           </div>
           
           <div className="p-3 bg-slate-100 dark:bg-slate-800 flex gap-2 relative z-20">
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
        <div className="w-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col">
           <div className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
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
                      (isVoting || isNight || (room.status === 'WAITING' && isHost)) && pid !== myId ? "hover:bg-slate-700 cursor-pointer" : "cursor-default hover:bg-slate-100 dark:bg-slate-800",
                      isTargeted && "ring-1 ring-rose-500 bg-rose-500/10",
                      p.isAlive === false && "opacity-40 grayscale blur-[0.5px]"
                   )}
                 >
                   <div className="flex items-center gap-1.5 overflow-hidden pointer-events-none w-full">
                     {p.avatar ? (
                       <img src={p.avatar} alt="Avatar" className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 object-cover shrink-0" />
                     ) : (
                       <div className="w-5 h-5 bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center shrink-0">{p.nickname.charAt(0).toUpperCase()}</div>
                     )}
                     <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium truncate text-slate-900 dark:text-white" style={{color: p.vipColor || undefined}}>{p.nickname} {pid === room.hostId && "👑"}</span>
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
             <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 rounded-b-xl">
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
  const [inviteData, setInviteData] = useState<{roomId: string, roomName: string, fromName: string} | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Hide standard frame limits, this is a web app.
    document.body.className = "bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-rose-500/30 transition-colors duration-300";

    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe.user;
      connect({ id: String(user.id), nickname: user.first_name || user.username || 'Игрок', avatar: user.photo_url });
      setIsInitializing(false);
      return;
    }

    let localId = localStorage.getItem('mafiaId');
    let localNick = localStorage.getItem('mafiaNickname');
    
    if (localId && localNick) {
       connect({ id: localId, nickname: localNick });
       setIsInitializing(false);
    } else {
       setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    if (socket) {
       socket.on('invited', (data) => {
          setInviteData(data);
       });
       
       const toastListener = (e: any) => useStore.getState().setError(e.detail);
       document.addEventListener('toast', toastListener as EventListener);
       
       return () => {
          socket.off('invited');
          document.removeEventListener('toast', toastListener as EventListener);
       }
    }
  }, [socket]);

  if (isInitializing) return <div className="flex h-screen items-center justify-center font-bold animate-pulse text-slate-500">Загрузка...</div>;

  if (!socket || !myId) {
    return <NicknameScreen onJoin={(name) => {
      let localId = localStorage.getItem('mafiaId');
      if (!localId) {
        localId = 'web_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('mafiaId', localId);
      }
      localStorage.setItem('mafiaNickname', name);
      connect({ id: localId, nickname: name });
    }} />;
  }

  const me = players[myId];
  if (!me) return <div className="flex h-screen items-center justify-center font-bold animate-pulse text-slate-500">Загрузка данных...</div>;

  return (
    <>
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 dark:bg-indigo-600/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-rose-500/20 dark:bg-rose-600/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '11s' }} />
      </div>

      {error && (
        <div className="fixed top-4 right-4 bg-red-600/90 backdrop-blur text-slate-900 dark:text-white px-4 py-3 rounded-xl shadow-lg z-50 animate-in slide-in-from-top flex items-center gap-3 max-w-sm">
           <ShieldAlert size={20} />
           <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {inviteData && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-indigo-900 border border-indigo-700 text-slate-900 dark:text-white px-4 py-3 rounded-xl shadow-2xl z-50 animate-in slide-in-from-top flex flex-col gap-2 min-w-[280px]">
           <div className="flex items-center gap-2">
             <MessageSquare size={16} className="text-indigo-400"/>
             <span className="font-bold text-sm">Приглашение в игру</span>
           </div>
           <p className="text-sm text-slate-600 dark:text-slate-300">
             <strong className="text-slate-900 dark:text-white">{inviteData.fromName}</strong> зовет вас в комнату: <br/><strong className="text-indigo-200">{inviteData.roomName}</strong>
           </p>
           <div className="flex gap-2 mt-2">
             <button 
               onClick={() => {
                 socket?.emit('joinRoom', inviteData.roomId);
                 setInviteData(null);
               }}
               className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded-lg text-xs font-bold transition"
             >Принять</button>
             <button 
               onClick={() => setInviteData(null)}
               className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 py-1.5 rounded-lg text-xs font-bold transition text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white"
             >Отклонить</button>
           </div>
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
