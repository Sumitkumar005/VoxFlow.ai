import { Code, BookOpen, Zap } from 'lucide-react';

const Home = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to VoxFlow Developer Hub
        </h1>
        <p className="text-xl text-gray-600">
          Build powerful voice AI applications with our API
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card text-center">
          <Code className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">API Documentation</h3>
          <p className="text-gray-600 mb-4">
            Complete API reference and integration guides
          </p>
          <a
            href="https://docs.claude.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            View Docs →
          </a>
        </div>

        <div className="card text-center">
          <BookOpen className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Start</h3>
          <p className="text-gray-600 mb-4">
            Get started with VoxFlow in minutes
          </p>
          <button className="text-green-600 hover:text-green-800">
            Get Started →
          </button>
        </div>

        <div className="card text-center">
          <Zap className="h-12 w-12 text-purple-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">API Keys</h3>
          <p className="text-gray-600 mb-4">
            Manage your API keys and access tokens
          </p>
          <button className="text-purple-600 hover:text-purple-800">
            Manage Keys →
          </button>
        </div>
      </div>

      <div className="card mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Example</h2>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
{`// Create a voice agent
const agent = await voxflow.agents.create({
  name: "Sales Agent",
  type: "OUTBOUND",
  description: "Friendly sales assistant"
});

// Start a call
const call = await voxflow.calls.start({
  agent_id: agent.id,
  phone_number: "+15551234567"
});`}
        </pre>
      </div>
    </div>
  );
};

export default Home;