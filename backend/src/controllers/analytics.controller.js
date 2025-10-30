import { query } from '../utils/supabase.js';
import { getMultiUserUsageStats } from '../services/usage-tracking.service.js';

/**
 * Get platform overview statistics
 */
export const getPlatformOverview = async (req, res, next) => {
  try {
    // Get total users
    const { data: allUsers } = await query('users', 'select', {
      columns: 'id, subscription_tier, is_active, created_at',
    });

    // Get total agents
    const { data: allAgents } = await query('agents', 'select', {
      columns: 'id, created_at',
    });

    // Get total runs
    const { data: allRuns } = await query('agent_runs', 'select', {
      columns: 'id, status, created_at, duration_seconds, groq_tokens',
    });

    // Calculate statistics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      users: {
        total: allUsers?.length || 0,
        active: allUsers?.filter(u => u.is_active).length || 0,
        new_this_month: allUsers?.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length || 0,
        by_tier: {
          free: allUsers?.filter(u => u.subscription_tier === 'free').length || 0,
          pro: allUsers?.filter(u => u.subscription_tier === 'pro').length || 0,
          enterprise: allUsers?.filter(u => u.subscription_tier === 'enterprise').length || 0,
        },
      },
      agents: {
        total: allAgents?.length || 0,
        created_this_month: allAgents?.filter(a => new Date(a.created_at) >= thirtyDaysAgo).length || 0,
        created_this_week: allAgents?.filter(a => new Date(a.created_at) >= sevenDaysAgo).length || 0,
      },
      runs: {
        total: allRuns?.length || 0,
        completed: allRuns?.filter(r => r.status === 'completed').length || 0,
        failed: allRuns?.filter(r => r.status === 'failed').length || 0,
        in_progress: allRuns?.filter(r => r.status === 'in_progress').length || 0,
        this_month: allRuns?.filter(r => new Date(r.created_at) >= thirtyDaysAgo).length || 0,
        this_week: allRuns?.filter(r => new Date(r.created_at) >= sevenDaysAgo).length || 0,
        total_duration: allRuns?.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) || 0,
        total_tokens: allRuns?.reduce((sum, r) => sum + (parseFloat(r.groq_tokens) || 0), 0) || 0,
      },
    };

    // Calculate growth rates
    const lastMonth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const usersLastMonth = allUsers?.filter(u => 
      new Date(u.created_at) >= lastMonth && new Date(u.created_at) < thirtyDaysAgo
    ).length || 0;

    const agentsLastMonth = allAgents?.filter(a => 
      new Date(a.created_at) >= lastMonth && new Date(a.created_at) < thirtyDaysAgo
    ).length || 0;

    const runsLastMonth = allRuns?.filter(r => 
      new Date(r.created_at) >= lastMonth && new Date(r.created_at) < thirtyDaysAgo
    ).length || 0;

    stats.growth = {
      users: usersLastMonth > 0 ? ((stats.users.new_this_month - usersLastMonth) / usersLastMonth * 100) : 0,
      agents: agentsLastMonth > 0 ? ((stats.agents.created_this_month - agentsLastMonth) / agentsLastMonth * 100) : 0,
      runs: runsLastMonth > 0 ? ((stats.runs.this_month - runsLastMonth) / runsLastMonth * 100) : 0,
    };

    res.json({
      success: true,
      data: stats,
      generated_at: now.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user growth analytics
 */
export const getUserGrowthAnalytics = async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;

    let startDate;
    const now = new Date();

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get users created in the period
    const { data: users } = await query('users', 'select', {
      filter: { created_at: `gte.${startDate.toISOString()}` },
      columns: 'created_at, subscription_tier, is_active',
      order: { column: 'created_at', ascending: true },
    });

    // Group by date
    const dailyGrowth = {};
    const currentDate = new Date(startDate);
    
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyGrowth[dateKey] = {
        date: dateKey,
        new_users: 0,
        free: 0,
        pro: 0,
        enterprise: 0,
        cumulative: 0,
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Fill in actual data
    (users || []).forEach(user => {
      const dateKey = user.created_at.split('T')[0];
      if (dailyGrowth[dateKey]) {
        dailyGrowth[dateKey].new_users++;
        dailyGrowth[dateKey][user.subscription_tier]++;
      }
    });

    // Calculate cumulative totals
    let cumulative = 0;
    const growthData = Object.values(dailyGrowth).map(day => {
      cumulative += day.new_users;
      return {
        ...day,
        cumulative,
      };
    });

    res.json({
      success: true,
      data: {
        period,
        growth_data: growthData,
        summary: {
          total_new_users: users?.length || 0,
          average_daily: Math.round((users?.length || 0) / growthData.length),
          by_tier: {
            free: users?.filter(u => u.subscription_tier === 'free').length || 0,
            pro: users?.filter(u => u.subscription_tier === 'pro').length || 0,
            enterprise: users?.filter(u => u.subscription_tier === 'enterprise').length || 0,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get usage analytics across the platform
 */
export const getUsageAnalytics = async (req, res, next) => {
  try {
    const { period = 'current_month', limit = 50 } = req.query;

    // Get multi-user usage statistics
    const usageStats = await getMultiUserUsageStats({
      period,
      limit: parseInt(limit),
      sortBy: 'total_costs',
    });

    // Get platform-wide usage totals
    let dateFilter;
    if (period === 'current_month') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      dateFilter = `gte.${currentMonth}-01`;
    } else if (period === 'last_30_days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = `gte.${thirtyDaysAgo.toISOString().split('T')[0]}`;
    }

    const { data: usageData } = await query('user_usage_tracking', 'select', {
      filter: dateFilter ? { date: dateFilter } : {},
      columns: 'date, total_tokens, total_calls, total_duration_seconds, api_costs',
    });

    // Calculate platform totals
    const platformTotals = (usageData || []).reduce((acc, day) => ({
      total_tokens: acc.total_tokens + (parseFloat(day.total_tokens) || 0),
      total_calls: acc.total_calls + (day.total_calls || 0),
      total_duration: acc.total_duration + (day.total_duration_seconds || 0),
      total_costs: acc.total_costs + (parseFloat(day.api_costs) || 0),
    }), { total_tokens: 0, total_calls: 0, total_duration: 0, total_costs: 0 });

    // Get daily usage trends
    const dailyUsage = {};
    (usageData || []).forEach(day => {
      if (!dailyUsage[day.date]) {
        dailyUsage[day.date] = {
          date: day.date,
          tokens: 0,
          calls: 0,
          duration: 0,
          costs: 0,
        };
      }
      dailyUsage[day.date].tokens += parseFloat(day.total_tokens) || 0;
      dailyUsage[day.date].calls += day.total_calls || 0;
      dailyUsage[day.date].duration += day.total_duration_seconds || 0;
      dailyUsage[day.date].costs += parseFloat(day.api_costs) || 0;
    });

    const trendData = Object.values(dailyUsage).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        platform_totals: platformTotals,
        daily_trends: trendData,
        top_users: usageStats,
        period,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get revenue analytics
 */
export const getRevenueAnalytics = async (req, res, next) => {
  try {
    // Get subscription data
    const { data: subscriptions } = await query('subscriptions', 'select', {
      filter: { status: 'active' },
      columns: 'plan, monthly_price, started_at',
    });

    // Calculate revenue by plan
    const revenueByPlan = {
      free: { count: 0, revenue: 0 },
      pro: { count: 0, revenue: 0 },
      enterprise: { count: 0, revenue: 0 },
    };

    let totalMonthlyRevenue = 0;

    (subscriptions || []).forEach(sub => {
      const plan = sub.plan;
      const price = parseFloat(sub.monthly_price) || 0;
      
      if (revenueByPlan[plan]) {
        revenueByPlan[plan].count++;
        revenueByPlan[plan].revenue += price;
        totalMonthlyRevenue += price;
      }
    });

    // Calculate projected annual revenue
    const projectedAnnualRevenue = totalMonthlyRevenue * 12;

    // Get growth trends (last 12 months)
    const monthlyTrends = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7);
      
      const monthSubs = (subscriptions || []).filter(sub => {
        const subDate = new Date(sub.started_at);
        return subDate.getFullYear() === monthDate.getFullYear() && 
               subDate.getMonth() === monthDate.getMonth();
      });

      const monthRevenue = monthSubs.reduce((sum, sub) => sum + (parseFloat(sub.monthly_price) || 0), 0);

      monthlyTrends.push({
        month: monthKey,
        new_subscriptions: monthSubs.length,
        revenue: monthRevenue,
        cumulative_revenue: totalMonthlyRevenue, // This would need more complex calculation for historical data
      });
    }

    res.json({
      success: true,
      data: {
        current_monthly_revenue: totalMonthlyRevenue,
        projected_annual_revenue: projectedAnnualRevenue,
        revenue_by_plan: revenueByPlan,
        monthly_trends: monthlyTrends,
        total_active_subscriptions: subscriptions?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get system health metrics
 */
export const getSystemHealth = async (req, res, next) => {
  try {
    // Get recent error rates
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { data: recentRuns } = await query('agent_runs', 'select', {
      filter: { created_at: `gte.${oneDayAgo.toISOString()}` },
      columns: 'status, created_at, duration_seconds',
    });

    const totalRuns = recentRuns?.length || 0;
    const failedRuns = recentRuns?.filter(r => r.status === 'failed').length || 0;
    const completedRuns = recentRuns?.filter(r => r.status === 'completed').length || 0;
    const inProgressRuns = recentRuns?.filter(r => r.status === 'in_progress').length || 0;

    const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;
    const successRate = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;

    // Calculate average response time
    const completedRunsWithDuration = recentRuns?.filter(r => r.status === 'completed' && r.duration_seconds > 0) || [];
    const avgResponseTime = completedRunsWithDuration.length > 0 
      ? completedRunsWithDuration.reduce((sum, r) => sum + r.duration_seconds, 0) / completedRunsWithDuration.length
      : 0;

    // Get API key configuration status
    const { data: apiKeyStats } = await query('user_api_keys', 'select', {
      filter: { is_active: true },
      columns: 'provider, user_id',
    });

    const apiKeysByProvider = {
      groq: 0,
      deepgram: 0,
      twilio: 0,
    };

    (apiKeyStats || []).forEach(key => {
      if (apiKeysByProvider.hasOwnProperty(key.provider)) {
        apiKeysByProvider[key.provider]++;
      }
    });

    // Get database health (simple check)
    const { data: dbCheck } = await query('users', 'select', {
      columns: 'id',
      limit: 1,
    });

    const dbHealthy = !!dbCheck;

    res.json({
      success: true,
      data: {
        system_status: errorRate < 5 ? 'healthy' : errorRate < 15 ? 'warning' : 'critical',
        metrics: {
          error_rate: Math.round(errorRate * 100) / 100,
          success_rate: Math.round(successRate * 100) / 100,
          avg_response_time: Math.round(avgResponseTime * 100) / 100,
          total_runs_24h: totalRuns,
          failed_runs_24h: failedRuns,
          in_progress_runs: inProgressRuns,
        },
        api_keys: {
          total_configured: Object.values(apiKeysByProvider).reduce((sum, count) => sum + count, 0),
          by_provider: apiKeysByProvider,
        },
        database: {
          status: dbHealthy ? 'connected' : 'error',
          last_check: new Date().toISOString(),
        },
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export analytics data as CSV
 */
export const exportAnalyticsData = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { period = '30d' } = req.query;

    let csvData = '';
    let filename = `voxflow-${type}-analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`;

    switch (type) {
      case 'overview':
        csvData = await generateOverviewCSV();
        break;

      case 'user-growth':
        csvData = await generateUserGrowthCSV(period);
        break;

      case 'usage':
        csvData = await generateUsageCSV(period);
        break;

      case 'revenue':
        csvData = await generateRevenueCSV();
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type. Supported types: overview, user-growth, usage, revenue'
        });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit logs
 */
export const getAuditLogs = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      admin_user_id, 
      target_user_id,
      date_from,
      date_to 
    } = req.query;

    // Build filter
    const filter = {};
    if (action) filter.action = action;
    if (admin_user_id) filter.admin_user_id = admin_user_id;
    if (target_user_id) filter.target_user_id = target_user_id;
    if (date_from) filter.created_at = `gte.${date_from}`;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data: logs, error } = await query('admin_audit_logs', 'select', {
      filter,
      order: { column: 'created_at', ascending: false },
      limit: parseInt(limit),
      offset: offset,
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Get admin and target user details
    const logsWithUsers = await Promise.all(
      (logs || []).map(async (log) => {
        const [adminData, targetData] = await Promise.all([
          log.admin_user_id ? query('users', 'select', {
            filter: { id: log.admin_user_id },
            columns: 'email',
          }) : Promise.resolve({ data: null }),
          log.target_user_id ? query('users', 'select', {
            filter: { id: log.target_user_id },
            columns: 'email',
          }) : Promise.resolve({ data: null }),
        ]);

        return {
          ...log,
          admin_email: adminData.data?.[0]?.email || 'Unknown',
          target_email: targetData.data?.[0]?.email || null,
        };
      })
    );

    // Get total count
    const { data: countData } = await query('admin_audit_logs', 'select', {
      filter,
      columns: 'id',
    });

    res.json({
      success: true,
      data: logsWithUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countData?.length || 0,
        pages: Math.ceil((countData?.length || 0) / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};
/**

 * Helper function to escape CSV values
 */
const escapeCSV = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

/**
 * Generate overview data CSV
 */
const generateOverviewCSV = async () => {
  try {
    // Get total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: activeUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_login', thirtyDaysAgo.toISOString());

    // Get users by subscription tier
    const { data: usersByTier } = await supabase
      .from('users')
      .select('subscription_tier')
      .not('subscription_tier', 'is', null);

    const tierCounts = usersByTier.reduce((acc, user) => {
      acc[user.subscription_tier] = (acc[user.subscription_tier] || 0) + 1;
      return acc;
    }, { free: 0, pro: 0, enterprise: 0 });

    // Get total agents
    const { count: totalAgents } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true });

    // Get total runs
    const { count: totalRuns } = await supabase
      .from('agent_runs')
      .select('*', { count: 'exact', head: true });

    // Get runs by status
    const { data: runsByStatus } = await supabase
      .from('agent_runs')
      .select('status');

    const statusCounts = runsByStatus.reduce((acc, run) => {
      acc[run.status] = (acc[run.status] || 0) + 1;
      return acc;
    }, { completed: 0, failed: 0, in_progress: 0 });

    // Get total duration and tokens
    const { data: runMetrics } = await supabase
      .from('agent_runs')
      .select('duration_seconds, groq_tokens')
      .eq('status', 'completed');

    const totalDuration = runMetrics.reduce((sum, run) => sum + (run.duration_seconds || 0), 0);
    const totalTokens = runMetrics.reduce((sum, run) => sum + (run.groq_tokens || 0), 0);

    // Generate CSV
    const csvRows = [
      ['Metric', 'Value', 'Description'],
      ['Total Users', totalUsers || 0, 'Total registered users'],
      ['Active Users', activeUsers || 0, 'Users active in last 30 days'],
      ['Free Users', tierCounts.free, 'Users on free plan'],
      ['Pro Users', tierCounts.pro, 'Users on pro plan'],
      ['Enterprise Users', tierCounts.enterprise, 'Users on enterprise plan'],
      ['Total Agents', totalAgents || 0, 'Total voice agents created'],
      ['Total Runs', totalRuns || 0, 'Total agent runs executed'],
      ['Completed Runs', statusCounts.completed, 'Successfully completed runs'],
      ['Failed Runs', statusCounts.failed, 'Failed runs'],
      ['In Progress Runs', statusCounts.in_progress, 'Currently running'],
      ['Total Duration (seconds)', totalDuration, 'Total call duration'],
      ['Total Tokens', totalTokens, 'Total tokens processed'],
      ['Success Rate (%)', totalRuns > 0 ? ((statusCounts.completed / totalRuns) * 100).toFixed(2) : 0, 'Percentage of successful runs']
    ];

    return csvRows.map(row => row.map(escapeCSV).join(',')).join('\n');
  } catch (error) {
    console.error('Error generating overview CSV:', error);
    throw error;
  }
};

/**
 * Generate user growth data CSV
 */
const generateUserGrowthCSV = async (period) => {
  try {
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get daily user registrations
    const { data: dailyRegistrations } = await supabase
      .from('users')
      .select('created_at, subscription_tier')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // Group by date
    const dailyData = {};
    let cumulativeTotal = 0;

    dailyRegistrations.forEach(user => {
      const date = user.created_at.split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, free: 0, pro: 0, enterprise: 0 };
      }
      dailyData[date].total++;
      dailyData[date][user.subscription_tier || 'free']++;
    });

    // Generate CSV
    const csvRows = [
      ['Date', 'New Users', 'Cumulative Total', 'Free', 'Pro', 'Enterprise']
    ];

    Object.keys(dailyData).sort().forEach(date => {
      const data = dailyData[date];
      cumulativeTotal += data.total;
      csvRows.push([
        date,
        data.total,
        cumulativeTotal,
        data.free,
        data.pro,
        data.enterprise
      ]);
    });

    return csvRows.map(row => row.map(escapeCSV).join(',')).join('\n');
  } catch (error) {
    console.error('Error generating user growth CSV:', error);
    throw error;
  }
};

/**
 * Generate usage analytics CSV
 */
const generateUsageCSV = async (period) => {
  try {
    const daysBack = period === 'last_30_days' ? 30 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get daily usage data
    const { data: dailyUsage } = await supabase
      .from('user_usage_tracking')
      .select('date, total_tokens, total_calls, total_duration_seconds, api_costs')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Group by date and sum totals
    const dailyTotals = {};
    dailyUsage.forEach(usage => {
      const date = usage.date;
      if (!dailyTotals[date]) {
        dailyTotals[date] = { tokens: 0, calls: 0, duration: 0, costs: 0 };
      }
      dailyTotals[date].tokens += usage.total_tokens || 0;
      dailyTotals[date].calls += usage.total_calls || 0;
      dailyTotals[date].duration += usage.total_duration_seconds || 0;
      dailyTotals[date].costs += usage.api_costs || 0;
    });

    // Generate CSV
    const csvRows = [
      ['Date', 'Total Tokens', 'Total Calls', 'Total Duration (seconds)', 'Total Costs ($)']
    ];

    Object.keys(dailyTotals).sort().forEach(date => {
      const data = dailyTotals[date];
      csvRows.push([
        date,
        data.tokens,
        data.calls,
        data.duration,
        data.costs.toFixed(2)
      ]);
    });

    return csvRows.map(row => row.map(escapeCSV).join(',')).join('\n');
  } catch (error) {
    console.error('Error generating usage CSV:', error);
    throw error;
  }
};

/**
 * Generate revenue analytics CSV
 */
const generateRevenueCSV = async () => {
  try {
    // Get subscription data
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('plan, monthly_price, status, started_at')
      .eq('status', 'active');

    // Calculate revenue by plan
    const revenueByPlan = subscriptions.reduce((acc, sub) => {
      const plan = sub.plan || 'free';
      if (!acc[plan]) {
        acc[plan] = { revenue: 0, count: 0 };
      }
      acc[plan].revenue += sub.monthly_price || 0;
      acc[plan].count++;
      return acc;
    }, { free: { revenue: 0, count: 0 }, pro: { revenue: 0, count: 0 }, enterprise: { revenue: 0, count: 0 } });

    // Get monthly trends (last 12 months)
    const monthlyTrends = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const { data: monthSubs } = await supabase
        .from('subscriptions')
        .select('monthly_price')
        .gte('started_at', monthStart.toISOString())
        .lte('started_at', monthEnd.toISOString())
        .eq('status', 'active');

      const monthRevenue = monthSubs.reduce((sum, sub) => sum + (sub.monthly_price || 0), 0);
      
      monthlyTrends.push({
        month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        revenue: monthRevenue,
        new_subscriptions: monthSubs.length
      });
    }

    // Generate CSV
    const csvRows = [
      ['Report Type', 'Data'],
      ['', ''],
      ['Revenue by Plan', ''],
      ['Plan', 'Monthly Revenue ($)', 'Active Subscriptions'],
      ['Free', revenueByPlan.free.revenue.toFixed(2), revenueByPlan.free.count],
      ['Pro', revenueByPlan.pro.revenue.toFixed(2), revenueByPlan.pro.count],
      ['Enterprise', revenueByPlan.enterprise.revenue.toFixed(2), revenueByPlan.enterprise.count],
      ['', ''],
      ['Monthly Trends', ''],
      ['Month', 'Revenue ($)', 'New Subscriptions']
    ];

    monthlyTrends.forEach(trend => {
      csvRows.push([
        trend.month,
        trend.revenue.toFixed(2),
        trend.new_subscriptions
      ]);
    });

    return csvRows.map(row => row.map(escapeCSV).join(',')).join('\n');
  } catch (error) {
    console.error('Error generating revenue CSV:', error);
    throw error;
  }
};