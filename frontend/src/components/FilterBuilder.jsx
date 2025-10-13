import { useState } from 'react';
import { Filter, X } from 'lucide-react';

const FilterBuilder = ({ onApplyFilters }) => {
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    setShowFilters(false);
  };

  const handleClear = () => {
    setFilters({});
    onApplyFilters({});
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="btn-secondary flex items-center space-x-2"
      >
        <Filter size={18} />
        <span>Filters</span>
      </button>

      {showFilters && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border p-4 z-10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Filter Options</h3>
            <button onClick={() => setShowFilters(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                className="input-field"
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                value={filters.date_from || ''}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                className="input-field"
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                value={filters.date_to || ''}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Disposition
              </label>
              <select
                className="input-field"
                onChange={(e) => handleFilterChange('disposition', e.target.value)}
                value={filters.disposition || ''}
              >
                <option value="">All</option>
                <option value="user_hangup">User Hangup</option>
                <option value="completed">Completed</option>
                <option value="user_idle_max_duration_exceeded">User Idle</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Duration (seconds)
              </label>
              <input
                type="number"
                className="input-field"
                onChange={(e) => handleFilterChange('min_duration', e.target.value)}
                value={filters.min_duration || ''}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Duration (seconds)
              </label>
              <input
                type="number"
                className="input-field"
                onChange={(e) => handleFilterChange('max_duration', e.target.value)}
                value={filters.max_duration || ''}
                placeholder="999"
              />
            </div>
          </div>

          <div className="flex space-x-2 mt-4">
            <button onClick={handleClear} className="btn-secondary flex-1">
              Clear
            </button>
            <button onClick={handleApply} className="btn-primary flex-1">
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBuilder;