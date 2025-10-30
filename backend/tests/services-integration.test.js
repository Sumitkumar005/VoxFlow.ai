import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { generateResponse } from '../src/services/groq.service.js';
import { speechToText, textToSpeech } from '../src/services/deepgram.service.js';
import { makeCall, getCallDetails } from '../src/services/twilio.service.js';

// Mock the dependencies
jest.mock('../src/services/user-keys.service.js');
jest.mock('../src/services/usage-tracking.service.js');
jest.mock('groq-sdk');
jest.mock('@deepgram/sdk');
jest.mock('twilio');

import { getUserAPIKey } from '../src/services/user-keys.service.js';
import { trackUsage, checkAPICallLimit } from '../src/services/usage-tracking.service.js';

describe('Services Integration with User API Keys', () => {
    const testUserId = 'user-123';
    const testAPIKeys = {
        groq: 'gsk_test_groq_key_1234567890abcdef',
        deepgram: 'test_deepgram_key_1234567890abcdef',
        twilio: JSON.stringify({
            accountSid: 'AC1234567890abcdef',
            authToken: 'test_auth_token',
            phoneNumber: '+1234567890',
        }),
    };

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Mock successful limit checks by default
        checkAPICallLimit.mockResolvedValue({
            allowed: true,
            reason: 'Within usage limits',
        });

        // Mock successful usage tracking
        trackUsage.mockResolvedValue({
            success: true,
        });
    });

    describe('Groq Service Integration', () => {
        it('should use user API key for Groq requests', async () => {
            // Mock user API key retrieval
            getUserAPIKey.mockResolvedValueOnce(testAPIKeys.groq);

            // Mock Groq SDK
            const mockGroq = {
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{ message: { content: 'Test response' } }],
                            usage: { total_tokens: 50 },
                        }),
                    },
                },
            };

            // Mock Groq constructor
            const GroqMock = jest.fn().mockImplementation(() => mockGroq);
            jest.doMock('groq-sdk', () => ({ default: GroqMock }));

            const result = await generateResponse(
                testUserId,
                'Test agent description',
                [],
                'Hello',
                'llama-3.3-70b-versatile',
                { name: 'TestAgent', type: 'OUTBOUND' }
            );

            expect(getUserAPIKey).toHaveBeenCalledWith(testUserId, 'groq');
            expect(GroqMock).toHaveBeenCalledWith({ apiKey: testAPIKeys.groq });
            expect(result.success).toBe(true);
            expect(result.message).toBe('Test response');
        });

        it('should handle missing Groq API key', async () => {
            getUserAPIKey.mockRejectedValueOnce(new Error('No groq API key configured'));

            const result = await generateResponse(
                testUserId,
                'Test agent description',
                [],
                'Hello'
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('API key not configured');
            expect(result.setup_required).toBe(true);
        });

        it('should handle usage limit exceeded', async () => {
            checkAPICallLimit.mockResolvedValueOnce({
                allowed: false,
                reason: 'Monthly token quota exceeded',
                details: { remaining_tokens: 0 },
            });

            const result = await generateResponse(
                testUserId,
                'Test agent description',
                [],
                'Hello'
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('Usage limit exceeded');
            expect(result.limit_info).toBeDefined();
        });

        it('should track usage after successful request', async () => {
            getUserAPIKey.mockResolvedValueOnce(testAPIKeys.groq);

            const mockGroq = {
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{ message: { content: 'Test response' } }],
                            usage: { total_tokens: 75 },
                        }),
                    },
                },
            };

            const GroqMock = jest.fn().mockImplementation(() => mockGroq);
            jest.doMock('groq-sdk', () => ({ default: GroqMock }));

            await generateResponse(
                testUserId,
                'Test agent description',
                [],
                'Hello'
            );

            // Usage tracking is async, so we need to wait a bit
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(trackUsage).toHaveBeenCalledWith(testUserId, {
                provider: 'groq',
                tokens: 75,
                calls: 1,
            });
        });
    });

    describe('Deepgram Service Integration', () => {
        it('should use user API key for Deepgram STT', async () => {
            getUserAPIKey.mockResolvedValueOnce(testAPIKeys.deepgram);

            const mockDeepgram = {
                listen: {
                    prerecorded: {
                        transcribeFile: jest.fn().mockResolvedValue({
                            result: {
                                results: {
                                    channels: [{
                                        alternatives: [{
                                            transcript: 'Hello world',
                                            confidence: 0.95,
                                        }],
                                    }],
                                },
                                metadata: { duration: 2.5 },
                            },
                            error: null,
                        }),
                    },
                },
            };

            const createClientMock = jest.fn().mockReturnValue(mockDeepgram);
            jest.doMock('@deepgram/sdk', () => ({ createClient: createClientMock }));

            const audioBuffer = Buffer.from('fake audio data');
            const result = await speechToText(testUserId, audioBuffer);

            expect(getUserAPIKey).toHaveBeenCalledWith(testUserId, 'deepgram');
            expect(createClientMock).toHaveBeenCalledWith(testAPIKeys.deepgram);
            expect(result.success).toBe(true);
            expect(result.transcript).toBe('Hello world');
        });

        it('should use user API key for Deepgram TTS', async () => {
            getUserAPIKey.mockResolvedValueOnce(testAPIKeys.deepgram);

            const mockStream = {
                async *[Symbol.asyncIterator]() {
                    yield Buffer.from('audio chunk 1');
                    yield Buffer.from('audio chunk 2');
                }
            };

            const mockDeepgram = {
                speak: {
                    request: jest.fn().mockResolvedValue({
                        getStream: jest.fn().mockResolvedValue(mockStream),
                    }),
                },
            };

            const createClientMock = jest.fn().mockReturnValue(mockDeepgram);
            jest.doMock('@deepgram/sdk', () => ({ createClient: createClientMock }));

            const result = await textToSpeech(testUserId, 'Hello world');

            expect(getUserAPIKey).toHaveBeenCalledWith(testUserId, 'deepgram');
            expect(createClientMock).toHaveBeenCalledWith(testAPIKeys.deepgram);
            expect(result.success).toBe(true);
            expect(result.audio).toBeInstanceOf(Buffer);
        });

        it('should handle missing Deepgram API key', async () => {
            getUserAPIKey.mockRejectedValueOnce(new Error('No deepgram API key configured'));

            const result = await speechToText(testUserId, Buffer.from('audio'));

            expect(result.success).toBe(false);
            expect(result.error).toBe('API key not configured');
            expect(result.setup_required).toBe(true);
        });
    });

    describe('Twilio Service Integration', () => {
        it('should use user API key for Twilio calls', async () => {
            getUserAPIKey.mockResolvedValueOnce(testAPIKeys.twilio);

            const mockCall = {
                sid: 'CA1234567890abcdef',
                status: 'queued',
            };

            const mockTwilioClient = {
                calls: {
                    create: jest.fn().mockResolvedValue(mockCall),
                },
            };

            const twilioMock = jest.fn().mockReturnValue(mockTwilioClient);
            jest.doMock('twilio', () => ({ default: twilioMock }));

            const result = await makeCall(testUserId, {
                to: '+1987654321',
                webhookUrl: 'https://example.com/webhook',
            });

            expect(getUserAPIKey).toHaveBeenCalledWith(testUserId, 'twilio');
            expect(twilioMock).toHaveBeenCalledWith('AC1234567890abcdef', 'test_auth_token');
            expect(result.success).toBe(true);
            expect(result.callSid).toBe('CA1234567890abcdef');
        });

        it('should handle missing Twilio API key with fallback', async () => {
            getUserAPIKey.mockRejectedValueOnce(new Error('No twilio API key configured'));

            // Mock environment variables
            process.env.TWILIO_ACCOUNT_SID = 'AC_env_fallback';
            process.env.TWILIO_AUTH_TOKEN = 'env_auth_token';
            process.env.TWILIO_PHONE_NUMBER = '+1555000000';

            const mockCall = {
                sid: 'CA_fallback_call',
                status: 'queued',
            };

            const mockTwilioClient = {
                calls: {
                    create: jest.fn().mockResolvedValue(mockCall),
                },
            };

            const twilioMock = jest.fn().mockReturnValue(mockTwilioClient);
            jest.doMock('twilio', () => ({ default: twilioMock }));

            const result = await makeCall(testUserId, {
                to: '+1987654321',
                webhookUrl: 'https://example.com/webhook',
            });

            expect(twilioMock).toHaveBeenCalledWith('AC_env_fallback', 'env_auth_token');
            expect(result.success).toBe(true);
        });

        it('should handle Twilio authentication errors', async () => {
            getUserAPIKey.mockResolvedValueOnce(testAPIKeys.twilio);

            const mockTwilioClient = {
                calls: {
                    create: jest.fn().mockRejectedValue({
                        code: 20003,
                        message: 'Authentication failed',
                    }),
                },
            };

            const twilioMock = jest.fn().mockReturnValue(mockTwilioClient);
            jest.doMock('twilio', () => ({ default: twilioMock }));

            const result = await makeCall(testUserId, {
                to: '+1987654321',
                webhookUrl: 'https://example.com/webhook',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid Twilio credentials');
            expect(result.setup_required).toBe(true);
        });
    });

    describe('Cross-Service Usage Tracking', () => {
        it('should track usage across all services', async () => {
            // Test that all services call trackUsage with correct parameters

            // Groq usage tracking
            getUserAPIKey.mockResolvedValueOnce(testAPIKeys.groq);
            const mockGroq = {
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{ message: { content: 'Response' } }],
                            usage: { total_tokens: 100 },
                        }),
                    },
                },
            };
            jest.doMock('groq-sdk', () => ({ default: jest.fn(() => mockGroq) }));

            await generateResponse(testUserId, 'Test', [], 'Hello');

            // Deepgram usage tracking
            getUserAPIKey.mockResolvedValueOnce(testAPIKeys.deepgram);
            const mockDeepgram = {
                listen: {
                    prerecorded: {
                        transcribeFile: jest.fn().mockResolvedValue({
                            result: {
                                results: { channels: [{ alternatives: [{ transcript: 'Test', confidence: 0.9 }] }] },
                                metadata: { duration: 3.0 },
                            },
                        }),
                    },
                },
            };
            jest.doMock('@deepgram/sdk', () => ({ createClient: jest.fn(() => mockDeepgram) }));

            await speechToText(testUserId, Buffer.from('audio'));

            // Wait for async tracking
            await new Promise(resolve => setTimeout(resolve, 20));

            expect(trackUsage).toHaveBeenCalledWith(testUserId, {
                provider: 'groq',
                tokens: 100,
                calls: 1,
            });

            expect(trackUsage).toHaveBeenCalledWith(testUserId, {
                provider: 'deepgram',
                duration: 3.0,
                calls: 1,
            });
        });
    });

    describe('Error Handling Across Services', () => {
        it('should provide consistent error messages for setup issues', async () => {
            // Test that all services provide helpful setup messages

            getUserAPIKey.mockRejectedValue(new Error('No groq API key configured'));
            const groqResult = await generateResponse(testUserId, 'Test', [], 'Hello');

            getUserAPIKey.mockRejectedValue(new Error('No deepgram API key configured'));
            const deepgramResult = await speechToText(testUserId, Buffer.from('audio'));

            expect(groqResult.setup_required).toBe(true);
            expect(groqResult.message).toContain('configure your Groq API key');

            expect(deepgramResult.setup_required).toBe(true);
            expect(deepgramResult.message).toContain('configure your Deepgram API key');
        });
    });
});