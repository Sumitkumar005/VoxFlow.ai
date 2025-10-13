import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AgentProvider } from './context/AgentContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import CreateAgent from './pages/CreateAgent';
import AgentList from './pages/AgentList';
import AgentDetails from './pages/AgentDetails';
import WebCall from './pages/WebCall';
import PhoneCall from './pages/PhoneCall';
import RunCompleted from './pages/RunCompleted';
import RunHistory from './pages/RunHistory';
import TelephonyConfig from './pages/TelephonyConfig';
import ServiceConfig from './pages/ServiceConfig';
import Campaigns from './pages/Campaigns';
import CreateCampaign from './pages/CreateCampaign';
import CampaignDetails from './pages/CampaignDetails';
import Usage from './pages/Usage';
import Reports from './pages/Reports';

function App() {
  return (
    <AuthProvider>
      <AgentProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50">
                    <Navbar />
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                      <Routes>
                        <Route path="/" element={<Navigate to="/agents" replace />} />
                        <Route path="/agents" element={<AgentList />} />
                        <Route path="/agents/create" element={<CreateAgent />} />
                        <Route path="/agents/:id" element={<AgentDetails />} />
                        <Route path="/agents/:id/web-call" element={<WebCall />} />
                        <Route path="/agents/:id/phone-call" element={<PhoneCall />} />
                        <Route path="/agents/:id/runs" element={<RunHistory />} />
                        <Route path="/run/:runId/completed" element={<RunCompleted />} />
                        
                        <Route path="/campaigns" element={<Campaigns />} />
                        <Route path="/campaigns/create" element={<CreateCampaign />} />
                        <Route path="/campaigns/:id" element={<CampaignDetails />} />
                        
                        <Route path="/usage" element={<Usage />} />
                        <Route path="/reports" element={<Reports />} />
                        
                        <Route path="/config" element={<ServiceConfig />} />
                        <Route path="/config/telephony" element={<TelephonyConfig />} />
                        
                        <Route path="/developers" element={<Home />} />
                      </Routes>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AgentProvider>
    </AuthProvider>
  );
}

export default App;