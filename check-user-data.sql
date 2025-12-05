-- Check your user data
SELECT 
    id,
    email,
    role,
    subscription_tier,
    max_agents,
    monthly_token_quota,
    created_at
FROM users
WHERE email = 'sumitkumar9690@gmail.com';

-- Check your actual usage
SELECT 
    COUNT(DISTINCT a.id) as total_agents,
    COUNT(DISTINCT ar.id) as total_runs,
    COALESCE(SUM(ar.duration_seconds), 0) as total_duration,
    COALESCE(SUM(ar.groq_tokens), 0) as total_tokens
FROM agents a
LEFT JOIN agent_runs ar ON a.id = ar.agent_id
WHERE a.user_id = (SELECT id FROM users WHERE email = 'sumitkumar9690@gmail.com');

-- Check campaigns
SELECT COUNT(*) as total_campaigns
FROM campaigns
WHERE user_id = (SELECT id FROM users WHERE email = 'sumitkumar9690@gmail.com');
