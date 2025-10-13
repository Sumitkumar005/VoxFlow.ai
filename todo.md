# VoxFlow Frontend Testing Todo

## ✅ Step 1: Verify Everything is Running
- [ ] Check Terminal 1 - Backend: `cd backend && npm run dev` (Should show: VoxFlow API Server Running on Port: 5000)
- [ ] Check Terminal 2 - Worker: `cd backend && npm run worker` (Should show: Campaign worker started and listening for jobs...)
- [ ] Check Terminal 3 - Frontend: `cd frontend && npm run dev` (Should show: Local: http://localhost:5173)

## 🎯 TEST 1: LOGIN
- [ ] Open Browser to http://localhost:5173 (Should see VoxFlow Login Page)
- [ ] Login with Email: admin@voxflow.com, Password: admin123, Click "Login" (Should redirect to /agents page showing "Your Workflows")

## 🎯 TEST 2: CREATE YOUR FIRST AGENT
- [ ] On Agents page, click "Create Agent" button (top right)
- [ ] Fill form: Agent Type: OUTBOUND, Agent Name: Sales Qualification Agent, Use case: Lead Qualification, Description: You are a friendly sales representative calling to qualify leads for our B2B SaaS product. Ask about their company size, budget, and current pain points. Be conversational and professional. If they're interested, schedule a demo.
- [ ] Click "Create VOICE AI AGENT" (Should show loading, then redirect to agent details page)

## 🎯 TEST 3: TEST WEB CALL
- [ ] From Agent Details Page, click "Web Call" card
- [ ] Click the big GREEN PHONE ICON button (Allow microphone permission)
- [ ] Verify: Button turns RED, "Call in Progress", greeting message appears
- [ ] Click RED PHONE ICON to end call, wait for "Processing your call..."
- [ ] Should redirect to "Agent Run Completed" page with "Preview Transcript" and "Preview Recording" buttons
- [ ] Click "Preview Transcript" button (Modal opens with conversation transcript)

## 🎯 TEST 4: VIEW RUN HISTORY
- [ ] Click "Back to Agent" button
- [ ] Click "View Run History" card (Table shows completed run with Run ID, Status, Duration, Tokens, etc.)

## 🎯 TEST 5: CONFIGURE SERVICES
- [ ] Click Settings (gear) icon in navbar (Go to Service Configuration page)
- [ ] Verify default settings: LLM Provider: Groq, Model: llama-3.3-70b-versatile, TTS: Deepgram, STT: Deepgram
- [ ] Click "Save Configuration"

## 🎯 TEST 6: USAGE DASHBOARD
- [ ] Click "Usage" in navbar (Shows 3 cards: Total Tokens, Total Duration, Total Runs - Total Runs should be 1)
- [ ] Below shows "Usage History" table with your call

## 🎯 TEST 7: REPORTS
- [ ] Click "Reports" in navbar (Shows today's date, date picker, two charts, stats with Total Agent Runs)

## 🎯 TEST 8: CREATE CAMPAIGN (Advanced)
- [ ] Click "Campaigns" in navbar
- [ ] Click "Create Campaign" button
- [ ] Create contacts.csv with content: phone_number,first_name,last_name\n+15551234567,John,Doe\n+15559876543,Jane,Smith\n+15555555555,Bob,Johnson
- [ ] Fill form: Campaign Name: Test Campaign, Select Agent: your agent, Upload CSV: contacts.csv
- [ ] Click "Create Campaign" (Campaign created, shows details page)
- [ ] Note: To start campaign, configure Twilio in Telephony Config

## 📊 TESTING CHECKLIST
- [ ] Login successful
- [ ] Create Agent works
- [ ] Web Call starts
- [ ] Call ends and shows transcript
- [ ] Run history shows the call
- [ ] Service Config page loads
- [ ] Usage dashboard shows data
- [ ] Reports page loads
- [ ] Campaign creation works
- [ ] Navigation between pages works

## 🐛 COMMON ISSUES & FIXES (If needed)
- [ ] If "Network Error" or "Failed to fetch": Check backend with `curl http://localhost:5000`
- [ ] If "401 Unauthorized": Logout and login again
- [ ] If components not loading: `cd frontend && npm install && npm run dev`
- [ ] If blank page after login: Check browser console (F12) for JS errors
