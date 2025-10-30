#!/bin/bash

# VoxFlow Database Migration Script
# This script handles the deployment of database migrations for the multi-tenant architecture

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"
BACKUP_DIR="$PROJECT_ROOT/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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
        "SUPABASE_URL"
        "SUPABASE_SERVICE_ROLE_KEY"
        "DATABASE_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    success "All required environment variables are set"
}

# Create backup directory if it doesn't exist
create_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Create database backup
create_backup() {
    log "Creating database backup..."
    
    local backup_file="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Extract database connection details from DATABASE_URL
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        local db_user="${BASH_REMATCH[1]}"
        local db_pass="${BASH_REMATCH[2]}"
        local db_host="${BASH_REMATCH[3]}"
        local db_port="${BASH_REMATCH[4]}"
        local db_name="${BASH_REMATCH[5]}"
        
        # Create backup using pg_dump
        PGPASSWORD="$db_pass" pg_dump \
            -h "$db_host" \
            -p "$db_port" \
            -U "$db_user" \
            -d "$db_name" \
            --verbose \
            --no-owner \
            --no-privileges \
            --format=custom \
            --file="$backup_file"
        
        if [[ $? -eq 0 ]]; then
            success "Database backup created: $backup_file"
            echo "$backup_file" > "$BACKUP_DIR/latest_backup.txt"
        else
            error "Failed to create database backup"
            exit 1
        fi
    else
        error "Invalid DATABASE_URL format"
        exit 1
    fi
}

# Check database connectivity
check_database_connection() {
    log "Checking database connectivity..."
    
    # Simple connectivity test using psql
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        local db_user="${BASH_REMATCH[1]}"
        local db_pass="${BASH_REMATCH[2]}"
        local db_host="${BASH_REMATCH[3]}"
        local db_port="${BASH_REMATCH[4]}"
        local db_name="${BASH_REMATCH[5]}"
        
        PGPASSWORD="$db_pass" psql \
            -h "$db_host" \
            -p "$db_port" \
            -U "$db_user" \
            -d "$db_name" \
            -c "SELECT 1;" > /dev/null 2>&1
        
        if [[ $? -eq 0 ]]; then
            success "Database connection successful"
        else
            error "Failed to connect to database"
            exit 1
        fi
    else
        error "Invalid DATABASE_URL format"
        exit 1
    fi
}

# Get current migration version
get_current_migration_version() {
    log "Checking current migration version..."
    
    # Check if migrations table exists
    local table_exists=$(PGPASSWORD="$db_pass" psql \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schema_migrations');" 2>/dev/null | tr -d ' ')
    
    if [[ "$table_exists" == "t" ]]; then
        local current_version=$(PGPASSWORD="$db_pass" psql \
            -h "$db_host" \
            -p "$db_port" \
            -U "$db_user" \
            -d "$db_name" \
            -t -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;" 2>/dev/null | tr -d ' ')
        
        if [[ -n "$current_version" ]]; then
            log "Current migration version: $current_version"
            echo "$current_version"
        else
            log "No migrations have been applied yet"
            echo "0"
        fi
    else
        log "Schema migrations table does not exist - this is a fresh database"
        echo "0"
    fi
}

# Apply migration file
apply_migration() {
    local migration_file="$1"
    local migration_name=$(basename "$migration_file" .sql)
    
    log "Applying migration: $migration_name"
    
    # Extract database connection details
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        local db_user="${BASH_REMATCH[1]}"
        local db_pass="${BASH_REMATCH[2]}"
        local db_host="${BASH_REMATCH[3]}"
        local db_port="${BASH_REMATCH[4]}"
        local db_name="${BASH_REMATCH[5]}"
        
        # Apply the migration
        PGPASSWORD="$db_pass" psql \
            -h "$db_host" \
            -p "$db_port" \
            -U "$db_user" \
            -d "$db_name" \
            -f "$migration_file" \
            -v ON_ERROR_STOP=1
        
        if [[ $? -eq 0 ]]; then
            success "Migration applied successfully: $migration_name"
            
            # Record migration in schema_migrations table
            local version=$(echo "$migration_name" | grep -o '^[0-9]\+')
            PGPASSWORD="$db_pass" psql \
                -h "$db_host" \
                -p "$db_port" \
                -U "$db_user" \
                -d "$db_name" \
                -c "INSERT INTO schema_migrations (version, applied_at) VALUES ('$version', NOW()) ON CONFLICT (version) DO NOTHING;" > /dev/null 2>&1
            
            return 0
        else
            error "Failed to apply migration: $migration_name"
            return 1
        fi
    else
        error "Invalid DATABASE_URL format"
        return 1
    fi
}

# Create schema_migrations table if it doesn't exist
create_migrations_table() {
    log "Creating schema_migrations table if it doesn't exist..."
    
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        local db_user="${BASH_REMATCH[1]}"
        local db_pass="${BASH_REMATCH[2]}"
        local db_host="${BASH_REMATCH[3]}"
        local db_port="${BASH_REMATCH[4]}"
        local db_name="${BASH_REMATCH[5]}"
        
        PGPASSWORD="$db_pass" psql \
            -h "$db_host" \
            -p "$db_port" \
            -U "$db_user" \
            -d "$db_name" \
            -c "CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT NOW()
            );" > /dev/null 2>&1
        
        if [[ $? -eq 0 ]]; then
            success "Schema migrations table ready"
        else
            error "Failed to create schema_migrations table"
            exit 1
        fi
    fi
}

# Run all pending migrations
run_migrations() {
    log "Running database migrations..."
    
    # Get current version
    local current_version=$(get_current_migration_version)
    
    # Find all migration files
    local migration_files=($(find "$MIGRATIONS_DIR" -name "*.sql" | sort))
    
    if [[ ${#migration_files[@]} -eq 0 ]]; then
        warning "No migration files found in $MIGRATIONS_DIR"
        return 0
    fi
    
    local applied_count=0
    local skipped_count=0
    
    for migration_file in "${migration_files[@]}"; do
        local migration_name=$(basename "$migration_file" .sql)
        local migration_version=$(echo "$migration_name" | grep -o '^[0-9]\+')
        
        if [[ -z "$migration_version" ]]; then
            warning "Skipping file with invalid name format: $migration_name"
            continue
        fi
        
        if [[ "$migration_version" -gt "$current_version" ]]; then
            log "Applying migration $migration_version: $migration_name"
            
            if apply_migration "$migration_file"; then
                ((applied_count++))
            else
                error "Migration failed: $migration_name"
                log "Rolling back to backup..."
                restore_backup
                exit 1
            fi
        else
            log "Skipping already applied migration: $migration_name"
            ((skipped_count++))
        fi
    done
    
    success "Migration complete. Applied: $applied_count, Skipped: $skipped_count"
}

# Restore from backup
restore_backup() {
    log "Restoring database from backup..."
    
    local latest_backup_file
    if [[ -f "$BACKUP_DIR/latest_backup.txt" ]]; then
        latest_backup_file=$(cat "$BACKUP_DIR/latest_backup.txt")
    else
        error "No backup file reference found"
        return 1
    fi
    
    if [[ ! -f "$latest_backup_file" ]]; then
        error "Backup file not found: $latest_backup_file"
        return 1
    fi
    
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        local db_user="${BASH_REMATCH[1]}"
        local db_pass="${BASH_REMATCH[2]}"
        local db_host="${BASH_REMATCH[3]}"
        local db_port="${BASH_REMATCH[4]}"
        local db_name="${BASH_REMATCH[5]}"
        
        # Drop and recreate database (be very careful with this!)
        warning "This will completely restore the database from backup!"
        read -p "Are you sure you want to continue? (yes/no): " confirm
        
        if [[ "$confirm" != "yes" ]]; then
            log "Backup restore cancelled"
            return 1
        fi
        
        # Restore from backup
        PGPASSWORD="$db_pass" pg_restore \
            -h "$db_host" \
            -p "$db_port" \
            -U "$db_user" \
            -d "$db_name" \
            --clean \
            --if-exists \
            --verbose \
            "$latest_backup_file"
        
        if [[ $? -eq 0 ]]; then
            success "Database restored from backup"
        else
            error "Failed to restore database from backup"
            return 1
        fi
    fi
}

# Validate migrations
validate_migrations() {
    log "Validating migration files..."
    
    local migration_files=($(find "$MIGRATIONS_DIR" -name "*.sql" | sort))
    local validation_errors=0
    
    for migration_file in "${migration_files[@]}"; do
        local migration_name=$(basename "$migration_file" .sql)
        
        # Check file naming convention
        if [[ ! "$migration_name" =~ ^[0-9]{3}_[a-zA-Z0-9_]+$ ]]; then
            error "Invalid migration file name format: $migration_name"
            error "Expected format: 001_description.sql"
            ((validation_errors++))
        fi
        
        # Check if file is readable
        if [[ ! -r "$migration_file" ]]; then
            error "Migration file is not readable: $migration_file"
            ((validation_errors++))
        fi
        
        # Basic SQL syntax check (very basic)
        if ! grep -q ";" "$migration_file"; then
            warning "Migration file may not contain valid SQL statements: $migration_name"
        fi
    done
    
    if [[ $validation_errors -eq 0 ]]; then
        success "All migration files passed validation"
        return 0
    else
        error "Found $validation_errors validation errors"
        return 1
    fi
}

# Show migration status
show_status() {
    log "Migration Status Report"
    echo "======================="
    
    local current_version=$(get_current_migration_version)
    echo "Current migration version: $current_version"
    
    local migration_files=($(find "$MIGRATIONS_DIR" -name "*.sql" | sort))
    echo "Available migrations: ${#migration_files[@]}"
    
    local pending_count=0
    for migration_file in "${migration_files[@]}"; do
        local migration_name=$(basename "$migration_file" .sql)
        local migration_version=$(echo "$migration_name" | grep -o '^[0-9]\+')
        
        if [[ -n "$migration_version" && "$migration_version" -gt "$current_version" ]]; then
            ((pending_count++))
        fi
    done
    
    echo "Pending migrations: $pending_count"
    
    if [[ $pending_count -gt 0 ]]; then
        echo ""
        echo "Pending migrations:"
        for migration_file in "${migration_files[@]}"; do
            local migration_name=$(basename "$migration_file" .sql)
            local migration_version=$(echo "$migration_name" | grep -o '^[0-9]\+')
            
            if [[ -n "$migration_version" && "$migration_version" -gt "$current_version" ]]; then
                echo "  - $migration_name"
            fi
        done
    fi
}

# Main function
main() {
    local command="${1:-migrate}"
    
    case "$command" in
        "migrate")
            log "Starting database migration process..."
            check_environment
            create_backup_dir
            check_database_connection
            validate_migrations
            create_migrations_table
            create_backup
            run_migrations
            success "Database migration completed successfully!"
            ;;
        "status")
            check_environment
            check_database_connection
            show_status
            ;;
        "backup")
            log "Creating database backup..."
            check_environment
            create_backup_dir
            check_database_connection
            create_backup
            success "Database backup completed!"
            ;;
        "restore")
            log "Restoring database from backup..."
            check_environment
            check_database_connection
            restore_backup
            ;;
        "validate")
            log "Validating migration files..."
            validate_migrations
            ;;
        "help"|"-h"|"--help")
            echo "VoxFlow Database Migration Script"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  migrate   Run pending database migrations (default)"
            echo "  status    Show migration status"
            echo "  backup    Create database backup"
            echo "  restore   Restore database from latest backup"
            echo "  validate  Validate migration files"
            echo "  help      Show this help message"
            echo ""
            echo "Environment Variables Required:"
            echo "  SUPABASE_URL              - Supabase project URL"
            echo "  SUPABASE_SERVICE_ROLE_KEY - Supabase service role key"
            echo "  DATABASE_URL              - PostgreSQL connection string"
            echo ""
            echo "Example:"
            echo "  $0 migrate"
            echo "  $0 status"
            echo "  $0 backup"
            ;;
        *)
            error "Unknown command: $command"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"