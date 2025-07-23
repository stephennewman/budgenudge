export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          available_balance: number | null
          balance_last_updated: string | null
          created_at: string | null
          current_balance: number | null
          id: number
          iso_currency_code: string | null
          item_id: number | null
          mask: string | null
          name: string
          official_name: string | null
          plaid_account_id: string
          subtype: string | null
          type: string
          updated_at: string | null
          verification_status: string | null
        }
        Insert: {
          available_balance?: number | null
          balance_last_updated?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: number
          iso_currency_code?: string | null
          item_id?: number | null
          mask?: string | null
          name: string
          official_name?: string | null
          plaid_account_id: string
          subtype?: string | null
          type: string
          updated_at?: string | null
          verification_status?: string | null
        }
        Update: {
          available_balance?: number | null
          balance_last_updated?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: number
          iso_currency_code?: string | null
          item_id?: number | null
          mask?: string | null
          name?: string
          official_name?: string | null
          plaid_account_id?: string
          subtype?: string | null
          type?: string
          updated_at?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_log: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: number
          job_name: string
          log_details: Json | null
          sms_attempted: number | null
          sms_failed: number | null
          sms_sent: number | null
          started_at: string
          status: string
          users_processed: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: number
          job_name: string
          log_details?: Json | null
          sms_attempted?: number | null
          sms_failed?: number | null
          sms_sent?: number | null
          started_at?: string
          status?: string
          users_processed?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: number
          job_name?: string
          log_details?: Json | null
          sms_attempted?: number | null
          sms_failed?: number | null
          sms_sent?: number | null
          started_at?: string
          status?: string
          users_processed?: number | null
        }
        Relationships: []
      }
      items: {
        Row: {
          created_at: string | null
          id: number
          plaid_access_token: string
          plaid_institution_id: string | null
          plaid_item_id: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          plaid_access_token: string
          plaid_institution_id?: string | null
          plaid_item_id: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          plaid_access_token?: string
          plaid_institution_id?: string | null
          plaid_item_id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      link_events: {
        Row: {
          created_at: string | null
          error_code: string | null
          error_type: string | null
          id: number
          link_session_id: string | null
          request_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_code?: string | null
          error_type?: string | null
          id?: number
          link_session_id?: string | null
          request_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_code?: string | null
          error_type?: string | null
          id?: number
          link_session_id?: string | null
          request_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      merchant_ai_tags: {
        Row: {
          ai_category_tag: string
          ai_merchant_name: string
          created_at: string | null
          is_manual_override: boolean | null
          merchant_pattern: string
          updated_at: string | null
        }
        Insert: {
          ai_category_tag: string
          ai_merchant_name: string
          created_at?: string | null
          is_manual_override?: boolean | null
          merchant_pattern: string
          updated_at?: string | null
        }
        Update: {
          ai_category_tag?: string
          ai_merchant_name?: string
          created_at?: string | null
          is_manual_override?: boolean | null
          merchant_pattern?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      merchant_analytics: {
        Row: {
          avg_monthly_spending: number | null
          avg_monthly_transactions: number | null
          avg_weekly_spending: number | null
          avg_weekly_transactions: number | null
          created_at: string | null
          days_of_data: number | null
          first_transaction_date: string | null
          id: number
          is_recurring: boolean | null
          last_calculated_at: string | null
          last_transaction_date: string | null
          merchant_name: string
          months_of_data: number | null
          recurring_reason: string | null
          spending_transactions: number | null
          total_spending: number | null
          total_transactions: number | null
          updated_at: string | null
          user_id: string | null
          weeks_of_data: number | null
        }
        Insert: {
          avg_monthly_spending?: number | null
          avg_monthly_transactions?: number | null
          avg_weekly_spending?: number | null
          avg_weekly_transactions?: number | null
          created_at?: string | null
          days_of_data?: number | null
          first_transaction_date?: string | null
          id?: number
          is_recurring?: boolean | null
          last_calculated_at?: string | null
          last_transaction_date?: string | null
          merchant_name: string
          months_of_data?: number | null
          recurring_reason?: string | null
          spending_transactions?: number | null
          total_spending?: number | null
          total_transactions?: number | null
          updated_at?: string | null
          user_id?: string | null
          weeks_of_data?: number | null
        }
        Update: {
          avg_monthly_spending?: number | null
          avg_monthly_transactions?: number | null
          avg_weekly_spending?: number | null
          avg_weekly_transactions?: number | null
          created_at?: string | null
          days_of_data?: number | null
          first_transaction_date?: string | null
          id?: number
          is_recurring?: boolean | null
          last_calculated_at?: string | null
          last_transaction_date?: string | null
          merchant_name?: string
          months_of_data?: number | null
          recurring_reason?: string | null
          spending_transactions?: number | null
          total_spending?: number | null
          total_transactions?: number | null
          updated_at?: string | null
          user_id?: string | null
          weeks_of_data?: number | null
        }
        Relationships: []
      }
      plaid_api_events: {
        Row: {
          created_at: string | null
          error_code: string | null
          error_type: string | null
          id: number
          item_id: number | null
          request_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_code?: string | null
          error_type?: string | null
          id?: number
          item_id?: number | null
          request_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_code?: string | null
          error_type?: string | null
          id?: number
          item_id?: number | null
          request_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plaid_api_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_execution_log: {
        Row: {
          applied_category: string | null
          applied_merchant: string | null
          executed_at: string | null
          id: string
          original_category: string | null
          original_merchant: string | null
          rule_id: string | null
          rule_name: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          applied_category?: string | null
          applied_merchant?: string | null
          executed_at?: string | null
          id?: string
          original_category?: string | null
          original_merchant?: string | null
          rule_id?: string | null
          rule_name?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          applied_category?: string | null
          applied_merchant?: string | null
          executed_at?: string | null
          id?: string
          original_category?: string | null
          original_merchant?: string | null
          rule_id?: string | null
          rule_name?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_execution_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "transaction_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_sms: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: number
          message: string
          phone_number: string
          scheduled_time: string
          sent_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: number
          message: string
          phone_number: string
          scheduled_time: string
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: number
          message?: string
          phone_number?: string
          scheduled_time?: string
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tagged_merchant_transactions: {
        Row: {
          id: string
          tagged_merchant_id: number
          transaction_id: string
          user_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          tagged_merchant_id: number
          transaction_id: string
          user_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          tagged_merchant_id?: number
          transaction_id?: string
          user_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tagged_merchant_transactions_tagged_merchant_id_fkey"
            columns: ["tagged_merchant_id"]
            isOneToOne: false
            referencedRelation: "tagged_merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tagged_merchant_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tagged_merchants: {
        Row: {
          auto_detected: boolean | null
          confidence_score: number
          created_at: string | null
          expected_amount: number
          id: number
          is_active: boolean
          last_transaction_date: string | null
          merchant_name: string
          merchant_pattern: string | null
          next_predicted_date: string | null
          prediction_frequency: string
          type: string | null
          updated_at: string | null
          user_id: string | null
          account_identifier: string | null
        }
        Insert: {
          auto_detected?: boolean | null
          confidence_score: number
          created_at?: string | null
          expected_amount: number
          id?: number
          is_active?: boolean
          last_transaction_date?: string | null
          merchant_name: string
          merchant_pattern?: string | null
          next_predicted_date?: string | null
          prediction_frequency: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          account_identifier?: string | null
        }
        Update: {
          auto_detected?: boolean | null
          confidence_score?: number
          created_at?: string | null
          expected_amount?: number
          id?: number
          is_active?: boolean
          last_transaction_date?: string | null
          merchant_name?: string
          merchant_pattern?: string | null
          next_predicted_date?: string | null
          prediction_frequency?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          account_identifier?: string | null
        }
        Relationships: []
      }
      transaction_rules: {
        Row: {
          auto_generated: boolean | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          normalized_merchant_name: string | null
          override_category: string | null
          pattern_type: string
          pattern_value: string
          priority: number | null
          rule_name: string
          rule_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_generated?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          normalized_merchant_name?: string | null
          override_category?: string | null
          pattern_type: string
          pattern_value: string
          priority?: number | null
          rule_name: string
          rule_type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_generated?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          normalized_merchant_name?: string | null
          override_category?: string | null
          pattern_type?: string
          pattern_value?: string
          priority?: number | null
          rule_name?: string
          rule_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          account_owner: string | null
          ai_category_tag: string | null
          ai_merchant_name: string | null
          amount: number
          category: string[] | null
          created_at: string | null
          date: string
          id: number
          merchant_name: string | null
          name: string
          pending: boolean | null
          plaid_item_id: string | null
          plaid_transaction_id: string
          subcategory: string | null
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          account_owner?: string | null
          ai_category_tag?: string | null
          ai_merchant_name?: string | null
          amount: number
          category?: string[] | null
          created_at?: string | null
          date: string
          id?: number
          merchant_name?: string | null
          name: string
          pending?: boolean | null
          plaid_item_id?: string | null
          plaid_transaction_id: string
          subcategory?: string | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          account_owner?: string | null
          ai_category_tag?: string | null
          ai_merchant_name?: string | null
          amount?: number
          category?: string[] | null
          created_at?: string | null
          date?: string
          id?: number
          merchant_name?: string | null
          name?: string
          pending?: boolean | null
          plaid_item_id?: string | null
          plaid_transaction_id?: string
          subcategory?: string | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_plaid_item_id_fkey"
            columns: ["plaid_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["plaid_item_id"]
          },
        ]
      }
      user_sms_preferences: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          frequency: string | null
          id: number
          phone_number: string | null
          sms_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          frequency?: string | null
          id?: number
          phone_number?: string | null
          sms_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          frequency?: string | null
          id?: number
          phone_number?: string | null
          sms_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_sms_settings: {
        Row: {
          created_at: string | null
          id: number
          phone_number: string | null
          send_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          phone_number?: string | null
          send_time?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          phone_number?: string | null
          send_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_transaction_rules: {
        Args: {
          input_user_id: string
          input_merchant_name: string
          input_category?: string
        }
        Returns: {
          effective_merchant_name: string
          effective_category: string
          applied_rule_ids: string[]
          applied_rule_names: string[]
        }[]
      }
      create_sample_transaction_rules: {
        Args: { target_user_id: string }
        Returns: number
      }
      normalize_merchant_name: {
        Args: { raw_name: string }
        Returns: string
      }
      refresh_merchant_analytics: {
        Args: { target_user_id?: string }
        Returns: number
      }
      test_transaction_rule: {
        Args: {
          rule_pattern_type: string
          rule_pattern_value: string
          test_merchant_name: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
