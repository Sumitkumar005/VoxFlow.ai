import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Bot, 
  Home,
  Radio, 
  BarChart3, 
  FileText, 
  Settings,
  LogOut,
  User,
  ChevronDown,
  Zap
} from 'lucide-react';
import { useState } from 'react';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { path: '/agents', label: 'Agents', icon: Bot },
    { path: '/campaigns', label: 'Campaigns', icon: Radio },
    { path: '/usage', label: 'Usage', icon: BarChart3 },
    { path: '/reports', label: 'Reports', icon: FileText },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/agents" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <Zap className="h-5 w-5 text-white group-hover:rotate-12 transition-transform" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent group-hover:from-purple-700 group-hover:to-purple-900 transition-all">
                VoxFlow
              </span>
              <span className="block text-xs text-gray-500 -mt-1 group-hover:text-purple-600 transition-colors">Voice AI Platform</span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
                    active
                      ? 'bg-purple-50 text-purple-700 shadow-md shadow-purple-500/20'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                  }`}
                >
                  <Icon size={18} className={`${active ? 'text-purple-600' : ''} group-hover:scale-110 transition-transform`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <Link
              to="/config"
              className={`group p-2 rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 ${
                isActive('/config')
                  ? 'bg-purple-50 text-purple-600 shadow-md shadow-purple-500/20'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title="Settings"
            >
              <Settings size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </Link>
            
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="group flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-purple-500/50 transition-all duration-300">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-sm font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                    {user?.email?.split('@')[0] || 'User'}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {user?.subscription_tier || 'Free'} Plan
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border-2 border-gray-200 py-2 z-20 animate-scale-in">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">
                        {user?.subscription_tier || 'Free'} Plan • {user?.max_agents || 0} Agents
                      </p>
                    </div>
                    
                    <Link
                      to="/config"
                      onClick={() => setShowUserMenu(false)}
                      className="group flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-purple-600 transition-all duration-300"
                    >
                      <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                      <span>Settings</span>
                    </Link>
                    
                    <Link
                      to="/upgrade"
                      onClick={() => setShowUserMenu(false)}
                      className="group flex items-center space-x-2 px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 transition-all duration-300"
                    >
                      <Zap className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Upgrade Plan</span>
                    </Link>
                    
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          handleLogout();
                        }}
                        className="group flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-all duration-300 w-full"
                      >
                        <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden border-t border-gray-200 bg-white">
        <div className="flex justify-around py-2 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-all ${
                  active
                    ? 'text-purple-600 bg-purple-50'
                    : 'text-gray-600'
                }`}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;