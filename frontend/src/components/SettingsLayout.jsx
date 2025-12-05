import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Settings, 
  Key, 
  Sliders,
  ChevronRight 
} from 'lucide-react';

const SettingsLayout = ({ children }) => {
  const location = useLocation();

  const settingsNavItems = [
    {
      path: '/config',
      label: 'Service Configuration',
      description: 'Configure AI service providers and models',
      icon: Sliders,
    },
    {
      path: '/config/api-keys',
      label: 'API Keys',
      description: 'Manage your API keys (Groq, Deepgram, Twilio)',
      icon: Key,
    },
  ];

  const isActive = (path) => {
    if (path === '/config') {
      return location.pathname === '/config';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Settings Header */}
      <div className="flex items-center space-x-3 mb-8">
        <Settings className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your VoxFlow configuration and preferences</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Settings Navigation */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Configuration</h2>
            </div>
            <nav className="p-2">
              {settingsNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors group ${
                      active
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                      }`} />
                      <div>
                        <div className={`font-medium ${active ? 'text-blue-600' : 'text-gray-900'}`}>
                          {item.label}
                        </div>
                        <div className={`text-sm ${active ? 'text-blue-500' : 'text-gray-500'}`}>
                          {item.description}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${
                      active ? 'text-blue-400' : 'text-gray-300 group-hover:text-gray-400'
                    }`} />
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsLayout;