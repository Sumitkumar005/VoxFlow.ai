import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Analytics from '../Analytics';
import { adminAPI } from '../../../utils/api';

// Mock the API
jest.mock('../../../utils/api', () => ({
  adminAPI: {
    getPlatformOverview: jest.fn(),
    getUserGrowthAnalytics: jest.fn(),
    getUsageAnalytics: jest.fn(),
    getRevenueAnalytics: jest.fn(),
    getSystemHealth: jest.fn(),
    exportAnalyticsData: jest.fn(),
  }
}));

// Mock recharts components
jest.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock LoadingSpinner
jest.mock('../../../components/LoadingSpinner', () => {
  return function LoadingSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

// Mock PerformanceTab
jest.mock('../../../components/PerformanceTab', () => {
  return function PerformanceTab({ data }) {
    return <div data-testid="performance-tab">Performance Tab - {data ? 'with data' : 'no data'}</div>;
  };
});

describe('Analytics Component', () => {
  const mockOverviewData = {
    users: {
      total: 150,
      active: 120,
      by_tier: { free: 100, pro: 40, enterprise: 10 }
    },
    agents: { total: 300 },
    runs: {
      total: 1500,
      completed: 1350,
      failed: 100,
      in_progress: 50,
      total_duration: 36000,
      total_tokens: 2500000
    },
    growth: {
      users: 15.5,
      agents: 25.2,
      runs: 30.1
    }
  };

  const mockUserGrowthData = {
    growth_data: [
      {
        date: '2024-01-01',
        new_users: 10,
        cumulative: 100,
        free: 8,
        pro: 2,
        enterprise: 0
      },
      {
        date: '2024-01-02',
        new_users: 15,
        cumulative: 115,
        free: 12,
        pro: 2,
        enterprise: 1
      }
    ],
    summary: {
      total_new_users: 25,
      average_daily: 12.5,
      by_tier: { free: 20, pro: 4, enterprise: 1 }
    }
  };

  const mockUsageData = {
    platform_totals: {
      total_tokens: 2500000,
      total_calls: 1500,
      total_duration: 36000,
      total_costs: 125.50
    },
    daily_trends: [
      {
        date: '2024-01-01',
        tokens: 50000,
        calls: 30,
        duration: 1800,
        costs: 2.50
      },
      {
        date: '2024-01-02',
        tokens: 75000,
        calls: 45,
        duration: 2700,
        costs: 3.75
      }
    ],
    top_users: [
      {
        email: 'user1@example.com',
        subscription_tier: 'pro',
        total_tokens: 100000,
        total_calls: 50,
        total_duration: 3000,
        total_costs: 5.00
      }
    ]
  };

  const mockRevenueData = {
    current_monthly_revenue: 2500,
    projected_annual_revenue: 30000,
    revenue_by_plan: {
      free: { revenue: 0, count: 100 },
      pro: { revenue: 1160, count: 40 },
      enterprise: { revenue: 1340, count: 10 }
    },
    monthly_trends: [
      {
        month: '2024-01',
        revenue: 2000,
        new_subscriptions: 15,
        cumulative_revenue: 2000
      },
      {
        month: '2024-02',
        revenue: 2500,
        new_subscriptions: 20,
        cumulative_revenue: 4500
      }
    ]
  };

  const mockSystemHealthData = {
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

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default successful API responses
    adminAPI.getPlatformOverview.mockResolvedValue({ data: { data: mockOverviewData } });
    adminAPI.getUserGrowthAnalytics.mockResolvedValue({ data: { data: mockUserGrowthData } });
    adminAPI.getUsageAnalytics.mockResolvedValue({ data: { data: mockUsageData } });
    adminAPI.getRevenueAnalytics.mockResolvedValue({ data: { data: mockRevenueData } });
    adminAPI.getSystemHealth.mockResolvedValue({ data: { data: mockSystemHealthData } });
  });

  describe('Component Rendering', () => {
    it('should render loading spinner initially', () => {
      render(<Analytics />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should render analytics header and navigation', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('Platform Analytics')).toBeInTheDocument();
        expect(screen.getByText('Comprehensive insights into platform performance and growth')).toBeInTheDocument();
      });
    });

    it('should render all tab navigation items', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('User Growth')).toBeInTheDocument();
        expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
        expect(screen.getByText('Revenue')).toBeInTheDocument();
        expect(screen.getByText('Performance')).toBeInTheDocument();
      });
    });

    it('should render period selector with default value', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const periodSelector = screen.getByDisplayValue('30 Days');
        expect(periodSelector).toBeInTheDocument();
      });
    });

    it('should render export button', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should load all analytics data on mount', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(adminAPI.getPlatformOverview).toHaveBeenCalledTimes(1);
        expect(adminAPI.getUserGrowthAnalytics).toHaveBeenCalledWith({ period: '30d' });
        expect(adminAPI.getUsageAnalytics).toHaveBeenCalledWith({ period: 'current_month' });
        expect(adminAPI.getRevenueAnalytics).toHaveBeenCalledTimes(1);
        expect(adminAPI.getSystemHealth).toHaveBeenCalledTimes(1);
      });
    });

    it('should reload data when period changes', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(adminAPI.getUserGrowthAnalytics).toHaveBeenCalledWith({ period: '30d' });
      });

      // Change period
      const periodSelector = screen.getByDisplayValue('30 Days');
      fireEvent.change(periodSelector, { target: { value: '7d' } });

      await waitFor(() => {
        expect(adminAPI.getUserGrowthAnalytics).toHaveBeenCalledWith({ period: '7d' });
      });
    });

    it('should handle API errors gracefully', async () => {
      adminAPI.getPlatformOverview.mockRejectedValue(new Error('API Error'));
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('Error Loading Analytics')).toBeInTheDocument();
        expect(screen.getByText('Failed to load analytics data. Please try again.')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      adminAPI.getPlatformOverview.mockRejectedValue(new Error('API Error'));
      
      render(<Analytics />);
      
      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        expect(retryButton).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should show overview tab by default', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        // Check that overview content is visible
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument(); // Total users count
      });
    });

    it('should switch to user growth tab when clicked', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const growthTab = screen.getByText('User Growth');
        fireEvent.click(growthTab);
      });

      await waitFor(() => {
        expect(screen.getByText('New Users')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument(); // Total new users
      });
    });

    it('should switch to usage analytics tab when clicked', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const usageTab = screen.getByText('Usage Analytics');
        fireEvent.click(usageTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Total Tokens')).toBeInTheDocument();
        expect(screen.getByText('2.5M')).toBeInTheDocument(); // Total tokens formatted
      });
    });

    it('should switch to revenue tab when clicked', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const revenueTab = screen.getByText('Revenue');
        fireEvent.click(revenueTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
        expect(screen.getByText('$2,500')).toBeInTheDocument(); // Monthly revenue
      });
    });

    it('should switch to performance tab when clicked', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const performanceTab = screen.getByText('Performance');
        fireEvent.click(performanceTab);
      });

      await waitFor(() => {
        expect(screen.getByTestId('performance-tab')).toBeInTheDocument();
      });
    });
  });

  describe('Overview Tab', () => {
    it('should display platform metrics correctly', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText('Active Users')).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
        expect(screen.getByText('Total Agents')).toBeInTheDocument();
        expect(screen.getByText('300')).toBeInTheDocument();
        expect(screen.getByText('Total Runs')).toBeInTheDocument();
        expect(screen.getByText('1,500')).toBeInTheDocument();
      });
    });

    it('should display growth percentages', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('15.5%')).toBeInTheDocument(); // User growth
        expect(screen.getByText('25.2%')).toBeInTheDocument(); // Agent growth
        expect(screen.getByText('30.1%')).toBeInTheDocument(); // Runs growth
      });
    });

    it('should render charts', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getAllByTestId('pie-chart')).toHaveLength(1);
        expect(screen.getAllByTestId('bar-chart')).toHaveLength(1);
      });
    });

    it('should display platform summary statistics', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Hours of Calls')).toBeInTheDocument();
        expect(screen.getByText('Total Tokens Processed')).toBeInTheDocument();
        expect(screen.getByText('Success Rate')).toBeInTheDocument();
      });
    });
  });

  describe('User Growth Tab', () => {
    it('should display growth summary cards', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const growthTab = screen.getByText('User Growth');
        fireEvent.click(growthTab);
      });

      await waitFor(() => {
        expect(screen.getByText('New Users')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
        expect(screen.getByText('Daily Average')).toBeInTheDocument();
        expect(screen.getByText('12.5')).toBeInTheDocument();
      });
    });

    it('should render growth trend chart', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const growthTab = screen.getByText('User Growth');
        fireEvent.click(growthTab);
      });

      await waitFor(() => {
        expect(screen.getByText('User Growth Trend')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('should render subscription tier growth chart', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const growthTab = screen.getByText('User Growth');
        fireEvent.click(growthTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Growth by Subscription Tier')).toBeInTheDocument();
        expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Usage Analytics Tab', () => {
    it('should display platform usage totals', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const usageTab = screen.getByText('Usage Analytics');
        fireEvent.click(usageTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Total Tokens')).toBeInTheDocument();
        expect(screen.getByText('2.5M')).toBeInTheDocument();
        expect(screen.getByText('Total Calls')).toBeInTheDocument();
        expect(screen.getByText('1,500')).toBeInTheDocument();
        expect(screen.getByText('Total Duration')).toBeInTheDocument();
        expect(screen.getByText('10h')).toBeInTheDocument();
        expect(screen.getByText('Total Costs')).toBeInTheDocument();
        expect(screen.getByText('$125.50')).toBeInTheDocument();
      });
    });

    it('should render usage trend charts', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const usageTab = screen.getByText('Usage Analytics');
        fireEvent.click(usageTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Token Usage Trend')).toBeInTheDocument();
        expect(screen.getByText('Call Volume Trend')).toBeInTheDocument();
        expect(screen.getAllByTestId('area-chart')).toHaveLength(1);
        expect(screen.getAllByTestId('bar-chart')).toHaveLength(1);
      });
    });

    it('should display top users table', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const usageTab = screen.getByText('Usage Analytics');
        fireEvent.click(usageTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Top Users by Usage')).toBeInTheDocument();
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
        expect(screen.getByText('pro')).toBeInTheDocument();
      });
    });
  });

  describe('Data Export', () => {
    it('should call export API when export button is clicked', async () => {
      // Mock successful export
      adminAPI.exportAnalyticsData.mockResolvedValue({ data: 'csv,data\n1,2\n' });
      
      // Mock URL.createObjectURL and related functions
      global.URL.createObjectURL = jest.fn(() => 'mock-url');
      global.URL.revokeObjectURL = jest.fn();
      
      // Mock document.createElement and related functions
      const mockLink = {
        href: '',
        setAttribute: jest.fn(),
        click: jest.fn(),
        remove: jest.fn()
      };
      document.createElement = jest.fn(() => mockLink);
      document.body.appendChild = jest.fn();

      render(<Analytics />);
      
      await waitFor(() => {
        const exportButton = screen.getByText('Export');
        fireEvent.mouseEnter(exportButton.parentElement);
      });

      // Click on overview export option
      const overviewExport = screen.getByText('Platform Overview');
      fireEvent.click(overviewExport);

      await waitFor(() => {
        expect(adminAPI.exportAnalyticsData).toHaveBeenCalledWith('overview', { period: '30d' });
      });
    });

    it('should handle export errors gracefully', async () => {
      adminAPI.exportAnalyticsData.mockRejectedValue(new Error('Export failed'));
      
      // Mock alert
      global.alert = jest.fn();

      render(<Analytics />);
      
      await waitFor(() => {
        const exportButton = screen.getByText('Export');
        fireEvent.mouseEnter(exportButton.parentElement);
      });

      const overviewExport = screen.getByText('Platform Overview');
      fireEvent.click(overviewExport);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Failed to export data. Please try again.');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render responsive containers for charts', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        const responsiveContainers = screen.getAllByTestId('responsive-container');
        expect(responsiveContainers.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error state when data loading fails', async () => {
      adminAPI.getPlatformOverview.mockRejectedValue(new Error('Network error'));
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('Error Loading Analytics')).toBeInTheDocument();
        expect(screen.getByText('Failed to load analytics data. Please try again.')).toBeInTheDocument();
      });
    });

    it('should retry data loading when retry button is clicked', async () => {
      adminAPI.getPlatformOverview.mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { data: mockOverviewData } });
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('Error Loading Analytics')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Platform Analytics')).toBeInTheDocument();
        expect(screen.queryByText('Error Loading Analytics')).not.toBeInTheDocument();
      });
    });
  });
});