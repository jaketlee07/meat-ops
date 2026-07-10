export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      fee_types: {
        Row: {
          code: string
          id: string
          kind: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          id?: string
          kind: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      finished_goods: {
        Row: {
          batch_id: string
          cost_per_lb: number
          finished_product_id: string
          id: string
          lbs_produced: number
          lbs_remaining: number
          produced_date: string
        }
        Insert: {
          batch_id: string
          cost_per_lb: number
          finished_product_id: string
          id?: string
          lbs_produced: number
          lbs_remaining: number
          produced_date?: string
        }
        Update: {
          batch_id?: string
          cost_per_lb?: number
          finished_product_id?: string
          id?: string
          lbs_produced?: number
          lbs_remaining?: number
          produced_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "v_current_menu"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "finished_goods_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "v_product_pricing"
            referencedColumns: ["product_id"]
          },
        ]
      }
      inventory_balances: {
        Row: {
          moving_avg_cost: number
          product_id: string
          qty_on_hand: number
          updated_at: string
        }
        Insert: {
          moving_avg_cost?: number
          product_id: string
          qty_on_hand?: number
          updated_at?: string
        }
        Update: {
          moving_avg_cost?: number
          product_id?: string
          qty_on_hand?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_current_menu"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_product_pricing"
            referencedColumns: ["product_id"]
          },
        ]
      }
      lots: {
        Row: {
          created_at: string
          id: string
          lot_number: string
          notes: string | null
          product_id: string
          received_date: string
          remaining_lbs: number
          unit_cost: number
          vendor_id: string | null
          weight_lbs: number
        }
        Insert: {
          created_at?: string
          id?: string
          lot_number: string
          notes?: string | null
          product_id: string
          received_date?: string
          remaining_lbs: number
          unit_cost: number
          vendor_id?: string | null
          weight_lbs: number
        }
        Update: {
          created_at?: string
          id?: string
          lot_number?: string
          notes?: string | null
          product_id?: string
          received_date?: string
          remaining_lbs?: number
          unit_cost?: number
          vendor_id?: string | null
          weight_lbs?: number
        }
        Relationships: [
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_current_menu"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "lots_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      product_fees: {
        Row: {
          amount_per_lb: number
          fee_type_id: string
          product_id: string
        }
        Insert: {
          amount_per_lb?: number
          fee_type_id: string
          product_id: string
        }
        Update: {
          amount_per_lb?: number
          fee_type_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_fees_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_fees_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_fees_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_current_menu"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_fees_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_pricing"
            referencedColumns: ["product_id"]
          },
        ]
      }
      production_batch_lots: {
        Row: {
          batch_id: string
          id: string
          lbs_consumed: number
          lot_id: string
          lot_unit_cost: number
        }
        Insert: {
          batch_id: string
          id?: string
          lbs_consumed: number
          lot_id: string
          lot_unit_cost: number
        }
        Update: {
          batch_id?: string
          id?: string
          lbs_consumed?: number
          lot_id?: string
          lot_unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_batch_lots_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          batch_number: string
          cost_per_finished_lb: number
          created_at: string
          finished_lbs_out: number
          finished_product_id: string
          id: string
          notes: string | null
          production_date: string
          raw_cost_total: number
          raw_lbs_in: number
          shrink_pct_used: number
        }
        Insert: {
          batch_number: string
          cost_per_finished_lb: number
          created_at?: string
          finished_lbs_out: number
          finished_product_id: string
          id?: string
          notes?: string | null
          production_date?: string
          raw_cost_total: number
          raw_lbs_in: number
          shrink_pct_used: number
        }
        Update: {
          batch_number?: string
          cost_per_finished_lb?: number
          created_at?: string
          finished_lbs_out?: number
          finished_product_id?: string
          id?: string
          notes?: string | null
          production_date?: string
          raw_cost_total?: number
          raw_lbs_in?: number
          shrink_pct_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "v_current_menu"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_batches_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "v_product_pricing"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string | null
          code: string
          created_at: string
          description: string
          id: string
          kind: string
          lbs_per_pack: number | null
          pack_style: string | null
          raw_product_id: string | null
          shrink_pct: number | null
          species: string | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          code: string
          created_at?: string
          description: string
          id?: string
          kind: string
          lbs_per_pack?: number | null
          pack_style?: string | null
          raw_product_id?: string | null
          shrink_pct?: number | null
          species?: string | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          code?: string
          created_at?: string
          description?: string
          id?: string
          kind?: string
          lbs_per_pack?: number | null
          pack_style?: string | null
          raw_product_id?: string | null
          shrink_pct?: number | null
          species?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_raw_product_id_fkey"
            columns: ["raw_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_raw_product_id_fkey"
            columns: ["raw_product_id"]
            isOneToOne: false
            referencedRelation: "v_current_menu"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "products_raw_product_id_fkey"
            columns: ["raw_product_id"]
            isOneToOne: false
            referencedRelation: "v_product_pricing"
            referencedColumns: ["product_id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_per_lb: number
          finished_goods_id: string
          id: string
          lbs_sold: number
          price_per_lb: number
          sale_id: string
        }
        Insert: {
          cost_per_lb: number
          finished_goods_id: string
          id?: string
          lbs_sold: number
          price_per_lb: number
          sale_id: string
        }
        Update: {
          cost_per_lb?: number
          finished_goods_id?: string
          id?: string
          lbs_sold?: number
          price_per_lb?: number
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_finished_goods_id_fkey"
            columns: ["finished_goods_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          sale_date: string
          sale_number: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          sale_date?: string
          sale_number: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          sale_date?: string
          sale_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_current_menu: {
        Row: {
          code: string | null
          description: string | null
          final_price_per_lb: number | null
          finished_lbs_available: number | null
          product_id: string | null
          raw_lbs_available: number | null
          sellable: boolean | null
          species: string | null
        }
        Relationships: []
      }
      v_product_pricing: {
        Row: {
          code: string | null
          cost_per_lb: number | null
          description: string | null
          final_price_per_lb: number | null
          margin_per_lb: number | null
          post_shrink_cost_per_lb: number | null
          processing_fees_per_lb: number | null
          product_id: string | null
          raw_cost_per_lb: number | null
          shrink_pct: number | null
          species: string | null
        }
        Relationships: []
      }
      v_sale_traceability: {
        Row: {
          batch_number: string | null
          finished_code: string | null
          finished_product: string | null
          lbs_sold: number | null
          price_per_lb: number | null
          production_date: string | null
          raw_lbs_from_lot: number | null
          raw_lot: string | null
          raw_lot_cost_per_lb: number | null
          raw_product: string | null
          received_date: string | null
          sale_date: string | null
          sale_number: string | null
          vendor: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      produce_batch: {
        Args: {
          p_batch_number?: string
          p_finished_lbs_out?: number
          p_finished_product_id: string
          p_notes?: string
          p_production_date?: string
          p_raw_lbs_in: number
        }
        Returns: {
          batch_number: string
          cost_per_finished_lb: number
          created_at: string
          finished_lbs_out: number
          finished_product_id: string
          id: string
          notes: string | null
          production_date: string
          raw_cost_total: number
          raw_lbs_in: number
          shrink_pct_used: number
        }
        SetofOptions: {
          from: "*"
          to: "production_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      receive_lot: {
        Args: {
          p_lot_number?: string
          p_notes?: string
          p_product_id: string
          p_received?: string
          p_unit_cost: number
          p_vendor_id: string
          p_weight_lbs: number
        }
        Returns: {
          created_at: string
          id: string
          lot_number: string
          notes: string | null
          product_id: string
          received_date: string
          remaining_lbs: number
          unit_cost: number
          vendor_id: string | null
          weight_lbs: number
        }
        SetofOptions: {
          from: "*"
          to: "lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_sale: {
        Args: {
          p_customer_id?: string
          p_finished_product_id: string
          p_lbs: number
          p_price_per_lb: number
          p_sale_date?: string
          p_sale_number?: string
        }
        Returns: {
          created_at: string
          customer_id: string | null
          id: string
          sale_date: string
          sale_number: string
        }
        SetofOptions: {
          from: "*"
          to: "sales"
          isOneToOne: true
          isSetofReturn: false
        }
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

