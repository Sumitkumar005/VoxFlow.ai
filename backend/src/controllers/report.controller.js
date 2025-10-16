import { supabase, query } from '../utils/supabase.js';

/**
 * Get daily reports
 */
export const getDailyReports = async (req, res, next) => {
  try {
    const { date, agent_id, timezone = 'America/New_York' } = req.query;

    // Default to today
    const reportDate = date || new Date().toISOString().split('T')[0];
    const startOfDay = `${reportDate}T00:00:00.000Z`;
    const endOfDay = `${reportDate}T23:59:59.999Z`;

    // Get user's agents
    const { data: agents } = await query('agents', 'select', {
      filter: { user_id: req.user.id },
      columns: 'id, name',
    });

    const agentIds = agents?.map(a => a.id).filter(id => id !== null && id !== undefined) || [];

    if (agentIds.length === 0) {
      return res.json({
        success: true,
        data: {
          total_runs: 0,
          transfer_dispositions: 0,
          disposition_distribution: {},
          call_duration_distribution: {},
          agents: [],
        },
      });
    }

    // Build query
    let queryBuilder = supabase
      .from('agent_runs')
      .select('*')
      .in('agent_id', agentIds)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .eq('status', 'completed');

    // Filter by specific agent if provided
    if (agent_id) {
      queryBuilder = queryBuilder.eq('agent_id', agent_id);
    }

    const { data: runs, error } = await queryBuilder;

    if (error) throw error;

    // Calculate metrics
    const totalRuns = runs?.length || 0;
    
    // Transfer dispositions (XFER)
    const transferDispositions = runs?.filter(r => 
      r.disposition?.toLowerCase().includes('xfer')
    ).length || 0;

    // Disposition distribution
    const dispositionDist = {};
    runs?.forEach(run => {
      const disp = run.disposition || 'UNKNOWN';
      dispositionDist[disp] = (dispositionDist[disp] || 0) + 1;
    });

    // Call duration distribution (buckets)
    const durationDist = {
      '0-10s': 0,
      '10-30s': 0,
      '30-60s': 0,
      '60-120s': 0,
      '120s+': 0,
    };

    runs?.forEach(run => {
      const duration = run.duration_seconds || 0;
      if (duration <= 10) durationDist['0-10s']++;
      else if (duration <= 30) durationDist['10-30s']++;
      else if (duration <= 60) durationDist['30-60s']++;
      else if (duration <= 120) durationDist['60-120s']++;
      else durationDist['120s+']++;
    });

    res.json({
      success: true,
      data: {
        date: reportDate,
        timezone,
        total_runs: totalRuns,
        transfer_dispositions: transferDispositions,
        disposition_distribution: dispositionDist,
        call_duration_distribution: durationDist,
        agents: agents || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download report as CSV
 */
export const downloadReportCSV = async (req, res, next) => {
  try {
    const { date, agent_id } = req.query;

    const reportDate = date || new Date().toISOString().split('T')[0];
    const startOfDay = `${reportDate}T00:00:00.000Z`;
    const endOfDay = `${reportDate}T23:59:59.999Z`;

    // Get user's agents
    const { data: agents } = await query('agents', 'select', {
      filter: { user_id: req.user.id },
      columns: 'id',
    });

    const agentIds = agents?.map(a => a.id).filter(id => id !== null && id !== undefined) || [];

    // Build query
    let queryBuilder = supabase
      .from('agent_runs')
      .select('*, agents(name, type)')
      .in('agent_id', agentIds)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .eq('status', 'completed');

    if (agent_id) {
      queryBuilder = queryBuilder.eq('agent_id', agent_id);
    }

    const { data: runs, error } = await queryBuilder;

    if (error) throw error;

    // Generate CSV
    const csvRows = [
      ['Run ID', 'Agent Name', 'Phone Number', 'Disposition', 'Date', 'Duration (s)', 'Tokens'],
    ];

    runs?.forEach(run => {
      csvRows.push([
        run.run_number,
        run.agents?.name || 'N/A',
        run.phone_number || '-',
        run.disposition || 'N/A',
        new Date(run.created_at).toLocaleString(),
        run.duration_seconds || 0,
        run.dograh_tokens || 0,
      ]);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="voxflow-report-${reportDate}.csv"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};