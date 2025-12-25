
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfig } from '../contexts/ConfigContext';
import { ChatSession, ChatMessage } from '../types';
import { storage } from '../services/storage';
import { chatWithAgent, generateSessionTitle } from '../services/geminiService';
import { MessageSquare, Plus, Trash2, Edit2, Send, Bot, User, Sparkles, Search, MoreHorizontal, ChevronDown } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

const AgentManager: React.FC = () => {
  const { t } = useLanguage();
  const { geminiApiKey, geminiBaseUrl } = useConfig();
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Confirmation State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Load History
  useEffect(() => {
    const load = async () => {
        const data = await storage.loadChats();
        if (Array.isArray(data)) setSessions(data);
    };
    load();
  }, []);

  // Save History
  useEffect(() => {
      const timer = setTimeout(() => {
          if (sessions.length > 0) storage.saveChats(sessions);
      }, 1000);
      return () => clearTimeout(timer);
  }, [sessions]);

  // Scroll to bottom
  useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isTyping]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const handleCreateSession = () => {
      const newSession: ChatSession = {
          id: Date.now().toString(),
          title: t.agents.newChat,
          messages: [],
          model: 'gemini-3-pro-preview', // Default for Agent Manager
          createdAt: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
  };

  const initiateDeleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteTargetId(id);
  };

  const handleConfirmDelete = () => {
      if (deleteTargetId) {
          setSessions(prev => prev.filter(s => s.id !== deleteTargetId));
          if (activeSessionId === deleteTargetId) setActiveSessionId(null);
          storage.deleteChat(deleteTargetId);
      }
      setDeleteTargetId(null);
  };
  
  const handleChangeModel = (model: string) => {
      if (activeSessionId) {
          setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, model } : s));
      }
  };

  const handleSend = async () => {
      if (!input.trim() || !activeSessionId || !geminiApiKey) return;
      
      const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: input,
          timestamp: Date.now()
      };

      // Optimistic update
      setSessions(prev => prev.map(s => 
          s.id === activeSessionId 
          ? { ...s, messages: [...s.messages, userMsg] } 
          : s
      ));
      
      setInput("");
      setIsTyping(true);

      try {
          const currentHistory = activeSession!.messages.map(m => ({
              role: m.role,
              parts: [{ text: m.content }]
          }));

          let fullRes = "";
          await chatWithAgent(currentHistory, userMsg.content, activeSession!.model, geminiApiKey, geminiBaseUrl, (chunk) => {
              fullRes += chunk;
              setSessions(prev => prev.map(s => {
                  if (s.id !== activeSessionId) return s;
                  const msgs = [...s.messages];
                  const last = msgs[msgs.length - 1];
                  if (last.role === 'model' && last.id === 'streaming') {
                      last.content = fullRes;
                      return { ...s, messages: msgs };
                  } else {
                      return { ...s, messages: [...msgs, { id: 'streaming', role: 'model', content: fullRes, timestamp: Date.now() }] };
                  }
              }));
          });

          // Auto Rename if new
          if (activeSession!.messages.length === 0) {
              const newTitle = await generateSessionTitle(userMsg.content, geminiApiKey, geminiBaseUrl);
              setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, title: newTitle } : s));
          }

      } catch (e) {
          console.error(e);
      } finally {
          setIsTyping(false);
      }
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      
      <ConfirmationModal 
          isOpen={!!deleteTargetId}
          onClose={() => setDeleteTargetId(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Chat"
          message="Are you sure you want to delete this conversation? This action cannot be undone."
          isDanger={true}
      />

      {/* Sidebar List */}
      <div className="w-80 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                  <Bot className="text-indigo-600" /> {t.agents.title}
              </h2>
              <button 
                  onClick={handleCreateSession}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
              >
                  <Plus size={18} /> {t.agents.newChat}
              </button>
          </div>
          
          <div className="p-2">
              <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                      className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder={t.agents.searchPlaceholder}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions
                .filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(session => (
                  <div 
                      key={session.id}
                      onClick={() => setActiveSessionId(session.id)}
                      className={`group p-3 rounded-lg cursor-pointer transition-all flex justify-between items-start ${
                          activeSessionId === session.id 
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 border' 
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'
                      }`}
                  >
                      <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-semibold truncate ${activeSessionId === session.id ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'}`}>
                              {session.title}
                          </h4>
                          <p className="text-xs text-slate-500 truncate mt-1">
                              {session.messages.length > 0 ? session.messages[session.messages.length - 1].content : "Empty conversation"}
                          </p>
                      </div>
                      <button 
                          onClick={(e) => initiateDeleteSession(e, session.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
                      >
                          <Trash2 size={14} />
                      </button>
                  </div>
              ))}
          </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 relative">
          {activeSession ? (
              <>
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center shadow-sm z-10">
                      <div>
                          <h3 className="font-bold text-slate-800 dark:text-slate-100">{activeSession.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500">{t.agents.modelSelect}:</span>
                              <select 
                                value={activeSession.model} 
                                onChange={(e) => handleChangeModel(e.target.value)}
                                className="text-xs bg-slate-100 dark:bg-slate-700 border-none rounded px-2 py-0.5 outline-none cursor-pointer"
                              >
                                  <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                                  <option value="gemini-3-pro-preview">Gemini 3.0 Pro</option>
                                  <option value="gemini-2.5-flash-preview">Gemini 2.5 Flash</option>
                              </select>
                          </div>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {activeSession.messages.map(msg => (
                          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-indigo-600 text-white'
                              }`}>
                                  {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                              </div>
                              <div className={`max-w-[70%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                  msg.role === 'user' 
                                  ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700' 
                                  : 'bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/30'
                              }`}>
                                  <div className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{msg.content}</div>
                              </div>
                          </div>
                      ))}
                      {isTyping && (
                          <div className="flex gap-4">
                              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                                  <Sparkles size={16} />
                              </div>
                              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                  <div className="flex gap-1">
                                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                  </div>
                              </div>
                          </div>
                      )}
                      <div ref={bottomRef} />
                  </div>

                  <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <div className="max-w-4xl mx-auto relative">
                          <textarea 
                              className="w-full p-4 pr-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-800 dark:text-slate-200"
                              rows={3}
                              placeholder={t.chat.inputPlaceholder}
                              value={input}
                              onChange={e => setInput(e.target.value)}
                              onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSend();
                                  }
                              }}
                          />
                          <button 
                              onClick={handleSend}
                              disabled={!input.trim() || isTyping}
                              className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                              <Send size={18} />
                          </button>
                      </div>
                  </div>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <Bot size={64} className="mb-4 opacity-20" />
                  <p>{t.agents.placeholder}</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default AgentManager;
