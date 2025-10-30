# Implementation Plan

- [x] 1. Database Schema Migration for Multi-Tenancy



  - Create new database migration file with enhanced user table columns and new tables
  - Add role, subscription_tier, organization_name, max_agents, monthly_token_quota, is_active, last_login columns to users table
  - Create user_api_keys table with encrypted storage fields
  - Create user_usage_tracking table for daily usage metrics
  - Create admin_audit_logs table for tracking admin actions
  - Add database triggers for agent limit enforcement and usage calculations
  - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.2, 7.3_

- [x] 2. Enhanced Authentication System



  - [x] 2.1 Update user registration endpoint with new fields


    - Modify registration controller to accept role, organization_name, and subscription_tier
    - Add validation for new user fields and default values
    - Update JWT token generation to include role and subscription information
    - Write unit tests for enhanced registration functionality
    - _Requirements: 1.1, 1.2, 1.6_

  - [x] 2.2 Implement role-based access control middleware


    - Create RBAC middleware functions for admin, user, and enterprise roles
    - Add route protection for admin-only endpoints
    - Implement user ownership verification for agent and campaign access
    - Write integration tests for role-based access control
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. API Key Encryption and Management System



  - [x] 3.1 Create encryption service for API keys


    - Implement AES-256-GCM encryption and decryption functions
    - Add secure key generation and IV handling
    - Create utility functions for encrypting and decrypting API keys
    - Write comprehensive unit tests for encryption/decryption operations
    - _Requirements: 2.2, 2.5, 7.3, 7.4_

  - [x] 3.2 Build user API key management service


    - Create service functions for saving, retrieving, and updating user API keys
    - Implement provider-specific key validation
    - Add functions for checking key existence and activation status
    - Write integration tests for API key storage and retrieval
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [x] 3.3 Create API key settings endpoints


    - Build REST endpoints for CRUD operations on user API keys
    - Add validation for supported providers (groq, deepgram, twilio)
    - Implement secure key update and deletion functionality
    - Write API endpoint tests for key management operations
    - _Requirements: 2.1, 2.4, 2.5_

- [x] 4. Usage Tracking and Limit Enforcement



  - [x] 4.1 Implement usage tracking service


    - Create service functions for tracking API calls, tokens, and costs
    - Add daily usage aggregation and storage functionality
    - Implement cost calculation for different API providers
    - Write unit tests for usage calculation accuracy
    - _Requirements: 4.1, 4.2, 4.5, 4.6_

  - [x] 4.2 Build user limit checking system



    - Create functions to check current usage against user limits
    - Implement agent count validation before creation
    - Add token quota checking before API calls
    - Write integration tests for limit enforcement
    - _Requirements: 3.3, 3.4, 4.3, 4.4_

  - [x] 4.3 Update existing services to use user-specific API keys






    - Modify Groq service to use user's API key and track usage
    - Update Deepgram service for user-specific keys and usage tracking
    - Modify Twilio service to use user's credentials
    - Add usage tracking to all API service calls
    - Write integration tests for service modifications



    - _Requirements: 2.3, 4.1, 4.5_

- [x] 5. Agent Ownership and Isolation




  - [x] 5.1 Update agent creation with ownership validation

    - Modify agent creation endpoint to enforce user ownership

    - Add agent limit checking before allowing new agent creation
    - Update agent listing to show only user's agents
    - Write tests for agent ownership and limit enforcement
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 Implement agent access control


    - Add middleware to verify agent ownership on all agent operations
    - Update agent update and delete endpoints with ownership checks
    - Modify campaign creation to validate agent ownership
    - Write integration tests for agent access control
    - _Requirements: 3.1, 3.2, 7.1, 7.2_

- [x] 6. Admin Panel Backend Infrastructure



  - [x] 6.1 Create admin-only API endpoints


    - Build endpoints for retrieving all users with pagination
    - Create user details endpoint with usage statistics
    - Implement user limit update functionality for admins
    - Add user activation/deactivation endpoints
    - Write API tests for admin endpoints
    - _Requirements: 5.2, 5.3, 5.4, 6.2, 6.4_

  - [x] 6.2 Implement platform analytics endpoints


    - Create endpoints for platform-wide usage statistics
    - Build user activity and growth metrics endpoints
    - Add system health monitoring endpoints
    - Implement cost and revenue tracking endpoints
    - Write tests for analytics data accuracy
    - _Requirements: 6.1, 6.3, 6.5, 6.6_

  - [x] 6.3 Build admin audit logging system


    - Create audit log service for tracking admin actions
    - Add logging to all admin operations (user updates, deactivations)
    - Implement audit log retrieval and filtering
    - Write tests for audit log functionality
    - _Requirements: 5.6, 6.6_

- [x] 7. Frontend User Registration and Authentication

  - [x] 7.1 Create user registration page


    - Build registration form with email, password, and organization fields
    - Add form validation and error handling
    - Implement registration API integration
    - Add success and error state management
    - Write component tests for registration functionality
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 7.2 Update login system for multi-tenant support
    - Modify login component to handle role-based redirects
    - Update authentication context with user role and limits
    - Add session management for user-specific data
    - Write tests for enhanced login functionality
    - _Requirements: 1.6, 5.1_

- [x] 8. Frontend API Key Management Interface
  - [x] 8.1 Create API key settings page
    - Build secure form for entering Groq, Deepgram, and Twilio API keys
    - Add password-type inputs and validation for API keys
    - Implement save, update, and delete functionality for API keys
    - Add loading states and success/error feedback
    - Write component tests for API key management
    - _Requirements: 2.1, 2.4, 2.6_

  - [x] 8.2 Add API key status indicators
    - Create components to show which API keys are configured
    - Add validation status indicators for each provider
    - Implement helpful error messages for missing or invalid keys
    - Write tests for API key status display
    - _Requirements: 2.3, 2.4_

- [x] 9. Frontend User Dashboard with Usage Tracking
  - [x] 9.1 Create user usage dashboard
    - Build dashboard showing current month usage statistics
    - Add progress bars for token usage and agent limits
    - Implement usage history charts and trends
    - Create cost breakdown by API provider
    - Write component tests for usage dashboard
    - _Requirements: 4.2, 4.3, 8.1, 8.2_

  - [x] 9.2 Add limit warning notifications
    - Implement notification system for approaching limits
    - Add upgrade prompts when limits are reached
    - Create subscription plan comparison display
    - Write tests for notification and upgrade prompts
    - _Requirements: 4.3, 4.4, 8.3, 8.4, 8.5_

- [x] 10. Frontend Admin Panel Interface

  - [x] 10.1 Create admin dashboard page
    - Build admin dashboard with platform statistics
    - Add user count, agent count, and usage metrics display
    - Implement system health monitoring interface
    - Create quick action buttons for common admin tasks
    - Write component tests for admin dashboard
    - _Requirements: 6.1, 6.3, 6.5_

  - [x] 10.2 Build user management interface
    - Create user list with search and filtering capabilities
    - Build user detail view with usage statistics and agent list
    - Implement user limit editing functionality
    - Add user activation/deactivation controls
    - Write component tests for user management interface
    - _Requirements: 5.2, 5.3, 5.4, 6.2, 6.4_

  - [x] 10.3 Create platform analytics interface







    - Build charts for user growth and platform usage trends
    - Add cost analysis and revenue projection displays
    - Implement data export functionality for reports
    - Create system performance monitoring interface
    - Write component tests for analytics interface
    - _Requirements: 6.1, 6.3, 6.5, 6.6_

- [x] 11. Data Migration and Backward Compatibility





  - [x] 11.1 Create data migration scripts


    - Write migration script to update existing admin user with new fields
    - Create script to migrate existing agents to admin user ownership
    - Add script to initialize usage tracking for existing data
    - Implement rollback procedures for failed migrations
    - Write tests for migration script accuracy
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 11.2 Ensure backward compatibility


    - Test all existing API endpoints with new schema
    - Verify existing agent and campaign functionality works unchanged
    - Add fallback mechanisms for missing user API keys during transition
    - Write comprehensive integration tests for backward compatibility
    - _Requirements: 10.3, 10.5, 10.6_

- [x] 12. Security Hardening and Rate Limiting



  - [x] 12.1 Implement rate limiting middleware


    - Add per-user rate limiting for API endpoints
    - Implement progressive rate limiting based on subscription tiers
    - Create rate limit bypass for admin users
    - Write tests for rate limiting functionality
    - _Requirements: 9.5, 7.4, 7.5_

  - [x] 12.2 Add security headers and validation




    - Implement comprehensive input validation for all new endpoints
    - Add security headers for API responses
    - Create SQL injection prevention measures
    - Write security tests for all new functionality
    - _Requirements: 7.4, 7.5, 9.1, 9.2_

- [x] 13. Testing and Quality Assurance



  - [x] 13.1 Write comprehensive unit tests



    - Create unit tests for all new service functions
    - Add tests for encryption/decryption operations
    - Write tests for usage calculation and limit checking
    - Ensure 90%+ code coverage for new functionality
    - _Requirements: All requirements validation_


  - [x] 13.2 Create integration test suite

    - Build end-to-end tests for complete user workflows
    - Add multi-user concurrent testing scenarios
    - Create admin panel functionality tests
    - Write API endpoint integration tests
    - _Requirements: All requirements validation_

- [x] 14. Performance Optimization and Monitoring


  - [x] 14.1 Optimize database queries and indexing

    - Add proper indexes for new tables and query patterns
    - Optimize usage tracking queries for dashboard performance
    - Implement connection pooling for concurrent users
    - Write performance tests for high-load scenarios
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 14.2 Add monitoring and logging


    - Implement structured logging for all new functionality
    - Add performance monitoring for API endpoints
    - Create error tracking and alerting system
    - Write monitoring tests and health checks
    - _Requirements: 9.1, 9.6_

- [x] 15. Documentation and Deployment



  - [x] 15.1 Create user documentation


    - Write user guide for registration and API key setup
    - Create admin panel user manual
    - Add troubleshooting guide for common issues
    - Document API changes and migration procedures
    - _Requirements: Support for all user stories_


  - [x] 15.2 Prepare production deployment

    - Create deployment scripts for database migrations
    - Add environment variable documentation
    - Create rollback procedures for production deployment
    - Write deployment verification tests
    - _Requirements: 10.4, 10.5, 10.6_