#!/bin/bash

# VoxFlow Deployment Verification Script
# This script verifies that a deployment was successful and all systems are operational

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMEOUT=300  # 5 minutes timeout for checks

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if required environment variables are set
check_environment() {
    log "Checking environment variables..."
    
    required_vars=(
        "API_BASE_URL"
        "ADMIN_EMAIL"
        "ADMIN_PASSWORD"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    success "All required environment variables are set"
}

# Wait for service to be ready
wait_for_service() {
    local url="$1"
    local timeout="$2"
    local interval=5
    local elapsed=0
    
    log "Waiting for service to be ready: $url"
    
    while [[ $elapsed -lt $timeout ]]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            success "Service is ready: $url"
            return 0
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        echo -n "."
    done
    
    error "Service did not become ready within $timeout seconds: $url"
    return 1
}

# Test basic health endpoint
test_health_endpoint() {
    log "Testing health endpoint..."
    
    local health_url="${API_BASE_URL}/health"
    local response
    
    response=$(curl -f -s "$health_url" 2>/dev/null) || {
        error "Health endpoint is not accessible: $health_url"
        return 1
    }
    
    # Parse JSON response
    local status=$(echo "$response" | jq -r '.status' 2>/dev/null)
    
    if [[ "$status" == "healthy" ]]; then
        success "Health endpoint is working correctly"
        return 0
    else
        error "Health endpoint returned unhealthy status: $status"
        return 1
    fi
}

# Test detailed health endpoint
test_detailed_health() {
    log "Testing detailed health endpoint..."
    
    local health_url="${API_BASE_URL}/health/detailed"
    local response
    
    response=$(curl -f -s "$health_url" 2>/dev/null) || {
        error "Detailed health endpoint is not accessible: $health_url"
        return 1
    }
    
    # Check database health
    local db_status=$(echo "$response" | jq -r '.checks.database.status' 2>/dev/null)
    if [[ "$db_status" != "healthy" ]]; then
        error "Database health check failed: $db_status"
        return 1
    fi
    
    # Check memory health
    local memory_status=$(echo "$response" | jq -r '.checks.memory.status' 2>/dev/null)
    if [[ "$memory_status" == "critical" ]]; then
        error "Memory health check is critical: $memory_status"
        return 1
    fi
    
    success "Detailed health checks passed"
    return 0
}

# Test authentication
test_authentication() {
    log "Testing authentication..."
    
    local login_url="${API_BASE_URL}/api/auth/login"
    local response
    
    # Test login
    response=$(curl -f -s -X POST "$login_url" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null) || {
        error "Login request failed"
        return 1
    }
    
    # Extract token
    local token=$(echo "$response" | jq -r '.token' 2>/dev/null)
    
    if [[ "$token" == "null" || -z "$token" ]]; then
        error "Login did not return a valid token"
        return 1
    fi
    
    # Store token for other tests
    export AUTH_TOKEN="$token"
    
    success "Authentication is working correctly"
    return 0
}

# Test user profile endpoint
test_user_profile() {
    log "Testing user profile endpoint..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        error "No authentication token available"
        return 1
    fi
    
    local profile_url="${API_BASE_URL}/api/auth/profile"
    local response
    
    response=$(curl -f -s "$profile_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null) || {
        error "Profile endpoint is not accessible"
        return 1
    }
    
    # Check response structure
    local user_id=$(echo "$response" | jq -r '.data.id' 2>/dev/null)
    local user_role=$(echo "$response" | jq -r '.data.role' 2>/dev/null)
    
    if [[ "$user_id" == "null" || -z "$user_id" ]]; then
        error "Profile endpoint did not return valid user data"
        return 1
    fi
    
    if [[ "$user_role" != "admin" ]]; then
        warning "Test user is not an admin (role: $user_role)"
    fi
    
    success "User profile endpoint is working correctly"
    return 0
}

# Test database connectivity
test_database_connectivity() {
    log "Testing database connectivity..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        error "No authentication token available"
        return 1
    fi
    
    local users_url="${API_BASE_URL}/api/admin/users?limit=1"
    local response
    
    response=$(curl -f -s "$users_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null) || {
        error "Database connectivity test failed"
        return 1
    }
    
    # Check if we got a valid response
    local success_status=$(echo "$response" | jq -r '.success' 2>/dev/null)
    
    if [[ "$success_status" != "true" ]]; then
        error "Database query did not return successful response"
        return 1
    fi
    
    success "Database connectivity is working correctly"
    return 0
}

# Test API key management
test_api_key_management() {
    log "Testing API key management..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        error "No authentication token available"
        return 1
    fi
    
    local api_keys_url="${API_BASE_URL}/api/api-keys/status"
    local response
    
    response=$(curl -f -s "$api_keys_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null) || {
        error "API key management endpoint is not accessible"
        return 1
    }
    
    # Check response structure
    local success_status=$(echo "$response" | jq -r '.success' 2>/dev/null)
    
    if [[ "$success_status" != "true" ]]; then
        error "API key management endpoint returned error"
        return 1
    fi
    
    success "API key management is working correctly"
    return 0
}

# Test usage tracking
test_usage_tracking() {
    log "Testing usage tracking..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        error "No authentication token available"
        return 1
    fi
    
    local usage_url="${API_BASE_URL}/api/usage/current"
    local response
    
    response=$(curl -f -s "$usage_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null) || {
        error "Usage tracking endpoint is not accessible"
        return 1
    }
    
    # Check response structure
    local success_status=$(echo "$response" | jq -r '.success' 2>/dev/null)
    
    if [[ "$success_status" != "true" ]]; then
        error "Usage tracking endpoint returned error"
        return 1
    fi
    
    success "Usage tracking is working correctly"
    return 0
}

# Test agent operations
test_agent_operations() {
    log "Testing agent operations..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        error "No authentication token available"
        return 1
    fi
    
    # Test agent listing
    local agents_url="${API_BASE_URL}/api/agents"
    local response
    
    response=$(curl -f -s "$agents_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null) || {
        error "Agent listing endpoint is not accessible"
        return 1
    }
    
    # Check response structure
    local success_status=$(echo "$response" | jq -r '.success' 2>/dev/null)
    
    if [[ "$success_status" != "true" ]]; then
        error "Agent listing endpoint returned error"
        return 1
    fi
    
    success "Agent operations are working correctly"
    return 0
}

# Test campaign operations
test_campaign_operations() {
    log "Testing campaign operations..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        error "No authentication token available"
        return 1
    fi
    
    # Test campaign listing
    local campaigns_url="${API_BASE_URL}/api/campaigns"
    local response
    
    response=$(curl -f -s "$campaigns_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null) || {
        error "Campaign listing endpoint is not accessible"
        return 1
    fi
    
    # Check response structure
    local success_status=$(echo "$response" | jq -r '.success' 2>/dev/null)
    
    if [[ "$success_status" != "true" ]]; then
        error "Campaign listing endpoint returned error"
        return 1
    fi
    
    success "Campaign operations are working correctly"
    return 0
}

# Test admin panel functionality
test_admin_panel() {
    log "Testing admin panel functionality..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        error "No authentication token available"
        return 1
    fi
    
    # Test admin users endpoint
    local admin_users_url="${API_BASE_URL}/api/admin/users?limit=5"
    local response
    
    response=$(curl -f -s "$admin_users_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null) || {
        error "Admin users endpoint is not accessible"
        return 1
    fi
    
    # Check response structure
    local success_status=$(echo "$response" | jq -r '.success' 2>/dev/null)
    
    if [[ "$success_status" != "true" ]]; then
        error "Admin users endpoint returned error"
        return 1
    fi
    
    # Test admin analytics endpoint
    local analytics_url="${API_BASE_URL}/api/admin/analytics/platform"
    response=$(curl -f -s "$analytics_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null) || {
        warning "Admin analytics endpoint is not accessible (may be expected)"
        return 0
    }
    
    success "Admin panel functionality is working correctly"
    return 0
}

# Test monitoring endpoints
test_monitoring_endpoints() {
    log "Testing monitoring endpoints..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        error "No authentication token available"
        return 1
    fi
    
    # Test monitoring health endpoint
    local monitoring_health_url="${API_BASE_URL}/api/monitoring/health"
    local response
    
    response=$(curl -f -s "$monitoring_health_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null) || {
        error "Monitoring health endpoint is not accessible"
        return 1
    fi
    
    # Check response structure
    local success_status=$(echo "$response" | jq -r '.success' 2>/dev/null)
    
    if [[ "$success_status" != "true" ]]; then
        error "Monitoring health endpoint returned error"
        return 1
    fi
    
    success "Monitoring endpoints are working correctly"
    return 0
}

# Test performance endpoints
test_performance_endpoints() {
    log "Testing performance endpoints..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        error "No authentication token available"
        return 1
    fi
    
    # Test performance health endpoint
    local performance_health_url="${API_BASE_URL}/api/performance/health"
    local response
    
    response=$(curl -f -s "$performance_health_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null) || {
        error "Performance health endpoint is not accessible"
        return 1
    }
    
    # Check response structure
    local success_status=$(echo "$response" | jq -r '.success' 2>/dev/null)
    
    if [[ "$success_status" != "true" ]]; then
        error "Performance health endpoint returned error"
        return 1
    fi
    
    success "Performance endpoints are working correctly"
    return 0
}

# Test rate limiting
test_rate_limiting() {
    log "Testing rate limiting..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        error "No authentication token available"
        return 1
    fi
    
    local test_url="${API_BASE_URL}/api/auth/profile"
    local rate_limit_remaining
    
    # Make a request and check rate limit headers
    local response_headers=$(curl -f -s -I "$test_url" \
        -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null)
    
    if [[ $? -ne 0 ]]; then
        error "Rate limiting test request failed"
        return 1
    fi
    
    # Check for rate limit headers
    if echo "$response_headers" | grep -i "x-ratelimit-limit" > /dev/null; then
        success "Rate limiting headers are present"
        return 0
    else
        warning "Rate limiting headers not found (may be expected in some configurations)"
        return 0
    fi
}

# Test error handling
test_error_handling() {
    log "Testing error handling..."
    
    # Test 404 error
    local not_found_url="${API_BASE_URL}/api/nonexistent-endpoint"
    local response
    
    response=$(curl -s "$not_found_url" 2>/dev/null)
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$not_found_url" 2>/dev/null)
    
    if [[ "$status_code" == "404" ]]; then
        success "404 error handling is working correctly"
    else
        warning "Unexpected status code for 404 test: $status_code"
    fi
    
    # Test unauthorized access
    local unauthorized_url="${API_BASE_URL}/api/admin/users"
    response=$(curl -s "$unauthorized_url" 2>/dev/null)
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "$unauthorized_url" 2>/dev/null)
    
    if [[ "$status_code" == "401" ]]; then
        success "401 error handling is working correctly"
    else
        warning "Unexpected status code for 401 test: $status_code"
    fi
    
    return 0
}

# Test CORS configuration
test_cors_configuration() {
    log "Testing CORS configuration..."
    
    local test_url="${API_BASE_URL}/health"
    local cors_headers
    
    cors_headers=$(curl -s -I -X OPTIONS "$test_url" \
        -H "Origin: https://app.voxflow.com" \
        -H "Access-Control-Request-Method: GET" 2>/dev/null)
    
    if echo "$cors_headers" | grep -i "access-control-allow-origin" > /dev/null; then
        success "CORS configuration is working correctly"
        return 0
    else
        warning "CORS headers not found (may be expected in some configurations)"
        return 0
    fi
}

# Generate verification report
generate_report() {
    local total_tests="$1"
    local passed_tests="$2"
    local failed_tests="$3"
    
    log "Generating verification report..."
    
    local report_file="deployment_verification_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "deployment_verification": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "${NODE_ENV:-unknown}",
        "api_base_url": "$API_BASE_URL",
        "total_tests": $total_tests,
        "passed_tests": $passed_tests,
        "failed_tests": $failed_tests,
        "success_rate": $(echo "scale=2; $passed_tests * 100 / $total_tests" | bc)
    }
}
EOF
    
    success "Verification report generated: $report_file"
}

# Main verification function
run_verification() {
    log "Starting VoxFlow deployment verification..."
    
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    
    # Array of test functions
    local tests=(
        "test_health_endpoint"
        "test_detailed_health"
        "test_authentication"
        "test_user_profile"
        "test_database_connectivity"
        "test_api_key_management"
        "test_usage_tracking"
        "test_agent_operations"
        "test_campaign_operations"
        "test_admin_panel"
        "test_monitoring_endpoints"
        "test_performance_endpoints"
        "test_rate_limiting"
        "test_error_handling"
        "test_cors_configuration"
    )
    
    # Wait for service to be ready
    wait_for_service "${API_BASE_URL}/health" $TIMEOUT || {
        error "Service is not ready, aborting verification"
        exit 1
    }
    
    # Run all tests
    for test_func in "${tests[@]}"; do
        total_tests=$((total_tests + 1))
        
        log "Running test: $test_func"
        
        if $test_func; then
            passed_tests=$((passed_tests + 1))
        else
            failed_tests=$((failed_tests + 1))
        fi
        
        echo ""  # Add spacing between tests
    done
    
    # Generate report
    generate_report $total_tests $passed_tests $failed_tests
    
    # Summary
    log "Verification Summary:"
    echo "  Total Tests: $total_tests"
    echo "  Passed: $passed_tests"
    echo "  Failed: $failed_tests"
    echo "  Success Rate: $(echo "scale=1; $passed_tests * 100 / $total_tests" | bc)%"
    
    if [[ $failed_tests -eq 0 ]]; then
        success "All verification tests passed! Deployment is successful."
        return 0
    else
        error "$failed_tests test(s) failed. Please review the issues above."
        return 1
    fi
}

# Show help
show_help() {
    echo "VoxFlow Deployment Verification Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h          Show this help message"
    echo "  --timeout SECONDS   Set timeout for service readiness (default: 300)"
    echo ""
    echo "Environment Variables Required:"
    echo "  API_BASE_URL        Base URL of the API (e.g., https://api.voxflow.com)"
    echo "  ADMIN_EMAIL         Admin user email for testing"
    echo "  ADMIN_PASSWORD      Admin user password for testing"
    echo ""
    echo "Optional Environment Variables:"
    echo "  NODE_ENV            Environment name (for reporting)"
    echo ""
    echo "Example:"
    echo "  API_BASE_URL=https://api.voxflow.com \\"
    echo "  ADMIN_EMAIL=admin@voxflow.com \\"
    echo "  ADMIN_PASSWORD=admin_password \\"
    echo "  $0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    check_environment
    run_verification
}

# Run main function
main "$@"