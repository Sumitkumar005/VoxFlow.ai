import { query, supabase } from '../utils/supabase.js';

/**
 * Get usage dashboard data
 */
export const getUsageDashboard = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    // Get current billing period dates
    const now = new Date();
    const periodStart = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    // Get all agents for user
    const { data: agents } = await query('agents', 'select', {
      filter: { user_id: req.user.id },
    });

    const agentIds = agents?.map(a => a.id) || [];

    if (agentIds.length === 0) {
      return res.json({
        success: true,
        data: {
          total_tokens: 0,
          total_duration: 0,
          total_runs: 0,
          period_start: periodStart,
          period_end: periodEnd,
        },
      });
    }

    // Get usage stats for the period
    const { data: runs } = await supabase
      .from('agent_runs')
      .select('*')
      .in('agent_id', agentIds)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .in('status', ['completed', 'user_hangup', 'ended']);

    const totalTokens = runs?.reduce((sum, run) => sum + (parseFloat(run.groq_tokens) || 0), 0) || 0;
    const totalDuration = runs?.reduce((sum, run) => sum + (run.duration_seconds || 0), 0) || 0;
    const totalRuns = runs?.length || 0;

    // Format total duration as minutes and seconds
    const minutes = Math.floor(totalDuration / 60);
    const seconds = totalDuration % 60;

    // Get user quota from user object
    const tokenQuota = req.user.monthly_token_quota || 1000;
    const agentLimit = req.user.max_agents || 2;
    
    // Calculate usage percentage
    const tokenPercentage = tokenQuota > 0 ? Math.min(Math.round((totalTokens / tokenQuota) * 100), 100) : 0;

    res.json({
      success: true,
      data: {
        total_tokens: totalTokens.toFixed(2),
        total_duration: totalDuration,
        total_duration_formatted: `${minutes}m ${seconds}s`,
        total_runs: totalRuns,
        period_start: periodStart,
        period_end: periodEnd,
        quota: tokenQuota,
        percentage_used: tokenPercentage,
        current_usage: {
          tokens_this_month: parseFloat(totalTokens.toFixed(2)),
          agents: agentIds.length,
          calls_this_month: totalRuns,
          costs_this_month: 0.00
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get usage history with filters
 */
export const getUsageHistory = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      agent_id,
      phone_number,
      disposition,
      date_from,
      date_to,
      min_duration,
      max_duration,
    } = req.query;

    // Get user's agents
    const { data: agents } = await query('agents', 'select', {
      filter: { user_id: req.user.id },
      columns: 'id',
    });

    const agentIds = agents?.map(a => a.id).filter(id => id !== null && id !== undefined) || [];

    if (agentIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0 },
      });
    }

    // Build query
    let queryBuilder = supabase
      .from('agent_runs')
      .select('*, agents(name, type)', { count: 'exact' })
      .in('agent_id', agentIds)
      .in('status', ['completed', 'user_hangup', 'ended']);

    // Apply filters
    if (agent_id) queryBuilder = queryBuilder.eq('agent_id', agent_id);
    if (phone_number) queryBuilder = queryBuilder.ilike('phone_number', `%${phone_number}%`);
    if (disposition) queryBuilder = queryBuilder.eq('disposition', disposition);
    if (date_from) queryBuilder = queryBuilder.gte('created_at', date_from);
    if (date_to) queryBuilder = queryBuilder.lte('created_at', date_to);
    if (min_duration) queryBuilder = queryBuilder.gte('duration_seconds', parseInt(min_duration));
    if (max_duration) queryBuilder = queryBuilder.lte('duration_seconds', parseInt(max_duration));

    // Pagination
    const offset = (page - 1) * limit;
    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data, count, error } = await queryBuilder;

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};