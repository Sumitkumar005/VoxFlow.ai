import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AgentProvider } from './context/AgentContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner';
import './styles/animations.css';

// Eager load critical pages
import Login from './pages/Login';
import Register from './pages/Register';

// Lazy load all other pages for better performance
const Home = lazy(() => import('./pages/Home'));
const CreateAgent = lazy(() => import('./pages/CreateAgent'));
const AgentList = lazy(() => import('./pages/AgentList'));
const AgentDetails = lazy(() => import('./pages/AgentDetails'));
const WebCall = lazy(() => import('./pages/WebCall'));
const PhoneCall = lazy(() => import('./pages/PhoneCall'));
const RunCompleted = lazy(() => import('./pages/RunCompleted'));
const RunHistory = lazy(() => import('./pages/RunHistory'));
const ServiceConfig = lazy(() => import('./pages/ServiceConfig'));
const ApiKeySettings = lazy(() => import('./pages/ApiKeySettings'));
const Upgrade = lazy(() => import('./pages/Upgrade'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CreateCampaign = lazy(() => import('./pages/CreateCampaign'));
const CampaignDetails = lazy(() => import('./pages/CampaignDetails'));
const Usage = lazy(() => import('./pages/Usage'));
const Reports = lazy(() => import('./pages/Reports'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));

function App() {
  return (
    <AuthProvider>
      <AgentProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Admin Routes */}
            <Route 
              path="/admin/*" 
              element={
                <ProtectedRoute adminOnly={true}>
                  <Suspense fallback={<LoadingSpinner message="Loading admin panel..." />}>
                    <AdminLayout>
                      <Routes>
                      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                      <Route path="/dashboard" element={<AdminDashboard />} />
                      {/* Placeholder routes for other admin pages */}
                      <Route path="/users" element={<UserManagement />} />
                      <Route path="/analytics" element={
                        <div className="text-center py-12">
                          <h2 className="text-xl font-bold text-gray-900 mb-2">Analytics</h2>
                          <p className="text-gray-600">Coming soon...</p>
                        </div>
                      } />
                      <Route path="/system" element={
                        <div className="text-center py-12">
                          <h2 className="text-xl font-bold text-gray-900 mb-2">System Health</h2>
                          <p className="text-gray-600">Coming soon...</p>
                        </div>
                      } />
                      <Route path="/logs" element={
                        <div className="text-center py-12">
                          <h2 className="text-xl font-bold text-gray-900 mb-2">Audit Logs</h2>
                          <p className="text-gray-600">Coming soon...</p>
                        </div>
                      } />
                      </Routes>
                    </AdminLayout>
                  </Suspense>
                </ProtectedRoute>
              } 
            />

            {/* Protected Routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50">
                    <Navbar />
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                      <Suspense fallback={<LoadingSpinner message="Loading..." />}>
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
                        <Route path="/upgrade" element={<Upgrade />} />
                        
                        <Route path="/config" element={<ServiceConfig />} />
                        <Route path="/config/api-keys" element={<ApiKeySettings />} />
                        
                        <Route path="/developers" element={<Home />} />
                        </Routes>
                      </Suspense>
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