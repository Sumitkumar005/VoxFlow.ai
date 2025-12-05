/**
 * Error Tracking Service
 * 
 * Provides comprehensive error tracking, alerting, and analysis
 * for the VoxFlow multi-tenant system.
 */

import { LoggingService } from './logging.service.js';
import { createClient } from '@supabase/supabase-js';

// Use service role key if available, otherwise use anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = supabaseKey ? createClient(
  process.env.SUPABASE_URL,
  supabaseKey
) : null;

class ErrorTrackingService {
  /**
   * Track application error
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {Promise<string>} Error tracking ID
   */
  static async trackError(error, context = {}) {
    try {
      const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const errorData = {
        error_id: errorId,
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        context: JSON.stringify(context),
        timestamp: new Date().toISOString(),
        severity: this.determineSeverity(error, context),
        fingerprint: this.generateFingerprint(error),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0'
      };
      
      // Store error in database
      await this.storeError(errorData);
      
      // Log error
      LoggingService.error('Error tracked', error, {
        error_id: errorId,
        ...context
      });
      
      // Check if error needs immediate attention
      if (errorData.severity === 'critical') {
        await this.sendAlert(errorData);
      }
      
      return errorId;
    } catch (trackingError) {
      LoggingService.error('Failed to track error', trackingError);
      throw trackingError;
    }
  }

  /**
   * Store error in database
   * @param {Object} errorData - Error data to store
   */
  static async storeError(errorData) {
    try {
      const { error } = await supabase
        .from('error_tracking')
        .insert([{
          error_id: errorData.error_id,
          name: errorData.name,
          message: errorData.message,
          stack: errorData.stack,
          code: errorData.code,
          context: errorData.context,
          severity: errorData.severity,
          fingerprint: errorData.fingerprint,
          environment: errorData.environment,
          version: errorData.version,
          created_at: errorData.timestamp
        }]);

      if (error) {
        // If error_tracking table doesn't exist, create it
        if (error.code === '42P01') {
          await this.createErrorTrackingTable();
          // Retry insert
          await supabase
            .from('error_tracking')
            .insert([{
              error_id: errorData.error_id,
              name: errorData.name,
              message: errorData.message,
              stack: errorData.stack,
              code: errorData.code,
              context: errorData.context,
              severity: errorData.severity,
              fingerprint: errorData.fingerprint,
              environment: errorData.environment,
              version: errorData.version,
              created_at: errorData.timestamp
            }]);
        } else {
          throw error;
        }
      }
    } catch (error) {
      LoggingService.error('Failed to store error in database', error);
      // Don't throw here to avoid recursive errors
    }
  }

  /**
   * Create error tracking table if it doesn't exist
   */
  static async createErrorTrackingTable() {
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS error_tracking (
            id SERIAL PRIMARY KEY,
            error_id VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            stack TEXT,
            code VARCHAR(100),
            context JSONB,
            severity VARCHAR(50) NOT NULL,
            fingerprint VARCHAR(255) NOT NULL,
            environment VARCHAR(50) NOT NULL,
            version VARCHAR(50) NOT NULL,
            resolved BOOLEAN DEFAULT FALSE,
            resolved_at TIMESTAMP,
            resolved_by VARCHAR(255),
            occurrence_count INTEGER DEFAULT 1,
            first_seen TIMESTAMP DEFAULT NOW(),
            last_seen TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_error_tracking_fingerprint ON error_tracking(fingerprint);
          CREATE INDEX IF NOT EXISTS idx_error_tracking_severity ON error_tracking(severity);
          CREATE INDEX IF NOT EXISTS idx_error_tracking_created_at ON error_tracking(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_error_tracking_resolved ON error_tracking(resolved);
        `
      });

      if (error) throw error;
    } catch (error) {
      LoggingService.error('Failed to create error tracking table', error);
    }
  }

  /**
   * Determine error severity
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {string} Severity level
   */
  static determineSeverity(error, context) {
    // Critical errors
    if (
      error.name === 'DatabaseConnectionError' ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('timeout') ||
      context.endpoint?.includes('/auth/') ||
      context.status_code >= 500
    ) {
      return 'critical';
    }
    
    // High severity errors
    if (
      error.name === 'ValidationError' ||
      error.name === 'AuthenticationError' ||
      context.status_code >= 400 ||
      error.message.includes('unauthorized') ||
      error.message.includes('forbidden')
    ) {
      return 'high';
    }
    
    // Medium severity errors
    if (
      error.name === 'NotFoundError' ||
      error.name === 'RateLimitError' ||
      context.status_code >= 300
    ) {
      return 'medium';
    }
    
    // Default to low severity
    return 'low';
  }

  /**
   * Generate error fingerprint for grouping similar errors
   * @param {Error} error - Error object
   * @returns {string} Error fingerprint
   */
  static generateFingerprint(error) {
    // Create fingerprint based on error name, message pattern, and stack trace
    const message = error.message.replace(/\d+/g, 'N').replace(/['"]/g, '');
    const stackLines = error.stack ? error.stack.split('\n').slice(0, 3) : [];
    const stackPattern = stackLines.join('|').replace(/:\d+:\d+/g, ':N:N');
    
    const fingerprint = `${error.name}:${message}:${stackPattern}`;
    
    // Create hash of fingerprint for consistent grouping
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Send alert for critical errors
   * @param {Object} errorData - Error data
   */
  static async sendAlert(errorData) {
    try {
      // Log alert
      LoggingService.warn('Critical error alert', {
        error_id: errorData.error_id,
        name: errorData.name,
        message: errorData.message,
        severity: errorData.severity
      });
      
      // In a real implementation, this would send notifications via:
      // - Email
      // - Slack
      // - PagerDuty
      // - SMS
      // etc.
      
      console.error('🚨 CRITICAL ERROR ALERT 🚨', {
        error_id: errorData.error_id,
        name: errorData.name,
        message: errorData.message,
        timestamp: errorData.timestamp
      });
    } catch (alertError) {
      LoggingService.error('Failed to send error alert', alertError);
    }
  }

  /**
   * Get error statistics
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Error statistics
   */
  static async getErrorStatistics(filters = {}) {
    try {
      const {
        timeframe = '24h',
        severity,
        environment = process.env.NODE_ENV
      } = filters;
      
      // Calculate time range
      const timeRanges = {
        '1h': new Date(Date.now() - 60 * 60 * 1000),
        '24h': new Date(Date.now() - 24 * 60 * 60 * 1000),
        '7d': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        '30d': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      };
      
      const startTime = timeRanges[timeframe] || timeRanges['24h'];
      
      let query = supabase
        .from('error_tracking')
        .select('*')
        .gte('created_at', startTime.toISOString())
        .eq('environment', environment);
      
      if (severity) {
        query = query.eq('severity', severity);
      }
      
      const { data: errors, error } = await query;
      
      if (error) throw error;
      
      // Calculate statistics
      const stats = {
        total_errors: errors.length,
        by_severity: {
          critical: errors.filter(e => e.severity === 'critical').length,
          high: errors.filter(e => e.severity === 'high').length,
          medium: errors.filter(e => e.severity === 'medium').length,
          low: errors.filter(e => e.severity === 'low').length
        },
        by_name: {},
        top_errors: [],
        resolved_count: errors.filter(e => e.resolved).length,
        unresolved_count: errors.filter(e => !e.resolved).length,
        timeframe,
        environment
      };
      
      // Group by error name
      errors.forEach(error => {
        stats.by_name[error.name] = (stats.by_name[error.name] || 0) + 1;
      });
      
      // Get top errors by occurrence
      const errorGroups = {};
      errors.forEach(error => {
        if (!errorGroups[error.fingerprint]) {
          errorGroups[error.fingerprint] = {
            fingerprint: error.fingerprint,
            name: error.name,
            message: error.message,
            severity: error.severity,
            count: 0,
            first_seen: error.created_at,
            last_seen: error.created_at
          };
        }
        errorGroups[error.fingerprint].count++;
        if (new Date(error.created_at) > new Date(errorGroups[error.fingerprint].last_seen)) {
          errorGroups[error.fingerprint].last_seen = error.created_at;
        }
      });
      
      stats.top_errors = Object.values(errorGroups)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      return stats;
    } catch (error) {
      LoggingService.error('Failed to get error statistics', error);
      throw error;
    }
  }

  /**
   * Get error details by ID
   * @param {string} errorId - Error ID
   * @returns {Promise<Object>} Error details
   */
  static async getErrorDetails(errorId) {
    try {
      const { data: error, error: queryError } = await supabase
        .from('error_tracking')
        .select('*')
        .eq('error_id', errorId)
        .single();
      
      if (queryError) throw queryError;
      
      return error;
    } catch (error) {
      LoggingService.error('Failed to get error details', error);
      throw error;
    }
  }

  /**
   * Mark error as resolved
   * @param {string} errorId - Error ID
   * @param {string} resolvedBy - User who resolved the error
   * @returns {Promise<Object>} Update result
   */
  static async resolveError(errorId, resolvedBy) {
    try {
      const { data, error } = await supabase
        .from('error_tracking')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          updated_at: new Date().toISOString()
        })
        .eq('error_id', errorId)
        .select();
      
      if (error) throw error;
      
      LoggingService.info('Error marked as resolved', {
        error_id: errorId,
        resolved_by: resolvedBy
      });
      
      return data[0];
    } catch (error) {
      LoggingService.error('Failed to resolve error', error);
      throw error;
    }
  }

  /**
   * Get error trends
   * @param {Object} options - Trend options
   * @returns {Promise<Array>} Error trends
   */
  static async getErrorTrends(options = {}) {
    try {
      const {
        timeframe = '7d',
        groupBy = 'day',
        environment = process.env.NODE_ENV
      } = options;
      
      // This would typically use a more sophisticated query
      // For now, return mock trend data
      const trends = [];
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 1;
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        trends.push({
          date: date.toISOString().split('T')[0],
          total_errors: Math.floor(Math.random() * 50),
          critical_errors: Math.floor(Math.random() * 5),
          high_errors: Math.floor(Math.random() * 15),
          medium_errors: Math.floor(Math.random() * 20),
          low_errors: Math.floor(Math.random() * 10)
        });
      }
      
      return trends;
    } catch (error) {
      LoggingService.error('Failed to get error trends', error);
      throw error;
    }
  }

  /**
   * Search errors
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Object>} Search results
   */
  static async searchErrors(criteria = {}) {
    try {
      const {
        query,
        severity,
        environment = process.env.NODE_ENV,
        resolved,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = criteria;
      
      let dbQuery = supabase
        .from('error_tracking')
        .select('*', { count: 'exact' })
        .eq('environment', environment)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (query) {
        dbQuery = dbQuery.or(`message.ilike.%${query}%,name.ilike.%${query}%`);
      }
      
      if (severity) {
        dbQuery = dbQuery.eq('severity', severity);
      }
      
      if (resolved !== undefined) {
        dbQuery = dbQuery.eq('resolved', resolved);
      }
      
      if (startDate) {
        dbQuery = dbQuery.gte('created_at', startDate);
      }
      
      if (endDate) {
        dbQuery = dbQuery.lte('created_at', endDate);
      }
      
      const { data: errors, error, count } = await dbQuery;
      
      if (error) throw error;
      
      return {
        errors: errors || [],
        total: count || 0,
        limit,
        offset,
        has_more: count > offset + limit
      };
    } catch (error) {
      LoggingService.error('Failed to search errors', error);
      throw error;
    }
  }

  /**
   * Export errors to CSV
   * @param {Object} criteria - Export criteria
   * @returns {Promise<string>} CSV data
   */
  static async exportErrors(criteria = {}) {
    try {
      const searchResults = await this.searchErrors({
        ...criteria,
        limit: 10000 // Large limit for export
      });
      
      const headers = [
        'Error ID',
        'Name',
        'Message',
        'Severity',
        'Environment',
        'Resolved',
        'Created At',
        'Resolved At',
        'Resolved By'
      ];
      
      const csvRows = [headers.join(',')];
      
      searchResults.errors.forEach(error => {
        const row = [
          error.error_id,
          error.name,
          `"${error.message.replace(/"/g, '""')}"`,
          error.severity,
          error.environment,
          error.resolved ? 'Yes' : 'No',
          error.created_at,
          error.resolved_at || '',
          error.resolved_by || ''
        ];
        csvRows.push(row.join(','));
      });
      
      return csvRows.join('\n');
    } catch (error) {
      LoggingService.error('Failed to export errors', error);
      throw error;
    }
  }
}

export { ErrorTrackingService };