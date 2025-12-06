import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { agentAPI } from '../utils/api';

const AgentContext = createContext(null);

export const AgentProvider = ({ children }) => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cache, setCache] = useState({});

  const fetchAgents = useCallback(async (force = false) => {
    // Check cache first (5 minute cache)
    const cacheKey = 'agents_list';
    const now = Date.now();
    if (!force && cache[cacheKey] && (now - cache[cacheKey].timestamp < 300000)) {
      setAgents(cache[cacheKey].data);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await agentAPI.getAll();
      const data = response.data.data || [];
      setAgents(data);
      setCache(prev => ({ ...prev, [cacheKey]: { data, timestamp: now } }));
    } catch (err) {
      console.error('Fetch agents error:', err);
      setError(err.response?.data?.message || 'Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  }, [cache]);

  const createAgent = async (agentData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await agentAPI.create(agentData);
      await fetchAgents(); // Refresh list
      return { success: true, data: response.data.data };
    } catch (err) {
      console.error('Create agent error:', err);
      const message = err.response?.data?.message || 'Failed to create agent';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const updateAgent = async (id, agentData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await agentAPI.update(id, agentData);
      await fetchAgents(); // Refresh list
      return { success: true, data: response.data.data };
    } catch (err) {
      console.error('Update agent error:', err);
      const message = err.response?.data?.message || 'Failed to update agent';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const deleteAgent = async (id) => {
    try {
      setLoading(true);
      setError(null);
      await agentAPI.delete(id);
      await fetchAgents(); // Refresh list
      return { success: true };
    } catch (err) {
      console.error('Delete agent error:', err);
      const message = err.response?.data?.message || 'Failed to delete agent';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({
    agents,
    loading,
    error,
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
  }), [agents, loading, error, fetchAgents]);

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
};

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider');
  }
  return context;
};