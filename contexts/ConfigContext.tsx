
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ConfigState {
  geminiApiKey: string;
  geminiBaseUrl: string;
  driveClientId: string;
  driveApiKey: string;
  manualDriveToken: string; // New: For dev mode
}

interface ConfigContextType extends ConfigState {
  updateConfig: (key: keyof ConfigState, value: string) => void;
  isConfigured: boolean;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Prioritize process.env.API_KEY as the default initial value
  const [config, setConfig] = useState<ConfigState>({
    geminiApiKey: process.env.API_KEY || '',
    geminiBaseUrl: '',
    driveClientId: '',
    driveApiKey: '',
    manualDriveToken: '',
  });

  useEffect(() => {
    // 2. Load from localStorage, but verify if we should keep the ENV key
    const savedConfig = localStorage.getItem('verbaflow_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      
      // If localStorage has an empty key but ENV has one, use ENV
      if (!parsed.geminiApiKey && process.env.API_KEY) {
        parsed.geminiApiKey = process.env.API_KEY;
      }
      
      // Ensure new field exists if loading old config
      if (parsed.manualDriveToken === undefined) {
          parsed.manualDriveToken = '';
      }
      
      setConfig(parsed);
    }
  }, []);

  const updateConfig = (key: keyof ConfigState, value: string) => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value };
      localStorage.setItem('verbaflow_config', JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const isConfigured = !!config.geminiApiKey;

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
