export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          available_balance: number | null
          balance_last_updated: string | null
          created_at: string | null
          current_balance: number | null
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      ai_conversations: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          extracted_data: Json | null
          id: number
          intent: string | null
          message_type: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          extracted_data?: Json | null
          id?: number
          intent?: string | null
          message_type: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          extracted_data?: Json | null
          id?: number
          intent?: string | null
          message_type?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: number
          timestamp: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: number
          timestamp?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: number
          timestamp?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: number
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: number
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: number
          user_id?: string | null
        }
        Relationships: []
      }
      cached_places: {
        Row: {
          business_data: Json
          business_name: string
          created_at: string | null
          expires_at: string
          id: string
          last_updated: string | null
          place_id: string
          plaza_name: string
        }
        Insert: {
          business_data: Json
          business_name: string
          created_at?: string | null
          expires_at: string
          id?: string
          last_updated?: string | null
          place_id: string
          plaza_name: string
        }
        Update: {
          business_data?: Json
          business_name?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          last_updated?: string | null
          place_id?: string
          plaza_name?: string
        }
        Relationships: []
      }
      category_pacing_tracking: {
        Row: {
          ai_category: string
          auto_selected: boolean | null
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_category: string
          auto_selected?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_category?: string
          auto_selected?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      custom_sms_templates: {
        Row: {
          created_at: string | null
          id: string
          template_content: string
          template_name: string
          updated_at: string | null
          user_id: string | null
          variables_used: string[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          template_content: string
          template_name: string
          updated_at?: string | null
          user_id?: string | null
          variables_used?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          template_content?: string
          template_name?: string
          updated_at?: string | null
          user_id?: string | null
          variables_used?: string[] | null
        }
        Relationships: []
      }
      deal_notifications: {
        Row: {
          brand: string | null
          budgenudge_upsell_included: boolean | null
          conversion_action: string | null
          delivery_method: string | null
          id: number
          message: string | null
          notification_type: string | null
          product_name: string | null
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          brand?: string | null
          budgenudge_upsell_included?: boolean | null
          conversion_action?: string | null
          delivery_method?: string | null
          id?: number
          message?: string | null
          notification_type?: string | null
          product_name?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          brand?: string | null
          budgenudge_upsell_included?: boolean | null
          conversion_action?: string | null
          delivery_method?: string | null
          id?: number
          message?: string | null
          notification_type?: string | null
          product_name?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deal_posts: {
        Row: {
          created_at: string | null
          id: number
          published_at: string | null
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          published_at?: string | null
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: number
          published_at?: string | null
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      deal_predictions: {
        Row: {
          average_cycle_days: number | null
          brand: string | null
          category: string | null
          confidence_score: number | null
          created_at: string | null
          id: number
          last_seen_deal: string | null
          predicted_week_end: string | null
          predicted_week_start: string | null
          prediction_reasoning: string | null
          product_name: string | null
        }
        Insert: {
          average_cycle_days?: number | null
          brand?: string | null
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: number
          last_seen_deal?: string | null
          predicted_week_end?: string | null
          predicted_week_start?: string | null
          prediction_reasoning?: string | null
          product_name?: string | null
        }
        Update: {
          average_cycle_days?: number | null
          brand?: string | null
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: number
          last_seen_deal?: string | null
          predicted_week_end?: string | null
          predicted_week_start?: string | null
          prediction_reasoning?: string | null
          product_name?: string | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          brand: string | null
          created_at: string | null
          ends_at: string | null
          id: number
          post_id: number
          price_text: string | null
          promo_type: string | null
          size: string | null
          starts_at: string | null
          store: string
          title: string
          unit_price_cents: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: number
          post_id: number
          price_text?: string | null
          promo_type?: string | null
          size?: string | null
          starts_at?: string | null
          store?: string
          title: string
          unit_price_cents?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: number
          post_id?: number
          price_text?: string | null
          promo_type?: string | null
          size?: string | null
          starts_at?: string | null
          store?: string
          title?: string
          unit_price_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "deal_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      dinner_plans: {
        Row: {
          created_at: string
          id: number
          model: string | null
          plan_json: Json
          post_id: number
        }
        Insert: {
          created_at?: string
          id?: never
          model?: string | null
          plan_json: Json
          post_id: number
        }
        Update: {
          created_at?: string
          id?: never
          model?: string | null
          plan_json?: Json
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "dinner_plans_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "deal_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      income_detection_log: {
        Row: {
          analysis_date: string | null
          confidence_average: number | null
          detection_results: Json | null
          error_message: string | null
          id: string
          lookback_months: number | null
          patterns_detected: number | null
          status: string | null
          transactions_analyzed: number | null
          user_id: string | null
        }
        Insert: {
          analysis_date?: string | null
          confidence_average?: number | null
          detection_results?: Json | null
          error_message?: string | null
          id?: string
          lookback_months?: number | null
          patterns_detected?: number | null
          status?: string | null
          transactions_analyzed?: number | null
          user_id?: string | null
        }
        Update: {
          analysis_date?: string | null
          confidence_average?: number | null
          detection_results?: Json | null
          error_message?: string | null
          id?: string
          lookback_months?: number | null
          patterns_detected?: number | null
          status?: string | null
          transactions_analyzed?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      income_schedule_templates: {
        Row: {
          created_at: string | null
          description: string
          id: number
          name: string
          pattern_config: Json
          pattern_type: string
          recognition_phrases: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: number
          name: string
          pattern_config?: Json
          pattern_type: string
          recognition_phrases?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: number
          name?: string
          pattern_config?: Json
          pattern_type?: string
          recognition_phrases?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      items: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: number
          institution_name: string | null
          permanent_delete_at: string | null
          plaid_access_token: string
          plaid_institution_id: string | null
          plaid_item_id: string
          retention_choice: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          institution_name?: string | null
          permanent_delete_at?: string | null
          plaid_access_token: string
          plaid_institution_id?: string | null
          plaid_item_id: string
          retention_choice?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: number
          institution_name?: string | null
          permanent_delete_at?: string | null
          plaid_access_token?: string
          plaid_institution_id?: string | null
          plaid_item_id?: string
          retention_choice?: string | null
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
      merchant_pacing_tracking: {
        Row: {
          ai_merchant_name: string
          auto_selected: boolean | null
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_merchant_name: string
          auto_selected?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_merchant_name?: string
          auto_selected?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      morning_text_history: {
        Row: {
          angle: string | null
          created_at: string
          id: number
          message: string | null
          sent_on: string
          user_id: string
        }
        Insert: {
          angle?: string | null
          created_at?: string
          id?: number
          message?: string | null
          sent_on?: string
          user_id: string
        }
        Update: {
          angle?: string | null
          created_at?: string
          id?: number
          message?: string | null
          sent_on?: string
          user_id?: string
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
      plaza_cache_metadata: {
        Row: {
          cache_status: string | null
          created_at: string | null
          id: string
          last_full_refresh: string | null
          plaza_name: string
          plaza_place_id: string | null
          tenant_count: number | null
        }
        Insert: {
          cache_status?: string | null
          created_at?: string | null
          id?: string
          last_full_refresh?: string | null
          plaza_name: string
          plaza_place_id?: string | null
          tenant_count?: number | null
        }
        Update: {
          cache_status?: string | null
          created_at?: string | null
          id?: string
          last_full_refresh?: string | null
          plaza_name?: string
          plaza_place_id?: string | null
          tenant_count?: number | null
        }
        Relationships: []
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
      sample_sms_leads: {
        Row: {
          conversion_date: string | null
          converted_to_signup: boolean | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: number
          last_name: string | null
          opted_in_at: string
          phone_number: string
          sample_sent: boolean | null
          source: string | null
          tracking_token: string | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          conversion_date?: string | null
          converted_to_signup?: boolean | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: number
          last_name?: string | null
          opted_in_at: string
          phone_number: string
          sample_sent?: boolean | null
          source?: string | null
          tracking_token?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          conversion_date?: string | null
          converted_to_signup?: boolean | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: number
          last_name?: string | null
          opted_in_at?: string
          phone_number?: string
          sample_sent?: boolean | null
          source?: string | null
          tracking_token?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: []
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
      sms_send_log: {
        Row: {
          id: number
          message_id: string | null
          phone_number: string
          sent_at: string | null
          source_endpoint: string
          success: boolean
          template_type: string
          user_id: string | null
        }
        Insert: {
          id?: number
          message_id?: string | null
          phone_number: string
          sent_at?: string | null
          source_endpoint: string
          success?: boolean
          template_type: string
          user_id?: string | null
        }
        Update: {
          id?: number
          message_id?: string | null
          phone_number?: string
          sent_at?: string | null
          source_endpoint?: string
          success?: boolean
          template_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tagged_income_sources: {
        Row: {
          account_identifier: string | null
          auto_detected: boolean | null
          confidence_score: number
          created_at: string | null
          expected_amount: number
          frequency: string
          id: number
          income_pattern: string | null
          income_source_name: string
          is_active: boolean | null
          last_income_date: string | null
          next_predicted_date: string | null
          pattern_analysis: Json | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_identifier?: string | null
          auto_detected?: boolean | null
          confidence_score?: number
          created_at?: string | null
          expected_amount: number
          frequency: string
          id?: number
          income_pattern?: string | null
          income_source_name: string
          is_active?: boolean | null
          last_income_date?: string | null
          next_predicted_date?: string | null
          pattern_analysis?: Json | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_identifier?: string | null
          auto_detected?: boolean | null
          confidence_score?: number
          created_at?: string | null
          expected_amount?: number
          frequency?: string
          id?: number
          income_pattern?: string | null
          income_source_name?: string
          is_active?: boolean | null
          last_income_date?: string | null
          next_predicted_date?: string | null
          pattern_analysis?: Json | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tagged_merchant_transactions: {
        Row: {
          created_at: string | null
          id: string
          tagged_merchant_id: number | null
          transaction_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          tagged_merchant_id?: number | null
          transaction_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          tagged_merchant_id?: number | null
          transaction_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tagged_merchant_transactions_tagged_merchant_id_fkey"
            columns: ["tagged_merchant_id"]
            isOneToOne: false
            referencedRelation: "tagged_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      tagged_merchants: {
        Row: {
          account_identifier: string | null
          amount_drift: number | null
          amount_std_dev: number | null
          auto_detected: boolean | null
          confidence_score: number
          created_at: string | null
          expected_amount: number
          id: number
          interval_days: number | null
          interval_std_dev: number | null
          is_active: boolean
          last_paid_date: string | null
          last_prediction_date: string | null
          last_status_check: string | null
          last_transaction_date: string | null
          lifecycle_state: string | null
          merchant_name: string
          merchant_pattern: string | null
          next_predicted_date: string | null
          occurrence_count: number | null
          paid_date: string | null
          prediction_frequency: string
          split_group_id: string | null
          status: string | null
          streak_count: number | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_identifier?: string | null
          amount_drift?: number | null
          amount_std_dev?: number | null
          auto_detected?: boolean | null
          confidence_score: number
          created_at?: string | null
          expected_amount: number
          id?: number
          interval_days?: number | null
          interval_std_dev?: number | null
          is_active?: boolean
          last_paid_date?: string | null
          last_prediction_date?: string | null
          last_status_check?: string | null
          last_transaction_date?: string | null
          lifecycle_state?: string | null
          merchant_name: string
          merchant_pattern?: string | null
          next_predicted_date?: string | null
          occurrence_count?: number | null
          paid_date?: string | null
          prediction_frequency: string
          split_group_id?: string | null
          status?: string | null
          streak_count?: number | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_identifier?: string | null
          amount_drift?: number | null
          amount_std_dev?: number | null
          auto_detected?: boolean | null
          confidence_score?: number
          created_at?: string | null
          expected_amount?: number
          id?: number
          interval_days?: number | null
          interval_std_dev?: number | null
          is_active?: boolean
          last_paid_date?: string | null
          last_prediction_date?: string | null
          last_status_check?: string | null
          last_transaction_date?: string | null
          lifecycle_state?: string | null
          merchant_name?: string
          merchant_pattern?: string | null
          next_predicted_date?: string | null
          occurrence_count?: number | null
          paid_date?: string | null
          prediction_frequency?: string
          split_group_id?: string | null
          status?: string | null
          streak_count?: number | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      template_schedules: {
        Row: {
          cadence_config: Json
          cadence_type: string
          created_at: string | null
          id: string
          is_active: boolean
          last_sent_at: string | null
          next_send_at: string | null
          send_time: string
          template_id: string | null
          timezone: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cadence_config?: Json
          cadence_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_send_at?: string | null
          send_time?: string
          template_id?: string | null
          timezone?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cadence_config?: Json
          cadence_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_send_at?: string | null
          send_time?: string
          template_id?: string | null
          timezone?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "custom_sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_recurring_transactions: {
        Row: {
          amount: number
          anchor_date: string
          created_at: string | null
          id: string
          merchant_name: string
          recurrence_type: string
          transaction_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          anchor_date: string
          created_at?: string | null
          id?: string
          merchant_name: string
          recurrence_type: string
          transaction_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          anchor_date?: string
          created_at?: string | null
          id?: string
          merchant_name?: string
          recurrence_type?: string
          transaction_id?: string
          updated_at?: string | null
          user_id?: string
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
          is_subscription: boolean | null
          location_city: string | null
          logo_url: string | null
          merchant_name: string | null
          name: string
          pending: boolean | null
          pfc_primary: string | null
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
          is_subscription?: boolean | null
          location_city?: string | null
          logo_url?: string | null
          merchant_name?: string | null
          name: string
          pending?: boolean | null
          pfc_primary?: string | null
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
          is_subscription?: boolean | null
          location_city?: string | null
          logo_url?: string | null
          merchant_name?: string | null
          name?: string
          pending?: boolean | null
          pfc_primary?: string | null
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
      user_events: {
        Row: {
          created_at: string | null
          email: string
          event_type: string
          id: number
          processed: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          event_type?: string
          id?: number
          processed?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          event_type?: string
          id?: number
          processed?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_favorite_items: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string | null
          id: number
          last_deal_alerted: string | null
          notification_preferences: Json | null
          price_alert_threshold: number | null
          product_name: string | null
          subcategory: string | null
          user_id: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          id?: number
          last_deal_alerted?: string | null
          notification_preferences?: Json | null
          price_alert_threshold?: number | null
          product_name?: string | null
          subcategory?: string | null
          user_id?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          id?: number
          last_deal_alerted?: string | null
          notification_preferences?: Json | null
          price_alert_threshold?: number | null
          product_name?: string | null
          subcategory?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_income_profiles: {
        Row: {
          created_at: string | null
          id: number
          last_conversation_at: string | null
          profile_data: Json
          setup_completed: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          last_conversation_at?: string | null
          profile_data?: Json
          setup_completed?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          last_conversation_at?: string | null
          profile_data?: Json
          setup_completed?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          additional_phone: string | null
          created_at: string | null
          id: number
          phone_number: string | null
          send_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_phone?: string | null
          created_at?: string | null
          id?: number
          phone_number?: string | null
          send_time?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_phone?: string | null
          created_at?: string | null
          id?: number
          phone_number?: string | null
          send_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: number
          phone_number: string
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: number
          phone_number: string
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: number
          phone_number?: string
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
          input_category?: string
          input_merchant_name: string
          input_user_id: string
        }
        Returns: {
          applied_rule_ids: string[]
          applied_rule_names: string[]
          effective_category: string
          effective_merchant_name: string
        }[]
      }
      bytea_to_text: { Args: { data: string }; Returns: string }
      can_send_sms: {
        Args: {
          p_check_date?: string
          p_phone_number: string
          p_template_type: string
        }
        Returns: boolean
      }
      cleanup_expired_verification_codes: { Args: never; Returns: undefined }
      cleanup_permanently_deleted_items: { Args: never; Returns: number }
      create_sample_transaction_rules: {
        Args: { target_user_id: string }
        Returns: number
      }
      get_user_accounts: {
        Args: { user_uuid: string }
        Returns: {
          available_balance: number
          balance_last_updated: string
          created_at: string
          current_balance: number
          id: number
          iso_currency_code: string
          item_id: number
          mask: string
          name: string
          official_name: string
          plaid_account_id: string
          subtype: string
          type: string
          updated_at: string
          verification_status: string
        }[]
      }
      get_user_transactions: {
        Args: { user_uuid: string }
        Returns: {
          account_id: string
          account_owner: string
          ai_category_tag: string
          ai_merchant_name: string
          amount: number
          category: string[]
          created_at: string
          date: string
          id: number
          merchant_name: string
          name: string
          pending: boolean
          plaid_item_id: string
          plaid_transaction_id: string
          subcategory: string
          transaction_type: string
          updated_at: string
        }[]
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      log_sms_send: {
        Args: {
          p_message_id?: string
          p_phone_number: string
          p_source_endpoint: string
          p_success?: boolean
          p_template_type: string
          p_user_id: string
        }
        Returns: number
      }
      normalize_merchant_name: { Args: { raw_name: string }; Returns: string }
      notify_new_user_slack: {
        Args: { created_at: string; user_email: string; user_id: string }
        Returns: undefined
      }
      record_user_registration: {
        Args: { user_email: string; user_uuid: string }
        Returns: undefined
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
      text_to_bytea: { Args: { data: string }; Returns: string }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
  public: {
    Enums: {},
  },
} as const
