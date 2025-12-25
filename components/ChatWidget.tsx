
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChatSession, ChatMessage } from '../types';
import { chatWithAgent, generateSessionTitle } from '../services/geminiService';
import { useConfig } from '../contexts/ConfigContext';
import { storage } from '../services/storage';

interface Props {
  externalPrompt?: string | null;
  onClearExternalPrompt?: () => void;
}

const ChatWidget: React.FC<Props> = ({ externalPrompt, onClearExternalPrompt }) => {
  const { t } = useLanguage();
  const { geminiApiKey, geminiBaseUrl } = useConfig();
  
  // UI State
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null); // Track Active Session ID
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");
  
  const bottomRef = useRef<HTMLDivElement>(null);

  // --- POSITIONING LOGIC ---
  const [offset, setOffset] = useState({ right: 40, bottom: 40 });
  const dragRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const startOffsetRef = useRef({ right: 0, bottom: 0 });
  const isDocked = offset.right < 20;

  // Load latest session on mount if none active
  useEffect(() => {
      if (!sessionId) {
          storage.loadChats().then(chats => {
              if (chats.length > 0) {
                  // Load the most recent one
                  const latest = chats[0];
                  setSessionId(latest.id);
                  setMessages(latest.messages);
              }
          });
      }
  }, []);

  // Handle External Prompt (Appending Logic)
  useEffect(() => {
      if (externalPrompt) {
          if (!isOpen) setIsOpen(true);
          
          // Auto-send if we have a prompt
          // We use a timeout to allow state to settle if needed, but direct call is better
          handleExternalSend(externalPrompt);
          
          if (onClearExternalPrompt) onClearExternalPrompt();
      }
  }, [externalPrompt]);

  // Save Session on Update
  useEffect(() => {
      if (sessionId && messages.length > 0) {
          const timer = setTimeout(() => {
              // We need to fetch the existing session to preserve title/model if we only have messages here
              // Ideally we'd store the full session object in state, but let's do a partial update or upsert
              storage.loadChats().then(chats => {
                  const existing = chats.find(c => c.id === sessionId);
                  const sessionToSave: ChatSession = existing ? {
                      ...existing,
                      messages: messages,
                      createdAt: Date.now() // Update timestamp to bump to top
                  } : {
                      id: sessionId,
                      title: messages[0]?.content.slice(0, 30) || "New Chat",
                      messages: messages,
                      model: selectedModel,
                      createdAt: Date.now()
                  };
                  storage.saveChatSession(sessionToSave);
              });
          }, 1000);
          return () => clearTimeout(timer);
      }
  }, [messages, sessionId]);

  // Scroll to bottom
  useEffect(() => {
    if (isOpen && !isMinimized) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen, isMinimized]);

  // ... (Keep existing positioning/dragging logic exactly as is) ...
  useEffect(() => {
      if (!isOpen) return;
      const checkBounds = () => {
          const winH = window.innerHeight;
          const winW = window.innerWidth;
          const cssMaxHeight = winH * 0.85;
          const targetHeight = isMinimized ? 48 : Math.min(600, cssMaxHeight);
          const targetWidth = isMinimized ? 300 : 400;
          const safeMargin = 20;

          setOffset(prev => {
              let { right, bottom } = prev;
              let changed = false;
              const maxBottom = winH - targetHeight - safeMargin;
              if (bottom > maxBottom) { bottom = Math.max(safeMargin, maxBottom); changed = true; }
              const maxRight = winW - targetWidth - safeMargin;
              if (right > maxRight) { right = Math.max(safeMargin, maxRight); changed = true; }
              if (bottom < safeMargin) { bottom = safeMargin; changed = true; }
              if (!isDocked && right < safeMargin) { right = safeMargin; changed = true; }
              return changed ? { right, bottom } : prev;
          });
      };
      checkBounds();
      window.addEventListener('resize', checkBounds);
      return () => window.removeEventListener('resize', checkBounds);
  }, [isOpen, isMinimized, isDocked]);

  const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      isDraggingRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      startOffsetRef.current = { ...offset };
      const moveHandler = (moveEvent: MouseEvent) => {
          const deltaX = moveEvent.clientX - dragStartRef.current.x;
          const deltaY = moveEvent.clientY - dragStartRef.current.y;
          if (!isDraggingRef.current && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) isDraggingRef.current = true;
          if (isDraggingRef.current) setOffset({ right: startOffsetRef.current.right - deltaX, bottom: startOffsetRef.current.bottom - deltaY });
      };
      const upHandler = () => {
          document.removeEventListener('mousemove', moveHandler);
          document.removeEventListener('mouseup', upHandler);
          if (isDraggingRef.current) setOffset(prev => (prev.right < 20 && prev.right > -30) ? { ...prev, right: 0 } : prev);
      };
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
  };

  const handleToggle = () => {
      if (!isDraggingRef.current) {
          if (!isOpen && isDocked) setOffset(prev => ({ ...prev, right: 40 }));
          setIsOpen(!isOpen);
      }
  };

  const handleExternalSend = async (text: string) => {
      if (!geminiApiKey) { alert("Please configure API Key."); return; }
      
      // If no session exists, start one
      let currentSessionId = sessionId;
      if (!currentSessionId) {
          currentSessionId = Date.now().toString();
          setSessionId(currentSessionId);
          setMessages([]);
      }

      await processMessage(text, currentSessionId);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!geminiApiKey) { alert("Please configure API Key."); return; }

    let currentSessionId = sessionId;
    if (!currentSessionId) {
        currentSessionId = Date.now().toString();
        setSessionId(currentSessionId);
    }

    await processMessage(input, currentSessionId);
    setInput("");
  };

  const processMessage = async (content: string, currentSessId: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      let fullResponse = "";
      // Construct history from current messages
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      await chatWithAgent(history, userMsg.content, selectedModel, geminiApiKey, geminiBaseUrl, (chunk) => {
        fullResponse += chunk;
        setMessages(prev => {
          const msgs = [...prev];
          const last = msgs[msgs.length - 1];
          if (last.role === 'model' && last.id === `stream-${currentSessId}`) {
            last.content = fullResponse;
            return [...msgs];
          } else {
            return [...msgs, { id: `stream-${currentSessId}`, role: 'model', content: fullResponse, timestamp: Date.now() }];
          }
        });
      });
      
      // Rename if it's the first message
      if (messages.length === 0) {
           generateSessionTitle(content, geminiApiKey, geminiBaseUrl).then(title => {
               storage.loadChats().then(chats => {
                   const s = chats.find(c => c.id === currentSessId);
                   if (s) storage.saveChatSession({ ...s, title });
               });
           });
      }

    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
      setSessionId(Date.now().toString());
      setMessages([]);
      setInput("");
  };

  if (!isOpen) {
    return (
      <div 
        ref={dragRef}
        style={{ 
            bottom: `${offset.bottom}px`, 
            right: `${isDocked ? -20 : offset.right}px`,
            transition: isDraggingRef.current ? 'none' : 'right 0.3s ease, transform 0.2s',
            touchAction: 'none'
        }}
        className={`fixed z-[60] group`}
        onMouseDown={handleMouseDown}
        onClick={handleToggle}
      >
        <div className={`
            w-14 h-14 bg-slate-900 text-white dark:bg-indigo-600 shadow-2xl flex items-center justify-center cursor-move border border-slate-700
            ${isDocked ? 'rounded-l-xl rounded-r-none pl-2' : 'rounded-full hover:scale-105 active:scale-95'}
            transition-all duration-300
        `}>
             {isDocked ? (
                 <div className="flex items-center">
                     <MessageCircle size={24} className="animate-pulse" />
                     <div className="absolute right-full top-0 h-full bg-slate-900 dark:bg-indigo-600 text-white text-xs font-bold px-3 flex items-center rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap -mr-1">
                         Chat
                     </div>
                 </div>
             ) : (
                 <MessageCircle size={26} />
             )}
        </div>
      </div>
    );
  }

  const panelWidth = isMinimized ? 300 : 400;
  const panelHeight = isMinimized ? 48 : 600;
  
  return (
    <div 
        className={`fixed z-[60] bg-white dark:bg-slate-800 shadow-2xl rounded-xl overflow-hidden flex flex-col font-sans border border-slate-200 dark:border-slate-700 transition-all duration-200`}
        style={{
            width: `${panelWidth}px`,
            height: `${panelHeight}px`,
            bottom: `${offset.bottom}px`,
            right: `${offset.right}px`,
            maxHeight: '85vh',
            transition: isDraggingRef.current ? 'none' : 'width 0.2s, height 0.2s'
        }}
    >
      <div 
        className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-3 flex justify-between items-center cursor-move select-none active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 pointer-events-none">
          <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
          <span className="font-bold text-sm">{t.chat.title}</span>
        </div>
        <div className="flex-1 flex justify-center text-slate-300 dark:text-slate-600 pointer-events-none">
             <GripHorizontal size={16} />
        </div>
        <div className="flex items-center gap-1 text-slate-400">
           {!isMinimized && (
               <button 
                 onMouseDown={(e) => e.stopPropagation()} 
                 onClick={handleNewChat} 
                 className="p-1 mr-1 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                 title="New Chat"
               >
                   <MessageCircle size={16}/>
               </button>
           )}
           <button 
             onMouseDown={(e) => e.stopPropagation()} 
             onClick={() => setIsMinimized(!isMinimized)} 
             className="p-1 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
           >
               {isMinimized ? <Maximize2 size={16}/> : <Minimize2 size={16}/>}
           </button>
           <button 
             onMouseDown={(e) => e.stopPropagation()} 
             onClick={() => setIsOpen(false)} 
             className="p-1 hover:text-red-500 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
           >
             <X size={18}/>
           </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col flex-1 h-full overflow-hidden bg-slate-50/30 dark:bg-slate-900/30">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                  <div className="text-center text-slate-400 mt-10 text-xs">
                      <p>{t.chat.welcomeSubtitle}</p>
                  </div>
              )}
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                  }`}>
                     <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                   <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl rounded-bl-none text-xs text-slate-400 flex items-center gap-2">
                     <span className="animate-pulse">Thinking...</span>
                   </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="relative">
                <textarea 
                  className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-xl pl-3 pr-10 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-1 focus:ring-indigo-500 transition-all resize-none text-slate-900 dark:text-slate-100"
                  placeholder={t.chat.inputPlaceholder}
                  value={input}
                  rows={2}
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
                  className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
