import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // We're using JWT, not Supabase auth
  },
});

// Helper function to execute queries with error handling
export const query = async (tableName, operation, options = {}) => {
  try {
    let queryBuilder = supabase.from(tableName);

    switch (operation) {
      case 'select':
        queryBuilder = queryBuilder.select(options.columns || '*');
        if (options.filter) {
          Object.entries(options.filter).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key, value);
          });
        }
        if (options.order) {
          queryBuilder = queryBuilder.order(options.order.column, {
            ascending: options.order.ascending ?? false,
          });
        }
        if (options.limit) {
          queryBuilder = queryBuilder.limit(options.limit);
        }
        if (options.offset) {
          queryBuilder = queryBuilder.range(
            options.offset,
            options.offset + (options.limit || 10) - 1
          );
        }
        break;

      case 'insert':
        queryBuilder = queryBuilder.insert(options.data).select();
        break;

      case 'update':
        queryBuilder = queryBuilder.update(options.data);
        if (options.filter) {
          Object.entries(options.filter).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key, value);
          });
        }
        queryBuilder = queryBuilder.select();
        break;

      case 'delete':
        queryBuilder = queryBuilder.delete();
        if (options.filter) {
          Object.entries(options.filter).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key, value);
          });
        }
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    const { data, error, count } = await queryBuilder;

    if (error) {
      console.error(`Supabase ${operation} error on ${tableName}:`, error);
      throw error;
    }

    return { data, count };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export default supabase;