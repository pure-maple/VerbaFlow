import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ConfigState {
  geminiApiKey: string;
  geminiBaseUrl: string;
  driveClientId: string;
  driveApiKey: string;
}

interface ConfigContextType extends ConfigState {
  updateConfig: (key: keyof ConfigState, value: string) => void;
  isConfigured: boolean;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ConfigState>({
    geminiApiKey: '',
    geminiBaseUrl: '',
    driveClientId: '',
    driveApiKey: '',
  });

  useEffect(() => {
    // Load from localStorage or env fallback
    const savedConfig = localStorage.getItem('verbaflow_config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
    // Removed automatic process.env fallback to prevent "GEMINI_API_KEY" placeholder issues
    // or accidental exposure if not intended. User must explicitly set it.
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
