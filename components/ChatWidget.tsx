
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { MessageSquare, X, Send, Trash2, Maximize2, Minimize2, Sparkles, User, History, BrainCircuit, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfig } from '../contexts/ConfigContext';
import { chatWithAgent, generateSessionTitle } from '../services/geminiService';
import { ChatMessage, ChatSession } from '../types';
import { storage } from '../services/storage';
import ReactMarkdown from 'react-markdown';

interface Props {
  externalPrompt?: string | null;
  onClearExternalPrompt?: () => void;
}

export const ChatWidget: React.FC<Props> = ({ externalPrompt, onClearExternalPrompt }) => {
  const { t } = useLanguage();
  const { llmApiKey, llmBaseUrl, agentSystemInstruction } = useConfig();
  
  // UI State
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // --- Button Position State ---
  const BUTTON_SIZE = 56;
  const MARGIN = 16;
  
  // Initialize button position to bottom-right
  const [buttonPos, setButtonPos] = useState({ 
      x: window.innerWidth - BUTTON_SIZE - MARGIN, 
      y: window.innerHeight - BUTTON_SIZE - 100 
  });
  const [isButtonDragging, setIsButtonDragging] = useState(false);
  const [buttonDragOffset, setButtonDragOffset] = useState({ x: 0, y: 0 });
  const [hasButtonMoved, setHasButtonMoved] = useState(false);
  
  // --- Panel Position State ---
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [panelSize, setPanelSize] = useState({ width: 400, height: 600 });
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const [panelDragOffset, setPanelDragOffset] = useState({ x: 0, y: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const isSnappedRightRef = useRef(true); 

  // Chat Data State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- Persistence ---
  useEffect(() => {
      const load = async () => {
          const data = await storage.loadChats();
          if (Array.isArray(data)) setSessions(data);
      };
      load();
  }, [isOpen]); 

  useEffect(() => {
      if (sessions.length > 0) {
          const timer = setTimeout(() => storage.saveChats(sessions), 1000);
          return () => clearTimeout(timer);
      }
  }, [sessions]);

  // Handle External Prompt
  useEffect(() => {
    if (externalPrompt) {
        setIsOpen(true);
        if (!activeSessionId) createNewSession();
        setInput(externalPrompt);
        if (onClearExternalPrompt) onClearExternalPrompt();
    }
  }, [externalPrompt]);

  // Sync Messages
  useEffect(() => {
      if (activeSessionId) {
          const session = sessions.find(s => s.id === activeSessionId);
          if (session) setMessages(session.messages);
      } else {
          setMessages([]);
      }
  }, [activeSessionId, sessions]);

  // Scroll to bottom
  useEffect(() => {
      if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping]);

  // --- 1. Initial Panel Positioning (Smart Snap) ---
  useLayoutEffect(() => {
      if (isOpen && !isExpanded) {
          const WIDGET_W = 400; 
          const availableHeight = window.innerHeight - (2 * MARGIN);
          const WIDGET_H = Math.min(600, availableHeight);
          const actualWidth = Math.min(WIDGET_W, window.innerWidth - 2 * MARGIN);

          // Try left of button first
          let safeX = buttonPos.x - actualWidth - MARGIN; 
          // If no space on left, try right
          if (safeX < MARGIN) safeX = buttonPos.x + BUTTON_SIZE + MARGIN;
          
          // Clamp X
          if (safeX + actualWidth > window.innerWidth) safeX = window.innerWidth - actualWidth - MARGIN;
          if (safeX < MARGIN) safeX = MARGIN;

          // Align bottom of panel with bottom of button
          let safeY = (buttonPos.y + BUTTON_SIZE) - WIDGET_H; 
          
          // Clamp Y
          if (safeY < MARGIN) safeY = MARGIN; 
          if (safeY + WIDGET_H > window.innerHeight) safeY = window.innerHeight - WIDGET_H - MARGIN;

          setPanelPos({ x: safeX, y: safeY });
          setPanelSize({ width: actualWidth, height: WIDGET_H });
      }
  }, [isOpen, isExpanded]); 

  // --- 2. Button Drag Logic ---
  const handleButtonDragStart = (e: React.MouseEvent | React.TouchEvent) => {
      // Robust coordinate extraction for both Mouse and Touch events
      let clientX = 0;
      let clientY = 0;
      
      if ('touches' in e && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          setButtonDragOffset({ x: clientX - rect.left, y: clientY - rect.top });
          setIsButtonDragging(true);
          setHasButtonMoved(false);
      }
  };

  useEffect(() => {
      if (!isButtonDragging) return;
      
      const handleMove = (e: MouseEvent | TouchEvent) => {
          let clientX = 0;
          let clientY = 0;

          if ('touches' in e && e.touches.length > 0) {
              clientX = e.touches[0].clientX;
              clientY = e.touches[0].clientY;
          } else if ('clientX' in e) {
              clientX = (e as MouseEvent).clientX;
              clientY = (e as MouseEvent).clientY;
          }

          let newX = clientX - buttonDragOffset.x;
          let newY = clientY - buttonDragOffset.y;

          // Constraints
          const maxX = window.innerWidth - BUTTON_SIZE;
          const maxY = window.innerHeight - BUTTON_SIZE;

          setButtonPos({
              x: Math.max(0, Math.min(newX, maxX)),
              y: Math.max(0, Math.min(newY, maxY))
          });
          setHasButtonMoved(true);
      };

      const handleEnd = () => {
          setIsButtonDragging(false);
          if (hasButtonMoved) {
              // Snap Button Logic
              const midX = window.innerWidth / 2;
              const isRight = buttonPos.x >= midX - (BUTTON_SIZE/2);
              const targetX = isRight ? window.innerWidth - BUTTON_SIZE - MARGIN : MARGIN;
              isSnappedRightRef.current = isRight; 
              setButtonPos(p => ({ ...p, x: targetX }));
          }
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchend', handleEnd);

      return () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('touchmove', handleMove);
          window.removeEventListener('mouseup', handleEnd);
          window.removeEventListener('touchend', handleEnd);
      };
  }, [isButtonDragging, buttonDragOffset, hasButtonMoved, buttonPos.x]);

  // --- 3. Panel Drag Logic ---
  const handlePanelDragStart = (e: React.MouseEvent | React.TouchEvent) => {
      if (isExpanded) return;
      
      let clientX = 0;
      let clientY = 0;
      
      if ('touches' in e && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      if (widgetRef.current) {
          const rect = widgetRef.current.getBoundingClientRect();
          setPanelDragOffset({ x: clientX - rect.left, y: clientY - rect.top });
          setIsPanelDragging(true);
      }
  };

  useEffect(() => {
      if (!isPanelDragging) return;

      const handleMove = (e: MouseEvent | TouchEvent) => {
          let clientX = 0;
          let clientY = 0;

          if ('touches' in e && e.touches.length > 0) {
              clientX = e.touches[0].clientX;
              clientY = e.touches[0].clientY;
          } else if ('clientX' in e) {
              clientX = (e as MouseEvent).clientX;
              clientY = (e as MouseEvent).clientY;
          }

          let newX = clientX - panelDragOffset.x;
          let newY = clientY - panelDragOffset.y;

          // Loose Bounds Check
          const maxX = window.innerWidth - 50;
          const maxY = window.innerHeight - 50;
          
          setPanelPos({
              x: Math.max(-panelSize.width + 50, Math.min(newX, maxX)),
              y: Math.max(0, Math.min(newY, maxY))
          });
      };

      const handleEnd = () => setIsPanelDragging(false);

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchend', handleEnd);

      return () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('touchmove', handleMove);
          window.removeEventListener('mouseup', handleEnd);
          window.removeEventListener('touchend', handleEnd);
      };
  }, [isPanelDragging, panelDragOffset, panelSize]);


  // Handle Window Resize
  useEffect(() => {
      const handleResize = () => {
          setButtonPos(prev => {
              let newX = prev.x;
              if (isSnappedRightRef.current) {
                  newX = window.innerWidth - BUTTON_SIZE - MARGIN;
              } else {
                  newX = MARGIN; 
              }
              const newY = Math.min(prev.y, window.innerHeight - BUTTON_SIZE - MARGIN);
              return { x: newX, y: Math.max(MARGIN, newY) };
          });
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine if docked on edge for auto-hide
  const isDockedLeft = buttonPos.x <= MARGIN + 2;
  const isDockedRight = buttonPos.x >= window.innerWidth - BUTTON_SIZE - MARGIN - 2;
  const isDocked = (isDockedLeft || isDockedRight) && !isOpen && !isButtonDragging;

  // --- Actions ---

  const createNewSession = () => {
      const newSession: ChatSession = {
          id: Date.now().toString(),
          title: t.chat.newChat,
          messages: [],
          model: 'gemini-3-flash-preview',
          createdAt: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      if(window.innerWidth < 600) setShowHistory(false);
  };

  const handleSend = async (textOverride?: string) => {
      // Ensure text is a string to prevent Event object from being passed if onClick is used incorrectly
      const text = (typeof textOverride === 'string' ? textOverride : undefined) || input.trim();
      if (!text) return;
      if (!llmApiKey) return;

      let currentSessionId = activeSessionId;
      if (!currentSessionId) {
          const newSession = {
              id: Date.now().toString(),
              title: t.chat.newChat,
              messages: [],
              model: 'gemini-3-flash-preview',
              createdAt: Date.now()
          };
          setSessions(prev => [newSession, ...prev]);
          setActiveSessionId(newSession.id);
          currentSessionId = newSession.id;
      }

      const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: text,
          timestamp: Date.now()
      };

      setSessions(prev => prev.map(s => 
          s.id === currentSessionId 
          ? { ...s, messages: [...s.messages, userMsg] } 
          : s
      ));
      
      setInput("");
      setIsTyping(true);

      try {
          const session = sessions.find(s => s.id === currentSessionId);
          // Explicitly type history to avoid inference issues with map
          const history: { role: string; parts: { text: string }[] }[] = (session?.messages || []).map(m => ({
              role: m.role,
              parts: [{ text: m.content }]
          }));
          history.push({ role: 'user', parts: [{ text }] });

          let fullResponse = "";
          await chatWithAgent(
              history,
              text,
              session?.model || 'gemini-3-flash-preview',
              llmApiKey,
              llmBaseUrl,
              (chunk: string) => {
                  fullResponse += chunk;
                  setSessions(prev => prev.map(s => {
                      if (s.id !== currentSessionId) return s;
                      const msgs = [...s.messages];
                      const last = msgs[msgs.length - 1];
                      if (last.role === 'model' && last.id === 'streaming') {
                          return { ...s, messages: msgs.map((m, i) => i === msgs.length - 1 ? { ...m, content: fullResponse } : m) };
                      } else {
                          return { ...s, messages: [...msgs, { id: 'streaming', role: 'model', content: fullResponse, timestamp: Date.now() }] };
                      }
                  }));
              },
              agentSystemInstruction // Pass the custom instruction
          );

          const currentSession = sessions.find(s => s.id === currentSessionId);
          if (currentSession && currentSession.messages.length <= 1) {
              const newTitle = await generateSessionTitle(text, llmApiKey, llmBaseUrl);
              setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: newTitle } : s));
          }

      } catch (e) {
          console.error(e);
      } finally {
          setIsTyping(false);
          setSessions(prev => prev.map(s => {
              if (s.id !== currentSessionId) return s;
              const msgs = s.messages.map(m => m.id === 'streaming' ? { ...m, id: Date.now().toString() } : m);
              return { ...s, messages: msgs };
          }));
      }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) setActiveSessionId(null);
      storage.deleteChat(id);
  };

  const panelStyle = isExpanded 
    ? { top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }
    : { top: panelPos.y, left: panelPos.x, width: panelSize.width, height: panelSize.height };

  return (
    <>
      {/* Draggable Button */}
      <button 
        ref={buttonRef}
        onMouseDown={handleButtonDragStart}
        onTouchStart={handleButtonDragStart}
        onMouseEnter={() => !isButtonDragging && setHasButtonMoved(false)} 
        onClick={() => { if(!hasButtonMoved) setIsOpen(!isOpen); }}
        className={`fixed z-[100] w-14 h-14 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center cursor-move active:scale-95 ${
            isOpen 
            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 scale-0 opacity-0 pointer-events-none' 
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:scale-110 hover:shadow-indigo-500/50'
        }`}
        style={{ 
            left: buttonPos.x, 
            top: buttonPos.y,
            touchAction: 'none',
            transform: isDocked && !hasButtonMoved 
                ? (isDockedLeft ? 'translateX(-40%)' : 'translateX(40%)') 
                : 'translateX(0)',
            opacity: isDocked && !hasButtonMoved ? 0.6 : 1
        }}
      >
          <Sparkles size={24} className="fill-white/20" />
      </button>

      {/* Popup Window */}
      {isOpen && (
          <div 
            ref={widgetRef}
            style={panelStyle}
            className={`fixed z-[100] bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-all duration-75`}
          >
              {/* Header (Draggable) */}
              <div 
                className="relative px-3 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 cursor-move select-none z-20"
                onMouseDown={handlePanelDragStart}
                onTouchStart={handlePanelDragStart}
              >
                   {/* Drag Handle (Visual) */}
                   <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full opacity-60 hover:opacity-100 transition-opacity"></div>

                  <div className="flex items-center gap-2 relative z-10">
                      <button 
                        onMouseDown={(e) => e.stopPropagation()} 
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={() => setShowHistory(!showHistory)} 
                        className={`p-1.5 rounded-lg transition-all ${showHistory ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                          <History size={18} />
                      </button>
                      <div className="flex flex-col">
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                             {t.chat.title}
                          </h3>
                      </div>
                  </div>
                  <div className="flex items-center gap-1 relative z-10" 
                       onMouseDown={(e) => e.stopPropagation()} 
                       onTouchStart={(e) => e.stopPropagation()}
                  >
                      <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                      </button>
                      <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                          <X size={18} />
                      </button>
                  </div>
              </div>

              <div className="flex flex-1 overflow-hidden relative">
                  {/* History Sidebar */}
                  <div className={`absolute top-0 bottom-0 left-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm border-r border-slate-200 dark:border-slate-800 z-10 transition-all duration-300 ${showHistory ? 'w-48 opacity-100' : 'w-0 opacity-0'} overflow-hidden flex flex-col`}>
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                            <button onClick={createNewSession} className="w-full flex items-center justify-center gap-2 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <Plus size={14} /> {t.chat.newChat}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {sessions.map(s => (
                                <div 
                                    key={s.id} 
                                    onClick={() => { setActiveSessionId(s.id); if(window.innerWidth < 600) setShowHistory(false); }}
                                    className={`p-2 rounded-lg text-xs truncate cursor-pointer flex justify-between group transition-colors ${activeSessionId === s.id ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                >
                                    <span className="truncate flex-1">{s.title}</span>
                                    <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 transition-opacity">
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                  </div>

                  {/* Messages Area */}
                  <div className={`flex-1 flex flex-col bg-white/50 dark:bg-slate-900/50 transition-all duration-300 ${showHistory ? 'ml-48' : 'ml-0'}`}>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {messages.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in zoom-in duration-500">
                                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-6">
                                      <BrainCircuit size={32} className="text-white" />
                                  </div>
                                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{t.chat.welcomeTitle}</h2>
                                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed mb-8">
                                      {t.chat.welcomeSubtitle}
                                  </p>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-sm">
                                      {Object.entries(t.chat.suggestions || {}).map(([key, label]) => (
                                          <button 
                                              key={key}
                                              onClick={() => handleSend(label as string)}
                                              className="text-xs text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-2 group"
                                          >
                                              <Sparkles size={12} className="text-indigo-500 opacity-60 group-hover:opacity-100" />
                                              <span className="text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{label}</span>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          ) : (
                              messages.map((msg, idx) => (
                                  <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2 duration-300`}>
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${
                                          msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                                      }`}>
                                          {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                                      </div>
                                      <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed ${
                                          msg.role === 'user' 
                                          ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tr-none text-slate-700 dark:text-slate-200' 
                                          : 'bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/30 rounded-tl-none text-slate-700 dark:text-slate-200'
                                      }`}>
                                          <div className="prose prose-sm max-w-none dark:prose-invert break-words">
                                              <ReactMarkdown 
                                                  components={{
                                                      p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
                                                      a: ({node, ...props}: any) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                                      code: ({node, className, children, ...props}: any) => (
                                                          <code className={`${String(className || '')} bg-black/10 dark:bg-white/10 rounded px-1`} {...props}>
                                                              {children}
                                                          </code>
                                                      )
                                                  }}
                                              >
                                                  {msg.content}
                                              </ReactMarkdown>
                                          </div>
                                      </div>
                                  </div>
                              ))
                          )}
                          {isTyping && (
                              <div className="flex gap-3 animate-pulse">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm"><Sparkles size={16}/></div>
                                  <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm">
                                      <div className="flex gap-1">
                                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                                      </div>
                                  </div>
                              </div>
                          )}
                      <div ref={bottomRef} />
                  </div>

                  <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                      <div className="max-w-4xl mx-auto relative">
                          <textarea 
                              ref={inputRef}
                              className="w-full p-4 pr-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-800 dark:text-slate-200"
                              rows={3}
                              placeholder={t.chat.inputPlaceholder}
                              value={input}
                              onChange={e => setInput(e.target.value)}
                              onKeyDown={e => {
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                      e.preventDefault();
                                      handleSend();
                                  }
                              }}
                          />
                          <button 
                              onClick={() => handleSend()}
                              disabled={!input.trim() || isTyping}
                              className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                              <Send size={18} />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </>
  );
};
