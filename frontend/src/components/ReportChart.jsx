import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ReportChart = ({ data }) => {
  if (!data || !data.hourly_stats) {
    return (
      <div className="text-center py-12 text-gray-500">
        No data available for the selected date
      </div>
    );
  }

  const chartData = data.hourly_stats.map(stat => ({
    hour: `${stat.hour}:00`,
    calls: stat.total_calls,
    successful: stat.successful_calls,
    failed: stat.failed_calls,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="hour" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="calls" fill="#8b5cf6" name="Total Calls" />
        <Bar dataKey="successful" fill="#10b981" name="Successful" />
        <Bar dataKey="failed" fill="#ef4444" name="Failed" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ReportChart;
