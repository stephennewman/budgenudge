import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Plaid client configuration
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// Error handling utility
export function handlePlaidError(error: any) {
  console.error('Plaid API Error:', error);
  
  if (error.response?.data) {
    return {
      error: error.response.data.error_type || 'PLAID_ERROR',
      error_code: error.response.data.error_code,
      error_message: error.response.data.error_message,
      display_message: error.response.data.display_message,
    };
  }
  
  return {
    error: 'INTERNAL_SERVER_ERROR',
    error_message: 'An internal server error occurred',
  };
} 