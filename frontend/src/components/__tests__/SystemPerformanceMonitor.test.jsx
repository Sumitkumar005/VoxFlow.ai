import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SystemPerformanceMonitor from '../SystemPerformanceMonitor';
import { adminAPI } from '../../utils/api';

// Mock the API
jest.mock('../../utils/api', () => ({
  adminAPI: {
    getSystemHealth: jest.fn(),
  }
}));

// Mock recharts components
jest.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
}));

describe('SystemPerformanceMonitor Component', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    adminAPI.getSystemHealth.mockResolvedValue({ data: { data: mockHealthyData } });
  });

  describe('Component Rendering', () => {
    it('should render loading spinner initially', () => {
      render(<SystemPerformanceMonitor />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should render system performance monitor header', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('System Performance Monitor')).toBeInTheDocument();
      });
    });

    it('should display system status badge', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Healthy')).toBeInTheDocument();
      });
    });

    it('should render auto refresh toggle', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Auto Refresh:')).toBeInTheDocument();
      });
    });

    it('should render refresh interval selector', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('30s')).toBeInTheDocument();
      });
    });

    it('should render refresh now button', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh Now')).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should load system health data on mount', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(adminAPI.getSystemHealth).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle API errors gracefully', async () => {
      adminAPI.getSystemHealth.mockRejectedValue(new Error('API Error'));
      
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Error Loading Performance Data')).toBeInTheDocument();
        expect(screen.getByText('Failed to load system performance data')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      adminAPI.getSystemHealth.mockRejectedValue(new Error('API Error'));
      
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should retry data loading when retry button is clicked', async () => {
      adminAPI.getSystemHealth.mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({ data: { data: mockHealthyData } });
      
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Error Loading Performance Data')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('System Performance Monitor')).toBeInTheDocument();
        expect(screen.queryByText('Error Loading Performance Data')).not.toBeInTheDocument();
      });
    });
  });

  describe('Real-time Metrics', () => {
    it('should display response time metric', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Response Time')).toBeInTheDocument();
        expect(screen.getByText('2.3s')).toBeInTheDocument();
      });
    });

    it('should display success rate metric', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Success Rate')).toBeInTheDocument();
        expect(screen.getByText('95.5%')).toBeInTheDocument();
      });
    });

    it('should display active calls metric', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Active Calls')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('150 total today')).toBeInTheDocument();
      });
    });

    it('should display error rate metric', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Error Rate')).toBeInTheDocument();
        expect(screen.getByText('4.5%')).toBeInTheDocument();
      });
    });

    it('should show response time status indicators', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Excellent')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Charts', () => {
    it('should render response time trend chart', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Response Time Trend')).toBeInTheDocument();
        expect(screen.getAllByTestId('line-chart')).toHaveLength(1);
      });
    });

    it('should render success rate trend chart', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Success Rate Trend')).toBeInTheDocument();
        expect(screen.getAllByTestId('area-chart')).toHaveLength(1);
      });
    });

    it('should render responsive containers for charts', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        const responsiveContainers = screen.getAllByTestId('responsive-container');
        expect(responsiveContainers.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('System Components Status', () => {
    it('should display database status', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Database')).toBeInTheDocument();
        expect(screen.getByText('Connection')).toBeInTheDocument();
        expect(screen.getByText('connected')).toBeInTheDocument();
      });
    });

    it('should display API services status', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('API Services')).toBeInTheDocument();
        expect(screen.getByText('Groq')).toBeInTheDocument();
        expect(screen.getByText('Deepgram')).toBeInTheDocument();
        expect(screen.getByText('Twilio')).toBeInTheDocument();
        expect(screen.getByText('45 configured')).toBeInTheDocument();
        expect(screen.getByText('40 configured')).toBeInTheDocument();
        expect(screen.getByText('35 configured')).toBeInTheDocument();
      });
    });

    it('should display system resources status', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('System Resources')).toBeInTheDocument();
        expect(screen.getByText('CPU Usage')).toBeInTheDocument();
        expect(screen.getByText('Memory')).toBeInTheDocument();
        expect(screen.getByText('Network')).toBeInTheDocument();
        expect(screen.getAllByText('Normal')).toHaveLength(2);
        expect(screen.getByText('Stable')).toBeInTheDocument();
      });
    });
  });

  describe('Auto Refresh Functionality', () => {
    it('should toggle auto refresh when clicked', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        const toggleButton = screen.getByRole('button', { name: /auto refresh/i });
        expect(toggleButton).toBeInTheDocument();
      });

      // The toggle should be on by default
      const toggleButton = screen.getByRole('button', { name: /auto refresh/i });
      expect(toggleButton).toHaveClass('bg-red-600');

      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveClass('bg-gray-200');
    });

    it('should change refresh interval when selected', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        const intervalSelector = screen.getByDisplayValue('30s');
        expect(intervalSelector).toBeInTheDocument();
      });

      const intervalSelector = screen.getByDisplayValue('30s');
      fireEvent.change(intervalSelector, { target: { value: '60000' } });
      
      expect(intervalSelector.value).toBe('60000');
    });

    it('should refresh data when refresh now button is clicked', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(adminAPI.getSystemHealth).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByText('Refresh Now');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(adminAPI.getSystemHealth).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance Alerts', () => {
    it('should show performance alerts for high error rate', async () => {
      adminAPI.getSystemHealth.mockResolvedValue({ data: { data: mockWarningData } });
      
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Performance Alerts')).toBeInTheDocument();
        expect(screen.getByText(/High error rate detected: 12.5%/)).toBeInTheDocument();
      });
    });

    it('should show performance alerts for slow response times', async () => {
      const slowResponseData = {
        ...mockHealthyData,
        metrics: {
          ...mockHealthyData.metrics,
          avg_response_time: 12.5
        }
      };
      
      adminAPI.getSystemHealth.mockResolvedValue({ data: { data: slowResponseData } });
      
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('Performance Alerts')).toBeInTheDocument();
        expect(screen.getByText(/Slow response times: 12.5s average/)).toBeInTheDocument();
      });
    });

    it('should not show alerts for healthy system', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.queryByText('Performance Alerts')).not.toBeInTheDocument();
      });
    });
  });

  describe('Status Colors and Indicators', () => {
    it('should apply correct colors for healthy status', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        const statusBadge = screen.getByText('Healthy').closest('div');
        expect(statusBadge).toHaveClass('text-green-600', 'bg-green-50', 'border-green-200');
      });
    });

    it('should apply correct colors for warning status', async () => {
      adminAPI.getSystemHealth.mockResolvedValue({ data: { data: mockWarningData } });
      
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        const statusBadge = screen.getByText('Warning').closest('div');
        expect(statusBadge).toHaveClass('text-yellow-600', 'bg-yellow-50', 'border-yellow-200');
      });
    });

    it('should show correct response time status colors', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        // Response time is 2.3s, should be excellent (green)
        const statusDot = screen.getByText('Excellent').previousElementSibling;
        expect(statusDot).toHaveClass('bg-green-500');
      });
    });
  });

  describe('Data Formatting', () => {
    it('should format response time correctly', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('2.3s')).toBeInTheDocument();
      });
    });

    it('should format percentages correctly', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('95.5%')).toBeInTheDocument();
        expect(screen.getByText('4.5%')).toBeInTheDocument();
      });
    });

    it('should format dates correctly', async () => {
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        // Check that the date is formatted as a locale string
        expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing data gracefully', async () => {
      const incompleteData = {
        system_status: 'healthy',
        metrics: {
          success_rate: 95.5
          // Missing other metrics
        },
        api_keys: {
          by_provider: {}
        },
        database: {
          status: 'connected'
        }
      };

      adminAPI.getSystemHealth.mockResolvedValue({ data: { data: incompleteData } });

      expect(() => {
        render(<SystemPerformanceMonitor />);
      }).not.toThrow();
    });

    it('should handle zero values correctly', async () => {
      const zeroData = {
        ...mockHealthyData,
        metrics: {
          success_rate: 0,
          error_rate: 0,
          avg_response_time: 0,
          total_runs_24h: 0,
          failed_runs_24h: 0,
          in_progress_runs: 0
        }
      };

      adminAPI.getSystemHealth.mockResolvedValue({ data: { data: zeroData } });
      
      render(<SystemPerformanceMonitor />);
      
      await waitFor(() => {
        expect(screen.getByText('0.0%')).toBeInTheDocument(); // Success rate
        expect(screen.getByText('0.0s')).toBeInTheDocument(); // Response time
        expect(screen.getByText('0 total today')).toBeInTheDocument(); // Total runs
      });
    });
  });
});