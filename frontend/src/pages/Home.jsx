import { useState, useEffect } from 'react';
import { Code, BookOpen, Zap, ArrowRight, Sparkles } from 'lucide-react';

const Home = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl mb-6 shadow-lg shadow-purple-500/30 hover:scale-110 transition-transform duration-300">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent mb-4 animate-fade-in">
            Welcome to VoxFlow Developer Hub
          </h1>
          <p className="text-2xl text-gray-600 animate-fade-in-delay">
            Build powerful voice AI applications with our API
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {[
            {
              icon: Code,
              title: 'API Documentation',
              description: 'Complete API reference and integration guides',
              link: 'View Docs',
              href: 'https://docs.claude.com',
              delay: '0ms'
            },
            {
              icon: BookOpen,
              title: 'Quick Start',
              description: 'Get started with VoxFlow in minutes',
              link: 'Get Started',
              delay: '100ms'
            },
            {
              icon: Zap,
              title: 'API Keys',
              description: 'Manage your API keys and access tokens',
              link: 'Manage Keys',
              delay: '200ms'
            }
          ].map((card, index) => (
            <div
              key={index}
              className={`group bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-8 text-center hover:shadow-2xl hover:scale-105 hover:border-purple-300 transition-all duration-500 cursor-pointer ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: card.delay }}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <card.icon className="h-8 w-8 text-purple-600 group-hover:text-purple-700 transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">
                {card.title}
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                {card.description}
              </p>
              {card.href ? (
                <a
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-800 font-semibold transition-all duration-300 group-hover:translate-x-2"
                >
                  <span>{card.link}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              ) : (
                <button className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-800 font-semibold transition-all duration-300 group-hover:translate-x-2">
                  <span>{card.link}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className={`bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 hover:shadow-2xl transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '300ms' }}>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
              <Code className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Quick Example</h2>
          </div>
          <div className="relative group">
            <pre className="bg-gradient-to-br from-gray-900 to-gray-800 text-green-400 p-6 rounded-xl overflow-x-auto shadow-inner border border-gray-700 hover:border-purple-500 transition-all duration-300">
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
            <button className="absolute top-4 right-4 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 hover:bg-purple-700 transition-all duration-300 hover:scale-105">
              Copy Code
            </button>
          </div>
        </div>

        {/* Stats Section */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '400ms' }}>
          {[
            { label: 'API Calls', value: '1M+', color: 'from-blue-500 to-blue-600' },
            { label: 'Active Agents', value: '500+', color: 'from-purple-500 to-purple-600' },
            { label: 'Uptime', value: '99.9%', color: 'from-green-500 to-green-600' }
          ].map((stat, index) => (
            <div key={index} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 text-center hover:shadow-xl hover:scale-105 transition-all duration-300">
              <div className={`text-4xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-2`}>
                {stat.value}
              </div>
              <div className="text-gray-600 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;