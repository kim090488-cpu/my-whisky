// init_schema.sql 과 동기. 추후 `npx supabase gen types typescript --linked` 으로 자동 생성 교체.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type DistilleryStatus = "active" | "silent" | "closed" | "demolished" | "planned";
export type WhiskyCountry =
  | "scotland" | "ireland" | "usa" | "canada" | "japan" | "india"
  | "taiwan" | "australia" | "france" | "sweden" | "germany"
  | "south_korea" | "other";
export type BottlerKind = "official" | "independent" | "private";
export type CaskType =
  | "bourbon" | "sherry" | "port" | "wine" | "rum"
  | "virgin_oak" | "refill" | "mixed" | "other" | "unknown";
export type CollectionStatus = "owned" | "opened" | "finished" | "wishlist";
export type TastingVisibility = "public" | "followers" | "private";
export type PriceSource = "retail" | "auction" | "secondhand" | "duty_free";
export type ReportTarget = "tasting" | "comment" | "user";
export type ReportReason = "spam" | "abuse" | "false_info" | "copyright" | "other";
export type ReportStatus = "open" | "in_progress" | "resolved" | "dismissed";
export type AdminActionType =
  | "hide_tasting" | "unhide_tasting"
  | "hide_comment" | "unhide_comment"
  | "suspend_user" | "unsuspend_user";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          bio: string | null;
          avatar_url: string | null;
          follower_count: number;
          following_count: number;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          followee_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          followee_id: string;
        };
        Update: never;
      };
      distilleries: {
        Row: {
          id: string;
          name: string;
          country: WhiskyCountry;
          region: string | null;
          status: DistilleryStatus;
          founded_year: number | null;
          closed_year: number | null;
          website: string | null;
          lat: number | null;
          lng: number | null;
          description: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          country: WhiskyCountry;
          region?: string | null;
          status?: DistilleryStatus;
          founded_year?: number | null;
          closed_year?: number | null;
          website?: string | null;
          lat?: number | null;
          lng?: number | null;
          description?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["distilleries"]["Insert"]>;
      };
      bottlings: {
        Row: {
          id: string;
          distillery_id: string;
          name: string;
          age_years: number | null;
          abv: number | null;
          vintage_year: number | null;
          bottling_year: number | null;
          cask_type: CaskType | null;
          bottler: BottlerKind;
          bottler_name: string | null;
          bottle_size_ml: number | null;
          total_bottles: number | null;
          label_image_url: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          distillery_id: string;
          name: string;
          age_years?: number | null;
          abv?: number | null;
          vintage_year?: number | null;
          bottling_year?: number | null;
          cask_type?: CaskType | null;
          bottler?: BottlerKind;
          bottler_name?: string | null;
          bottle_size_ml?: number | null;
          total_bottles?: number | null;
          label_image_url?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bottlings"]["Insert"]>;
      };
      bottling_barcodes: {
        Row: {
          id: string;
          bottling_id: string;
          barcode: string;
          source: "manufacturer" | "importer" | "retailer" | "unknown";
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          bottling_id: string;
          barcode: string;
          source?: "manufacturer" | "importer" | "retailer" | "unknown";
          created_by?: string | null;
        };
        Update: never;
      };
      tasting_likes: {
        Row: {
          id: string;
          tasting_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          tasting_id: string;
          user_id: string;
        };
        Update: never;
      };
      tasting_comments: {
        Row: {
          id: string;
          tasting_id: string;
          user_id: string;
          parent_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          tasting_id: string;
          user_id: string;
          parent_id?: string | null;
          body: string;
        };
        Update: Partial<{ body: string }>;
      };
      tastings: {
        Row: {
          id: string;
          user_id: string;
          bottling_id: string;
          tasted_at: string;
          score: number | null;
          notes: string | null;
          color: string | null;
          photos: string[];
          visibility: TastingVisibility;
          like_count: number;
          comment_count: number;
          created_at: string;
          updated_at: string;
          // v2: verdict 신호
          would_buy_again: boolean | null;
          value_for_money: number | null;
          // flavor wheel (1-10)
          sweetness: number | null;
          smokiness: number | null;
          fruitiness: number | null;
          spiciness: number | null;
          smoothness: number | null;
          complexity: number | null;
          finish_length: number | null;
        };
        Insert: {
          user_id: string;
          bottling_id: string;
          tasted_at?: string;
          score?: number | null;
          notes?: string | null;
          color?: string | null;
          photos?: string[];
          visibility?: TastingVisibility;
          would_buy_again?: boolean | null;
          value_for_money?: number | null;
          sweetness?: number | null;
          smokiness?: number | null;
          fruitiness?: number | null;
          spiciness?: number | null;
          smoothness?: number | null;
          complexity?: number | null;
          finish_length?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["tastings"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: "like" | "comment" | "follow";
          actor_id: string | null;
          target_table: string | null;
          target_id: string | null;
          payload: Json | null;
          read_at: string | null;
          sent_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: never;
        Update: Partial<{ read_at: string | null }>;
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          expo_push_token: string;
          platform: "ios" | "android" | "web" | null;
          device_label: string | null;
          enabled: boolean;
          last_seen_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          expo_push_token: string;
          platform?: "ios" | "android" | "web" | null;
          device_label?: string | null;
          enabled?: boolean;
        };
        Update: Partial<{ enabled: boolean; last_seen_at: string; device_label: string | null }>;
      };
      admin_actions: {
        Row: {
          id: string;
          admin_id: string;
          action: AdminActionType;
          target_table: string | null;
          target_id: string | null;
          related_report_id: string | null;
          reason: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          admin_id: string;
          action: AdminActionType;
          target_table?: string | null;
          target_id?: string | null;
          related_report_id?: string | null;
          reason?: string | null;
          metadata?: Json | null;
        };
        Update: never;
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_table: ReportTarget;
          target_id: string;
          reason: ReportReason;
          body: string | null;
          status: ReportStatus;
          resolved_by: string | null;
          resolved_at: string | null;
          resolution_note: string | null;
          created_at: string;
        };
        Insert: {
          reporter_id: string;
          target_table: ReportTarget;
          target_id: string;
          reason: ReportReason;
          body?: string | null;
        };
        Update: Partial<{
          status: ReportStatus;
          resolved_by: string | null;
          resolved_at: string | null;
          resolution_note: string | null;
        }>;
      };
      bottling_images: {
        Row: {
          id: string;
          bottling_id: string;
          storage_path: string;
          caption: string | null;
          sort_order: number;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          bottling_id: string;
          storage_path: string;
          caption?: string | null;
          sort_order?: number;
          uploaded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bottling_images"]["Insert"]>;
      };
      price_records: {
        Row: {
          id: string;
          bottling_id: string;
          user_id: string | null;
          price: number;
          currency: string;
          source: PriceSource;
          source_url: string | null;
          place: string | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          bottling_id: string;
          user_id: string;
          price: number;
          currency?: string;
          source?: PriceSource;
          source_url?: string | null;
          place?: string | null;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["price_records"]["Insert"]>;
      };
      collection_items: {
        Row: {
          id: string;
          user_id: string;
          bottling_id: string;
          status: CollectionStatus;
          quantity: number;
          purchase_price: number | null;
          purchase_currency: string | null;
          purchase_date: string | null;
          purchase_place: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          bottling_id: string;
          status?: CollectionStatus;
          quantity?: number;
          purchase_price?: number | null;
          purchase_currency?: string | null;
          purchase_date?: string | null;
          purchase_place?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["collection_items"]["Insert"]>;
      };
    };
    Views: {
      bottling_card_stats: {
        Row: {
          id: string;
          distillery_id: string;
          name: string;
          age_years: number | null;
          abv: number | null;
          cask_type: CaskType | null;
          bottler: BottlerKind;
          label_image_url: string | null;
          created_at: string;
          distillery_name: string;
          country: WhiskyCountry;
          region: string | null;
          distillery_status: DistilleryStatus;
          avg_score: number | null;
          tasting_count: number;
        };
        Insert: never;
        Update: never;
      };
      trending_tastings: {
        Row: {
          id: string;
          bottling_id: string;
          user_id: string;
          score: number | null;
          tasted_at: string;
          like_count: number;
          comment_count: number;
          notes: string | null;
          visibility: TastingVisibility;
          recent_likes: number;
        };
        Insert: never;
        Update: never;
      };
      top_reviewers: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          follower_count: number;
          public_note_count: number;
          total_likes_received: number;
          avg_score: number | null;
        };
        Insert: never;
        Update: never;
      };
      popular_distilleries: {
        Row: {
          id: string;
          name: string;
          country: WhiskyCountry;
          region: string | null;
          status: DistilleryStatus;
          note_count: number;
          avg_score: number | null;
          bottling_count: number;
        };
        Insert: never;
        Update: never;
      };
    };
    Functions: Record<string, never>;
    Enums: {
      distillery_status: DistilleryStatus;
      whisky_country: WhiskyCountry;
      bottler_kind: BottlerKind;
      cask_type: CaskType;
      collection_status: CollectionStatus;
      tasting_visibility: TastingVisibility;
    };
  };
}
