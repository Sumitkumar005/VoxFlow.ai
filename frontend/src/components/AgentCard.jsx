import { Eye, Trash2, Calendar, Activity } from 'lucide-react';
import { formatDate } from '../utils/formatters';

const AgentCard = ({ agent, onView, onDelete }) => {
  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
          <div className="flex items-center space-x-2 mt-1">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              agent.type === 'OUTBOUND' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {agent.type}
            </span>
            <span className="text-sm text-gray-500">{agent.use_case}</span>
          </div>
        </div>
        <button
          onClick={() => onDelete(agent)}
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        {agent.description}
      </p>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center space-x-1">
            <Calendar size={16} />
            <span>{formatDate(agent.created_at)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Activity size={16} />
            <span>{agent.total_runs || 0} runs</span>
          </div>
        </div>
        <button
          onClick={() => onView(agent)}
          className="btn-primary text-sm"
        >
          <Eye size={16} className="inline mr-1" />
          View
        </button>
      </div>
    </div>
  );
};

export default AgentCard;