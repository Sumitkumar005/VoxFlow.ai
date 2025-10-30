import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PerformanceTab from '../PerformanceTab';

// Mock LoadingSpinner
jest.mock('../LoadingSpinner', () => {
  return function LoadingSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

describe('PerformanceTab Component', () => {
  const mockHealthyData = {
    system_status: 'healthy',
    metrics: {
      success_rate: 95.5,
      error_rate: 4.5,
      avg_response_time: 2.3,
      total_runs_24h: 150,
      failed_runs_24h: 7,
      in_progress_runs: 3
    },
    api_keys: {
      total_configured: 85,
      by_provider: {
        groq: 45,
        deepgram: 40,
        twilio: 35
      }
    },
    database: {
      status: 'connected',
      last_check: '2024-01-15T10:30:00Z'
    }
  };

  const mockWarningData = {
    ...mockHealthyData,
    system_status: 'warning',
    metrics: {
      ...mockHealthyData.metrics,
      error_rate: 12.5,
      avg_response_time: 8.7
    }
  };

  const mockCriticalData = {
    ...mockHealthyData,
    system_status: 'critical',
    metrics: {
      ...mockHealthyData.metrics,
      error_rate: 25.0,
      avg_response_time: 15.2
    },
    database: {
      status: 'disconnected',
      last_check: '2024-01-15T10:30:00Z'
    }
  };

  describe('Component Rendering', () => {
    it('should render loading spinner when no data provided', () => {
      render(<PerformanceTab data={null} />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should render system health overview with healthy status', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('System Health Overview')).toBeInTheDocument();
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('should render system health overview with warning status', () => {
      render(<PerformanceTab data={mockWarningData} />);
      
      expect(screen.getByText('System Health Overview')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('should render system health overview with critical status', () => {
      render(<PerformanceTab data={mockCriticalData} />);
      
      expect(screen.getByText('System Health Overview')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  describe('Performance Metrics', () => {
    it('should display success rate correctly', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('95.5%')).toBeInTheDocument();
    });

    it('should display error rate correctly', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Error Rate')).toBeInTheDocument();
      expect(screen.getByText('4.5%')).toBeInTheDocument();
    });

    it('should display average response time correctly', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
      expect(screen.getByText('2.3s')).toBeInTheDocument();
    });

    it('should display 24-hour runs correctly', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Runs (24h)')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('should render progress bars for success and error rates', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      const progressBars = screen.getAllByRole('progressbar', { hidden: true });
      expect(progressBars.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('API Key Configuration', () => {
    it('should display API key configuration section', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('API Key Configuration')).toBeInTheDocument();
    });

    it('should display all API providers', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Groq')).toBeInTheDocument();
      expect(screen.getByText('Deepgram')).toBeInTheDocument();
      expect(screen.getByText('Twilio')).toBeInTheDocument();
    });

    it('should display configured user counts for each provider', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('45 users configured')).toBeInTheDocument();
      expect(screen.getByText('40 users configured')).toBeInTheDocument();
      expect(screen.getByText('35 users configured')).toBeInTheDocument();
    });

    it('should display total configured keys', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Total Configured Keys')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('should show check icons for configured providers', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      // All providers have users configured, so should show check icons
      const checkIcons = screen.getAllByTestId('check-circle-icon');
      expect(checkIcons).toHaveLength(3);
    });

    it('should show X icons for unconfigured providers', () => {
      const dataWithUnconfiguredProvider = {
        ...mockHealthyData,
        api_keys: {
          ...mockHealthyData.api_keys,
          by_provider: {
            groq: 0,
            deepgram: 40,
            twilio: 35
          }
        }
      };

      render(<PerformanceTab data={dataWithUnconfiguredProvider} />);
      
      // Should have one X icon for unconfigured Groq
      expect(screen.getByText('0 users configured')).toBeInTheDocument();
    });
  });

  describe('Database Health', () => {
    it('should display database health section', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Database Health')).toBeInTheDocument();
    });

    it('should display connection status as connected', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Connection Status')).toBeInTheDocument();
      expect(screen.getByText('connected')).toBeInTheDocument();
    });

    it('should display connection status as disconnected', () => {
      render(<PerformanceTab data={mockCriticalData} />);
      
      expect(screen.getByText('Connection Status')).toBeInTheDocument();
      expect(screen.getByText('disconnected')).toBeInTheDocument();
    });

    it('should display last check timestamp', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Last Check')).toBeInTheDocument();
      // The exact format depends on locale, so just check that a date is displayed
      expect(screen.getByText(/2024/)).toBeInTheDocument();
    });
  });

  describe('24-Hour Activity Summary', () => {
    it('should display activity summary section', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('24-Hour Activity Summary')).toBeInTheDocument();
    });

    it('should display successful runs count', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Successful Runs')).toBeInTheDocument();
      // 150 total - 7 failed = 143 successful
      expect(screen.getByText('143')).toBeInTheDocument();
    });

    it('should display failed runs count', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Failed Runs')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('should display in progress runs count', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Performance Recommendations', () => {
    it('should display recommendations section', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('Performance Recommendations')).toBeInTheDocument();
    });

    it('should show optimal performance message for healthy system', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('System Performance Optimal')).toBeInTheDocument();
      expect(screen.getByText('All performance metrics are within acceptable ranges. System is operating efficiently.')).toBeInTheDocument();
    });

    it('should show high error rate warning', () => {
      render(<PerformanceTab data={mockWarningData} />);
      
      expect(screen.getByText('High Error Rate Detected')).toBeInTheDocument();
      expect(screen.getByText(/Error rate is 12.5%/)).toBeInTheDocument();
    });

    it('should show slow response time warning', () => {
      const slowResponseData = {
        ...mockHealthyData,
        metrics: {
          ...mockHealthyData.metrics,
          avg_response_time: 12.5
        }
      };

      render(<PerformanceTab data={slowResponseData} />);
      
      expect(screen.getByText('Slow Response Times')).toBeInTheDocument();
      expect(screen.getByText(/Average response time is 12.5s/)).toBeInTheDocument();
    });

    it('should show low API key configuration warning', () => {
      const lowConfigData = {
        ...mockHealthyData,
        api_keys: {
          ...mockHealthyData.api_keys,
          total_configured: 5
        }
      };

      render(<PerformanceTab data={lowConfigData} />);
      
      expect(screen.getByText('Low API Key Configuration')).toBeInTheDocument();
      expect(screen.getByText(/Only 5 users have configured API keys/)).toBeInTheDocument();
    });

    it('should show multiple warnings when applicable', () => {
      const multipleIssuesData = {
        ...mockHealthyData,
        metrics: {
          ...mockHealthyData.metrics,
          error_rate: 15.0,
          avg_response_time: 12.0
        },
        api_keys: {
          ...mockHealthyData.api_keys,
          total_configured: 5
        }
      };

      render(<PerformanceTab data={multipleIssuesData} />);
      
      expect(screen.getByText('High Error Rate Detected')).toBeInTheDocument();
      expect(screen.getByText('Slow Response Times')).toBeInTheDocument();
      expect(screen.getByText('Low API Key Configuration')).toBeInTheDocument();
    });
  });

  describe('Status Colors and Icons', () => {
    it('should apply correct colors for healthy status', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      const statusBadge = screen.getByText('Healthy').closest('div');
      expect(statusBadge).toHaveClass('text-green-600', 'bg-green-50', 'border-green-200');
    });

    it('should apply correct colors for warning status', () => {
      render(<PerformanceTab data={mockWarningData} />);
      
      const statusBadge = screen.getByText('Warning').closest('div');
      expect(statusBadge).toHaveClass('text-yellow-600', 'bg-yellow-50', 'border-yellow-200');
    });

    it('should apply correct colors for critical status', () => {
      render(<PerformanceTab data={mockCriticalData} />);
      
      const statusBadge = screen.getByText('Critical').closest('div');
      expect(statusBadge).toHaveClass('text-red-600', 'bg-red-50', 'border-red-200');
    });
  });

  describe('Data Formatting', () => {
    it('should format percentages correctly', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('95.5%')).toBeInTheDocument();
      expect(screen.getByText('4.5%')).toBeInTheDocument();
    });

    it('should format response time correctly', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      expect(screen.getByText('2.3s')).toBeInTheDocument();
    });

    it('should format dates correctly', () => {
      render(<PerformanceTab data={mockHealthyData} />);
      
      // Check that the date is formatted as a locale string
      const dateElement = screen.getByText(/1\/15\/2024/);
      expect(dateElement).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero values gracefully', () => {
      const zeroData = {
        ...mockHealthyData,
        metrics: {
          success_rate: 0,
          error_rate: 0,
          avg_response_time: 0,
          total_runs_24h: 0,
          failed_runs_24h: 0,
          in_progress_runs: 0
        },
        api_keys: {
          total_configured: 0,
          by_provider: {
            groq: 0,
            deepgram: 0,
            twilio: 0
          }
        }
      };

      render(<PerformanceTab data={zeroData} />);
      
      expect(screen.getByText('0.0%')).toBeInTheDocument(); // Success rate
      expect(screen.getByText('0.0s')).toBeInTheDocument(); // Response time
      expect(screen.getByText('0')).toBeInTheDocument(); // Various zero counts
    });

    it('should handle missing data properties gracefully', () => {
      const incompleteData = {
        system_status: 'healthy',
        metrics: {
          success_rate: 95.5
          // Missing other metrics
        },
        api_keys: {
          total_configured: 10
          // Missing by_provider
        },
        database: {
          status: 'connected'
          // Missing last_check
        }
      };

      // Should not crash when rendering with incomplete data
      expect(() => {
        render(<PerformanceTab data={incompleteData} />);
      }).not.toThrow();
    });
  });
});