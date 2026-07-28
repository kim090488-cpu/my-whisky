// init_schema.sql + 마이그레이션 동기. `supabase gen types typescript --linked`로 재생성 대체 가능.
// @supabase/postgrest-js v2 요구사항: 각 Table에 Relationships: [] + Views 최상위 분리 필수 (없으면 select 결과가 never로 추론).

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
export type PostVisibility = "public" | "followers" | "private";
export type RecommendedForKind = "beginner" | "intermediate" | "expert" | "gift";
export type PriceSource = "retail" | "auction" | "secondhand" | "duty_free";
export type ReportTarget = "tasting" | "comment" | "user" | "bottling";
export type ReportReason = "spam" | "abuse" | "false_info" | "copyright" | "other";
export type ReportStatus = "open" | "in_progress" | "resolved" | "dismissed";
export type AdminActionType =
  | "hide_tasting" | "unhide_tasting"
  | "hide_comment" | "unhide_comment"
  | "suspend_user" | "unsuspend_user";
export type CommunityCategory = "question" | "recommendation" | "tip" | "free";

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
          notify_like: boolean;
          notify_comment: boolean;
          notify_follow: boolean;
          suspended_at: string | null;
          suspended_until: string | null;
          suspension_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          notify_like?: boolean;
          notify_comment?: boolean;
          notify_follow?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]> & {
          suspended_at?: string | null;
          suspended_until?: string | null;
          suspension_reason?: string | null;
        };
        Relationships: [];
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
        Update: Partial<Database["public"]["Tables"]["follows"]["Insert"]>;
        Relationships: [];
      };
      distilleries: {
        Row: {
          id: string;
          name: string;
          name_kr: string | null;
          country: WhiskyCountry;
          region: string | null;
          status: DistilleryStatus;
          founded_year: number | null;
          closed_year: number | null;
          website: string | null;
          lat: number | null;
          lng: number | null;
          description: string | null;
          whiskyhunter_slug: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          name_kr?: string | null;
          country: WhiskyCountry;
          region?: string | null;
          status?: DistilleryStatus;
          founded_year?: number | null;
          closed_year?: number | null;
          website?: string | null;
          lat?: number | null;
          lng?: number | null;
          description?: string | null;
          whiskyhunter_slug?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["distilleries"]["Insert"]>;
        Relationships: [];
      };
      currency_rates: {
        Row: {
          code: string;
          krw_per_unit: number;
          fetched_at: string;
        };
        Insert: {
          code: string;
          krw_per_unit: number;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["currency_rates"]["Insert"]>;
        Relationships: [];
      };
      bottling_external_reviews: {
        Row: {
          bottling_id: string;
          source: string;
          external_slug: string;
          source_url: string | null;
          reviewer_a_name: string | null;
          reviewer_a_score: number | null;
          reviewer_b_name: string | null;
          reviewer_b_score: number | null;
          nose: string | null;
          palate: string | null;
          finish: string | null;
          conclusion_a: string | null;
          conclusion_b: string | null;
          price_per_liter: number | null;
          price_currency: string | null;
          flavour: string | null;
          image_url: string | null;
          fetched_at: string;
        };
        Insert: {
          bottling_id: string;
          source: string;
          external_slug: string;
          source_url?: string | null;
          reviewer_a_name?: string | null;
          reviewer_a_score?: number | null;
          reviewer_b_name?: string | null;
          reviewer_b_score?: number | null;
          nose?: string | null;
          palate?: string | null;
          finish?: string | null;
          conclusion_a?: string | null;
          conclusion_b?: string | null;
          price_per_liter?: number | null;
          price_currency?: string | null;
          flavour?: string | null;
          image_url?: string | null;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bottling_external_reviews"]["Insert"]>;
        Relationships: [];
      };
      distillery_auction_stats: {
        Row: {
          distillery_id: string;
          dt: string;
          source: string;
          winning_bid_mean: number | null;
          winning_bid_min: number | null;
          winning_bid_max: number | null;
          trading_volume: number | null;
          lots_count: number | null;
          fetched_at: string;
        };
        Insert: {
          distillery_id: string;
          dt: string;
          source?: string;
          winning_bid_mean?: number | null;
          winning_bid_min?: number | null;
          winning_bid_max?: number | null;
          trading_volume?: number | null;
          lots_count?: number | null;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["distillery_auction_stats"]["Insert"]>;
        Relationships: [];
      };
      bottlings: {
        Row: {
          id: string;
          distillery_id: string;
          name: string;
          name_kr: string | null;
          age_years: number | null;
          abv: number | null;
          vintage_year: number | null;
          bottling_year: number | null;
          cask_type: CaskType | null;
          bottler: BottlerKind;
          bottler_name: string | null;
          bottle_size_ml: number | null;
          total_bottles: number | null;
          barcode: string | null;
          label_image_url: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          distillery_id: string;
          name: string;
          name_kr?: string | null;
          age_years?: number | null;
          abv?: number | null;
          vintage_year?: number | null;
          bottling_year?: number | null;
          cask_type?: CaskType | null;
          bottler?: BottlerKind;
          bottler_name?: string | null;
          bottle_size_ml?: number | null;
          total_bottles?: number | null;
          barcode?: string | null;
          label_image_url?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bottlings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "bottlings_distillery_id_fkey";
            columns: ["distillery_id"];
            isOneToOne: false;
            referencedRelation: "distilleries";
            referencedColumns: ["id"];
          },
        ];
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
        Update: Partial<Database["public"]["Tables"]["tasting_likes"]["Insert"]>;
        Relationships: [];
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
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
        };
        Insert: {
          tasting_id: string;
          user_id: string;
          parent_id?: string | null;
          body: string;
        };
        Update: Partial<{
          body: string;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
        }>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          body: string | null;
          photos: string[];
          visibility: PostVisibility;
          bottling_id: string | null;
          location_name: string | null;
          like_count: number;
          comment_count: number;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          body?: string | null;
          photos?: string[];
          visibility?: PostVisibility;
          bottling_id?: string | null;
          location_name?: string | null;
          tags?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [];
      };
      post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_likes"]["Insert"]>;
        Relationships: [];
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          parent_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          parent_id?: string | null;
          body: string;
        };
        Update: Partial<{ body: string }>;
        Relationships: [];
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
          would_buy_again: boolean | null;
          value_for_money: number | null;
          recommended_for: RecommendedForKind[] | null;
          sweetness: number | null;
          smokiness: number | null;
          fruitiness: number | null;
          spiciness: number | null;
          smoothness: number | null;
          complexity: number | null;
          finish_length: number | null;
          purchase_price: number | null;
          purchase_currency: string | null;
          purchase_country: string | null;
          purchased_at_place: string | null;
          bottle_owned_verified: boolean;
          food_pairing: string | null;
          tags: string[];
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
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
          recommended_for?: RecommendedForKind[] | null;
          sweetness?: number | null;
          smokiness?: number | null;
          fruitiness?: number | null;
          spiciness?: number | null;
          smoothness?: number | null;
          complexity?: number | null;
          finish_length?: number | null;
          purchase_price?: number | null;
          purchase_currency?: string | null;
          purchase_country?: string | null;
          purchased_at_place?: string | null;
          bottle_owned_verified?: boolean;
          food_pairing?: string | null;
          tags?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["tastings"]["Insert"]> & {
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
        };
        Relationships: [];
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
        Insert: {
          user_id: string;
          kind: "like" | "comment" | "follow";
          actor_id?: string | null;
          target_table?: string | null;
          target_id?: string | null;
          payload?: Json | null;
        };
        Update: Partial<{ read_at: string | null }>;
        Relationships: [];
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
        Relationships: [];
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
        Update: Partial<Database["public"]["Tables"]["admin_actions"]["Insert"]>;
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: "collection_items_bottling_id_fkey";
            columns: ["bottling_id"];
            isOneToOne: false;
            referencedRelation: "bottlings";
            referencedColumns: ["id"];
          },
        ];
      };
      // ── 2026-07-04 이후 추가 테이블 ──
      bottling_edits: {
        Row: {
          id: string;
          bottling_id: string;
          edited_by: string | null;
          edited_at: string;
          before: Json;
          like_count: number;
          report_count: number;
        };
        Insert: never; // 트리거로만 insert
        Update: never;
        Relationships: [];
      };
      bottling_edit_likes: {
        Row: {
          id: string;
          edit_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          edit_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["bottling_edit_likes"]["Insert"]>;
        Relationships: [];
      };
      bottling_edit_reports: {
        Row: {
          id: string;
          edit_id: string;
          user_id: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          edit_id: string;
          user_id: string;
          reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bottling_edit_reports"]["Insert"]>;
        Relationships: [];
      };
      // ── 2026-07-25 이후 추가 테이블 (커뮤니티·차단·뱃지) ──
      community_posts: {
        Row: {
          id: string;
          user_id: string;
          category: CommunityCategory;
          title: string;
          body: string;
          like_count: number;
          comment_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          category?: CommunityCategory;
          title: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_posts"]["Insert"]>;
        Relationships: [];
      };
      community_post_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          body: string;
        };
        Update: Partial<{ body: string }>;
        Relationships: [];
      };
      community_post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_post_likes"]["Insert"]>;
        Relationships: [];
      };
      user_blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_blocks"]["Insert"]>;
        Relationships: [];
      };
      user_badges: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          earned_at: string;
        };
        Insert: {
          user_id: string;
          code: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_badges"]["Insert"]>;
        Relationships: [];
      };
      // ── 2026-07-29 AI 큐레이터 대화 이력 ──
      curator_messages: {
        Row: {
          id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          matches: Json | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: "user" | "assistant";
          content: string;
          matches?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["curator_messages"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      bottling_card_stats: {
        Row: {
          id: string;
          distillery_id: string;
          name: string;
          name_kr: string | null;
          age_years: number | null;
          abv: number | null;
          cask_type: CaskType | null;
          bottler: BottlerKind;
          label_image_url: string | null;
          created_at: string;
          distillery_name: string;
          distillery_name_kr: string | null;
          country: WhiskyCountry;
          region: string | null;
          distillery_status: DistilleryStatus;
          avg_score: number | null;
          tasting_count: number;
          avg_value_for_money: number | null;
          buy_again_pct: number | null;
        };
        Relationships: [];
      };
      bottling_verdict_stats: {
        Row: {
          bottling_id: string;
          total_reviews: number;
          buy_again_responses: number;
          buy_again_yes: number;
          avg_value_for_money: number | null;
          recommended_for_counts: {
            beginner: number;
            intermediate: number;
            expert: number;
            gift: number;
          } | null;
          avg_sweetness: number | null;
          avg_smokiness: number | null;
          avg_fruitiness: number | null;
          avg_spiciness: number | null;
          avg_smoothness: number | null;
          avg_complexity: number | null;
          avg_finish_length: number | null;
          median_price_krw: number | null;
          price_data_count: number;
          avg_score: number | null;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      popular_distilleries: {
        Row: {
          id: string;
          name: string;
          name_kr: string | null;
          country: WhiskyCountry;
          region: string | null;
          status: DistilleryStatus;
          note_count: number;
          avg_score: number | null;
          bottling_count: number;
        };
        Relationships: [];
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
      post_visibility: PostVisibility;
      recommended_for_kind: RecommendedForKind;
      community_category: CommunityCategory;
    };
    CompositeTypes: Record<string, never>;
  };
}
