# VoxFlow User Guide

Welcome to VoxFlow, the multi-tenant voice AI platform that enables you to create, manage, and deploy intelligent voice agents for various use cases.

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Registration](#user-registration)
3. [API Key Setup](#api-key-setup)
4. [Creating Your First Agent](#creating-your-first-agent)
5. [Managing Campaigns](#managing-campaigns)
6. [Usage Tracking & Limits](#usage-tracking--limits)
7. [Subscription Plans](#subscription-plans)
8. [Troubleshooting](#troubleshooting)

## Getting Started

VoxFlow is a comprehensive platform that allows you to:
- Create intelligent voice agents for various use cases
- Manage voice campaigns and outbound calls
- Track usage and costs across different AI providers
- Scale your voice AI operations with multi-tenant architecture

### System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Stable internet connection
- API keys from supported providers (Groq, Deepgram, Twilio)

## User Registration

### Step 1: Access the Registration Page

1. Navigate to the VoxFlow application
2. Click on "Sign Up" or "Register" button
3. You'll be redirected to the registration form

### Step 2: Fill Out Registration Information

**Required Information:**
- **Email Address**: Your business email address
- **Password**: Strong password (minimum 8 characters, including uppercase, lowercase, numbers, and special characters)
- **Organization Name**: Your company or organization name
- **Subscription Tier**: Choose from Free, Pro, or Enterprise

**Subscription Tiers:**
- **Free**: 3 agents, 10,000 tokens/month
- **Pro**: 10 agents, 100,000 tokens/month
- **Enterprise**: Unlimited agents, 1,000,000 tokens/month

### Step 3: Email Verification

1. Check your email for a verification link
2. Click the verification link to activate your account
3. You'll be redirected to the login page

### Step 4: First Login

1. Enter your email and password
2. Click "Sign In"
3. You'll be redirected to the dashboard

## API Key Setup

VoxFlow integrates with multiple AI service providers. You need to configure API keys for the services you want to use.

### Supported Providers

1. **Groq**: For fast language model inference
2. **Deepgram**: For speech-to-text and text-to-speech
3. **Twilio**: For telephony and SMS services

### Setting Up API Keys

#### Step 1: Access API Key Settings

1. Log in to your VoxFlow dashboard
2. Navigate to "Settings" → "API Keys"
3. You'll see a form with three provider sections

#### Step 2: Configure Groq API Key

1. **Get Your Groq API Key:**
   - Visit [Groq Console](https://console.groq.com)
   - Sign up or log in to your account
   - Navigate to API Keys section
   - Create a new API key
   - Copy the API key

2. **Add to VoxFlow:**
   - In the Groq section, paste your API key
   - Click "Save Groq API Key"
   - You'll see a green checkmark when successfully saved

#### Step 3: Configure Deepgram API Key

1. **Get Your Deepgram API Key:**
   - Visit [Deepgram Console](https://console.deepgram.com)
   - Sign up or log in to your account
   - Navigate to API Keys section
   - Create a new API key
   - Copy the API key

2. **Add to VoxFlow:**
   - In the Deepgram section, paste your API key
   - Click "Save Deepgram API Key"
   - You'll see a green checkmark when successfully saved

#### Step 4: Configure Twilio Credentials

1. **Get Your Twilio Credentials:**
   - Visit [Twilio Console](https://console.twilio.com)
   - Sign up or log in to your account
   - Find your Account SID and Auth Token
   - Copy both values

2. **Add to VoxFlow:**
   - In the Twilio section, enter your Account SID
   - Enter your Auth Token
   - Click "Save Twilio Credentials"
   - You'll see a green checkmark when successfully saved

### API Key Security

- **Encryption**: All API keys are encrypted using AES-256-GCM encryption
- **Access Control**: Only you can view and modify your API keys
- **Audit Logging**: All API key changes are logged for security
- **Best Practices**:
  - Never share your API keys
  - Rotate keys regularly
  - Monitor usage for unexpected activity

## Creating Your First Agent

### Step 1: Navigate to Agents

1. From the dashboard, click "Agents" in the sidebar
2. Click "Create New Agent" button

### Step 2: Configure Agent Settings

**Basic Information:**
- **Name**: Give your agent a descriptive name
- **Description**: Brief description of the agent's purpose
- **Use Case**: Select from predefined use cases or choose "Custom"

**Voice Configuration:**
- **Voice Provider**: Choose Deepgram or other supported providers
- **Voice Model**: Select the voice model for text-to-speech
- **Language**: Choose the primary language for the agent

**AI Configuration:**
- **Language Model**: Choose from available Groq models
- **System Prompt**: Define the agent's personality and behavior
- **Temperature**: Control creativity (0.0 = deterministic, 1.0 = creative)

### Step 3: Test Your Agent

1. Use the built-in testing interface
2. Send sample messages to verify responses
3. Adjust settings as needed
4. Save the agent when satisfied

### Step 4: Deploy Agent

1. Click "Deploy" to make the agent available for campaigns
2. Note the agent ID for API integration
3. Monitor performance in the dashboard

## Managing Campaigns

### Creating a Campaign

1. Navigate to "Campaigns" in the sidebar
2. Click "Create New Campaign"
3. Fill out campaign details:
   - **Name**: Campaign identifier
   - **Agent**: Select from your deployed agents
   - **Contact List**: Upload CSV or enter contacts manually
   - **Schedule**: Set timing and frequency
   - **Settings**: Configure retry logic and limits

### Campaign Monitoring

- **Real-time Status**: View active calls and completion rates
- **Analytics**: Track success rates, duration, and costs
- **Logs**: Review detailed call logs and transcripts
- **Reports**: Generate performance reports

### Contact Management

**CSV Upload Format:**
```csv
name,phone_number,email,custom_field1,custom_field2
John Doe,+1234567890,john@example.com,value1,value2
Jane Smith,+1987654321,jane@example.com,value3,value4
```

**Required Fields:**
- `phone_number`: Must include country code
- `name`: Contact's full name

**Optional Fields:**
- `email`: For follow-up communications
- Custom fields: For personalization

## Usage Tracking & Limits

### Understanding Your Usage

VoxFlow tracks several metrics:

1. **Token Usage**: Language model API calls
2. **Voice Minutes**: Speech synthesis and recognition
3. **Phone Calls**: Outbound call minutes
4. **API Costs**: Total spending across providers

### Viewing Usage Statistics

1. Navigate to "Dashboard" → "Usage"
2. View current month statistics:
   - Token usage vs. limit
   - Call minutes used
   - Estimated costs
   - Remaining quota

### Usage Limits by Plan

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Agents | 3 | 10 | Unlimited |
| Monthly Tokens | 10,000 | 100,000 | 1,000,000 |
| Concurrent Calls | 1 | 5 | 25 |
| Support | Community | Email | Priority |

### Limit Notifications

- **75% Usage**: Warning notification
- **90% Usage**: Urgent warning
- **100% Usage**: Service temporarily limited
- **Upgrade Prompts**: Suggestions to upgrade plan

## Subscription Plans

### Plan Comparison

#### Free Plan
- **Cost**: $0/month
- **Agents**: Up to 3 agents
- **Tokens**: 10,000/month
- **Support**: Community forum
- **Features**: Basic voice agents, campaign management

#### Pro Plan
- **Cost**: $49/month
- **Agents**: Up to 10 agents
- **Tokens**: 100,000/month
- **Support**: Email support
- **Features**: Advanced analytics, priority processing

#### Enterprise Plan
- **Cost**: $199/month
- **Agents**: Unlimited
- **Tokens**: 1,000,000/month
- **Support**: Priority support, dedicated account manager
- **Features**: Custom integrations, SLA guarantees

### Upgrading Your Plan

1. Navigate to "Settings" → "Subscription"
2. Click "Upgrade Plan"
3. Select desired plan
4. Enter payment information
5. Confirm upgrade

### Billing Information

- **Billing Cycle**: Monthly
- **Payment Methods**: Credit card, ACH transfer
- **Invoicing**: Available for Enterprise plans
- **Usage Overages**: Automatically billed at standard rates

## Troubleshooting

### Common Issues

#### 1. API Key Not Working

**Symptoms:**
- Error messages about invalid API keys
- Agents not responding
- Failed voice synthesis

**Solutions:**
1. Verify API key is correctly copied
2. Check for extra spaces or characters
3. Ensure API key has proper permissions
4. Try regenerating the API key from provider

#### 2. Agent Not Responding

**Symptoms:**
- No response from agent during testing
- Timeout errors
- Blank responses

**Solutions:**
1. Check system prompt configuration
2. Verify language model selection
3. Test with simpler prompts
4. Check usage limits

#### 3. Voice Quality Issues

**Symptoms:**
- Robotic or unclear voice
- Wrong language or accent
- Audio cutting out

**Solutions:**
1. Try different voice models
2. Adjust speech rate settings
3. Check audio format compatibility
4. Test with shorter text samples

#### 4. Campaign Not Starting

**Symptoms:**
- Campaign stuck in "Pending" status
- No calls being made
- Error in campaign logs

**Solutions:**
1. Verify contact list format
2. Check Twilio credentials
3. Ensure sufficient account balance
4. Review campaign schedule settings

#### 5. Usage Tracking Discrepancies

**Symptoms:**
- Usage numbers don't match expectations
- Missing usage data
- Incorrect cost calculations

**Solutions:**
1. Allow 24 hours for usage to update
2. Check timezone settings
3. Review detailed usage logs
4. Contact support for billing questions

### Getting Help

#### Self-Service Resources

1. **Documentation**: Comprehensive guides and API reference
2. **FAQ**: Common questions and answers
3. **Video Tutorials**: Step-by-step walkthroughs
4. **Community Forum**: User discussions and tips

#### Support Channels

1. **Free Plan**: Community forum only
2. **Pro Plan**: Email support (response within 24 hours)
3. **Enterprise Plan**: Priority support (response within 4 hours)

#### Contact Information

- **Support Email**: support@voxflow.com
- **Sales**: sales@voxflow.com
- **Technical Issues**: tech@voxflow.com
- **Billing**: billing@voxflow.com

### Best Practices

#### Security
- Use strong, unique passwords
- Enable two-factor authentication when available
- Regularly rotate API keys
- Monitor usage for suspicious activity

#### Performance
- Start with simple agents and gradually add complexity
- Test agents thoroughly before deploying to campaigns
- Monitor usage to avoid hitting limits
- Use appropriate voice models for your use case

#### Cost Optimization
- Monitor usage regularly
- Choose the right subscription plan for your needs
- Optimize prompts to reduce token usage
- Use efficient voice models

#### Agent Design
- Write clear, specific system prompts
- Test with various input scenarios
- Keep conversations focused and goal-oriented
- Implement proper error handling

### Frequently Asked Questions

#### General

**Q: Can I change my subscription plan at any time?**
A: Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately for upgrades, or at the next billing cycle for downgrades.

**Q: What happens if I exceed my usage limits?**
A: Your service will be temporarily limited until the next billing cycle or until you upgrade your plan. You'll receive notifications before reaching limits.

**Q: Can I use my own AI models?**
A: Currently, VoxFlow supports Groq models. Enterprise customers can discuss custom model integration with our team.

#### Technical

**Q: What audio formats are supported?**
A: VoxFlow supports common audio formats including WAV, MP3, and FLAC for voice synthesis and recognition.

**Q: Can I integrate VoxFlow with my existing CRM?**
A: Yes, VoxFlow provides REST APIs for integration. Enterprise customers get additional integration support.

**Q: Is there an API rate limit?**
A: Yes, rate limits vary by subscription plan. Free: 100 requests/hour, Pro: 1000 requests/hour, Enterprise: 10000 requests/hour.

#### Billing

**Q: Do you offer refunds?**
A: We offer a 30-day money-back guarantee for new subscriptions. Usage-based charges are non-refundable.

**Q: Can I get invoices for my subscription?**
A: Yes, invoices are available for Pro and Enterprise plans. Free plans receive receipts only.

**Q: What payment methods do you accept?**
A: We accept major credit cards (Visa, MasterCard, American Express) and ACH transfers for Enterprise plans.

---

## Need More Help?

If you can't find the answer to your question in this guide, please don't hesitate to reach out:

- **Email**: support@voxflow.com
- **Community Forum**: [community.voxflow.com](https://community.voxflow.com)
- **Documentation**: [docs.voxflow.com](https://docs.voxflow.com)

We're here to help you succeed with VoxFlow!