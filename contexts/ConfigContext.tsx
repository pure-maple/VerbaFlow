
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type LLMProvider = 'Gemini' | 'OpenAI' | 'Anthropic';

interface ConfigState {
  llmProvider: LLMProvider;
  llmApiKey: string;
  llmBaseUrl: string;
  driveClientId: string;
  driveApiKey: string;
  manualDriveToken: string;
}

interface ConfigContextType extends ConfigState {
  updateConfig: (key: keyof ConfigState, value: string) => void;
  isConfigured: boolean;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Prioritize process.env.API_KEY as the default initial value for LLM Key
  const [config, setConfig] = useState<ConfigState>({
    llmProvider: 'Gemini',
    llmApiKey: process.env.API_KEY || '',
    llmBaseUrl: '',
    driveClientId: '',
    driveApiKey: '',
    manualDriveToken: '',
  });

  useEffect(() => {
    // 2. Load from localStorage, handle migration from old keys if necessary
    const savedConfig = localStorage.getItem('verbaflow_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      
      // Backward compatibility migration
      if (parsed.geminiApiKey && !parsed.llmApiKey) {
          parsed.llmApiKey = parsed.geminiApiKey;
          delete parsed.geminiApiKey;
      }
      if (parsed.geminiBaseUrl && !parsed.llmBaseUrl) {
          parsed.llmBaseUrl = parsed.geminiBaseUrl;
          delete parsed.geminiBaseUrl;
      }

      // If localStorage has an empty key but ENV has one, use ENV
      if (!parsed.llmApiKey && process.env.API_KEY) {
        parsed.llmApiKey = process.env.API_KEY;
      }
      
      // Strict Provider Cleanup: Ensure only supported providers remain
      const validProviders: LLMProvider[] = ['Gemini', 'OpenAI', 'Anthropic'];
      if (!parsed.llmProvider || !validProviders.includes(parsed.llmProvider)) {
          parsed.llmProvider = 'Gemini';
      }
      
      setConfig(prev => ({ ...prev, ...parsed }));
    }
  }, []);

  const updateConfig = (key: keyof ConfigState, value: string) => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value };
      localStorage.setItem('verbaflow_config', JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const isConfigured = !!config.llmApiKey;

  return (
    <ConfigContext.Provider value={{ ...config, updateConfig, isConfigured }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
