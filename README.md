# VoxFlow.ai

A comprehensive AI-powered voice calling platform for automated customer interactions.

## Features

- AI-powered voice agents
- Campaign management
- Real-time call monitoring
- Recording and transcription
- Analytics and reporting
- WebRTC integration

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: Supabase
- **AI Services**: Groq, Deepgram
- **Telephony**: Twilio/

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account
- Twilio account (for telephony features)

### Installation

1. Clone the repository
```bash
git clone https://github.com/Sumitkumar005/VoxFlow.ai.git
cd VoxFlow.ai
```

2. Install dependencies for backend
```bash
cd backend
npm install
```

3. Install dependencies for frontend
```bash
cd ../frontend
npm install
```

4. Set up environment variables
   - Copy `.env.example` to `.env` in both backend and frontend directories
   - Fill in your API keys and configuration

5. Start the development servers
```bash
# Backend
cd backend
npm run dev

# Frontend (in a new terminal)
cd frontend
npm run dev
```

## Project Structure

```
VoxFlow.ai/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── uploads/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   └── utils/
│   └── package.json
├── supabase/
│   └── migrations/
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
