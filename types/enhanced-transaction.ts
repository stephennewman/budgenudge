// Enhanced transaction types - extends existing without breaking
export interface EnhancedTransactionFields {
  // Visual enhancement
  logo_url?: string | null;
  
  // Location insight  
  location_city?: string | null;
  
  // Subscription detection
  is_subscription?: boolean;
  
  // Enhanced categorization
  pfc_primary?: string | null;
}

// This extends your existing transaction interface
export interface EnhancedTransaction extends EnhancedTransactionFields {
  // All your existing fields remain the same
  id: string | number;
  plaid_transaction_id?: string;
  plaid_item_id?: string;
  account_id?: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category: string[];
  subcategory?: string;
  transaction_type?: string;
  pending: boolean;
  account_owner?: string;
  created_at?: string;
  updated_at?: string;
  ai_merchant_name?: string;
  ai_category_tag?: string;
} 