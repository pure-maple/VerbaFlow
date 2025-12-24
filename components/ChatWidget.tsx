import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Plus, Trash2, Edit2, Sparkles, MessageSquare, Maximize2, Minimize2, Check, PenSquare, Download } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChatSession, ChatMessage } from '../types';
import { chatWithAgent, generateSessionTitle } from '../services/geminiService';
import { useConfig } from '../contexts/ConfigContext';
import { storage } from '../services/storage';

const ChatWidget: React.FC = () => {
  const { t } = useLanguage();
  const { geminiApiKey, geminiBaseUrl } = useConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");
  
  // Renaming State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load from IndexedDB
  useEffect(() => {
    const loadChats = async () => {
        try {
            const loaded = await storage.loadChats();
            if (Array.isArray(loaded) && loaded.length > 0) {
                setSessions(loaded);
            }
        } catch (e) {
            console.error("Failed to load chat history", e);
        }
    };
    loadChats();
  }, []);

  // Save to IndexedDB
  useEffect(() => {
    // Debounce save to avoid performance hits
    const timer = setTimeout(() => {
        if (sessions.length > 0) {
            storage.saveChats(sessions);
        }
    }, 1000);
    return () => clearTimeout(timer);
  }, [sessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, isTyping]);

  const createSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: t.chat.newChat,
      messages: [],
      model: selectedModel,
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const startEditing = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const saveTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingSessionId) {
      setSessions(prev => prev.map(s => s.id === editingSessionId ? { ...s, title: editTitle } : s));
      setEditingSessionId(null);
    }
  };

  const handleExportSession = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    const markdown = session.messages.map(m => `**${m.role === 'user' ? 'User' : 'VerbaFlow AI'} (${new Date(m.timestamp).toLocaleTimeString()}):**\n\n${m.content}\n\n---\n`).join('\n');
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_export_${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!geminiApiKey) {
        alert("Please configure API Key in settings first.");
        return;
    }

    if (!currentSessionId) {
      createSession();
      setTimeout(() => handleSendLogic(input), 10); 
    } else {
      handleSendLogic(input);
    }
  };

  const handleSendLogic = async (text: string) => {
    const sessionId = currentSessionId || sessions[0].id;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    setInput("");
    
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, messages: [...s.messages, userMsg] } : s
    ));
    
    setIsTyping(true);

    try {
      let fullResponse = "";
      const history = sessions.find(s => s.id === sessionId)?.messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      })) || [];

      await chatWithAgent(history, text, selectedModel, geminiApiKey, geminiBaseUrl, (chunk) => {
        fullResponse += chunk;
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s;
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last.role === 'model' && last.id === `stream-${sessionId}`) {
            last.content = fullResponse;
            return { ...s, messages: msgs };
          } else {
            return { 
              ...s, 
              messages: [...msgs, { id: `stream-${sessionId}`, role: 'model', content: fullResponse, timestamp: Date.now() }] 
            };
          }
        }));
      });

      const session = sessions.find(s => s.id === sessionId);
      if (session && session.messages.length <= 1) {
         const newTitle = await generateSessionTitle(text, geminiApiKey, geminiBaseUrl);
         setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
      }

    } catch (e) {
      console.error(e);
      // add error message to chat
    } finally {
      setIsTyping(false);
    }
  };

  const handleMagicRename = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const s = sessions.find(sess => sess.id === id);
    if (!s || s.messages.length === 0) return;
    if (!geminiApiKey) return;
    
    const newTitle = await generateSessionTitle(s.messages[0].content, geminiApiKey, geminiBaseUrl);
    setSessions(prev => prev.map(sess => sess.id === id ? { ...sess, title: newTitle } : sess));
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-all z-50 animate-bounce hover:animate-none"
      >
        <MessageCircle size={28} />
      </button>
    );
  }

  return (
    <div className={`fixed z-50 bg-white dark:bg-slate-800 shadow-2xl rounded-t-xl md:rounded-xl overflow-hidden transition-all duration-300 flex flex-col font-sans border border-slate-200 dark:border-slate-700 ${
      isMinimized ? 'bottom-0 right-6 w-72 h-12' : 'bottom-0 right-0 md:right-6 w-full md:w-[480px] h-[85vh] md:bottom-6'
    }`}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 flex justify-between items-center cursor-pointer select-none" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <div className="p-1 bg-indigo-100 dark:bg-indigo-900/40 rounded-md">
            <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="font-bold text-sm">{t.chat.title}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
           {isMinimized ? <Maximize2 size={16} className="hover:text-slate-600 dark:hover:text-slate-200"/> : <Minimize2 size={16} className="hover:text-slate-600 dark:hover:text-slate-200"/>}
           <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="hover:text-red-500 p-1"><X size={18}/></button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-1 h-full overflow-hidden">
          {/* Sidebar */}
          <div className="w-40 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
             <div className="p-3 border-b border-slate-200 dark:border-slate-700">
               <button 
                 onClick={createSession} 
                 className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
               >
                 <Plus size={14} /> {t.chat.newChat}
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-2 space-y-1">
               {sessions.map(s => (
                 <div 
                  key={s.id}
                  onClick={() => setCurrentSessionId(s.id)}
                  className={`group relative p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                    currentSessionId === s.id 
                    ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-800 dark:text-slate-100 font-medium' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                 >
                   {editingSessionId === s.id ? (
                     <div className="flex items-center gap-1">
                       <input 
                         className="w-full p-1 border border-indigo-300 dark:border-indigo-700 rounded focus:outline-none bg-white dark:bg-slate-900"
                         value={editTitle}
                         onClick={(e) => e.stopPropagation()}
                         onChange={(e) => setEditTitle(e.target.value)}
                         autoFocus
                       />
                       <button onClick={saveTitle} className="text-green-600"><Check size={14} /></button>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2">
                       <MessageSquare size={14} className="flex-shrink-0 opacity-70" />
                       <span className="truncate flex-1">{s.title}</span>
                     </div>
                   )}
                   
                   {/* Hover Actions */}
                   {editingSessionId !== s.id && (
                     <div className="absolute right-1 top-1.5 hidden group-hover:flex bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-md shadow-sm border border-slate-200 dark:border-slate-600 p-0.5">
                        <button onClick={(e) => handleMagicRename(e, s.id)} className="p-1 hover:text-indigo-600 text-slate-400" title="AI Rename"><Sparkles size={12}/></button>
                        <button onClick={(e) => startEditing(e, s)} className="p-1 hover:text-blue-600 text-slate-400" title="Manual Rename"><PenSquare size={12}/></button>
                        <button onClick={(e) => handleExportSession(e, s)} className="p-1 hover:text-green-600 text-slate-400" title={t.chat.export}><Download size={12}/></button>
                        <button onClick={(e) => deleteSession(e, s.id)} className="p-1 hover:text-red-600 text-slate-400" title="Delete"><Trash2 size={12}/></button>
                     </div>
                   )}
                 </div>
               ))}
             </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
            {currentSession ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {currentSession.messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        m.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-br-none' 
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-none'
                      }`}>
                         <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                       <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl rounded-bl-none text-xs text-slate-400 flex items-center gap-2">
                         <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                         <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                         <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                       </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
                
                {/* Input Area */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <select 
                      value={selectedModel} 
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 dark:bg-slate-700 border-none text-slate-500 dark:text-slate-300 rounded px-2 py-1 focus:ring-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                      <option value="gemini-3-flash-preview">Flash 3.0</option>
                      <option value="gemini-3-pro-preview">Pro 3.0</option>
                    </select>
                  </div>
                  <div className="relative">
                    <textarea 
                      className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-xl pl-3 pr-10 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-1 focus:ring-indigo-500 transition-all resize-none text-slate-900 dark:text-slate-100"
                      placeholder={t.chat.inputPlaceholder}
                      value={input}
                      rows={1}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <button 
                      onClick={handleSend}
                      disabled={!input.trim() || isTyping}
                      className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-white dark:bg-slate-800">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
                  <Sparkles size={32} className="text-indigo-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.chat.welcomeTitle}</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">{t.chat.welcomeSubtitle}</p>
                <button onClick={createSession} className="mt-6 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors">
                  {t.chat.startBtn}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
