// Hand-written to match the exact schema supplied for this project (see the
// `create table` statements this was generated from). Foreign keys to
// auth.users are intentionally omitted from each table's Relationships array,
// matching what `supabase gen types typescript --schema public` produces —
// auth.users lives outside the public schema this type describes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          partner_id: string | null
          onboarded_at: string | null
          mascot: 'raccoon' | 'goldfish' | null
          last_open_at: string | null
          reunion_date: string | null
        }
        Insert: {
          id: string
          display_name: string
          partner_id?: string | null
          onboarded_at?: string | null
          mascot?: 'raccoon' | 'goldfish' | null
          last_open_at?: string | null
          reunion_date?: string | null
        }
        Update: {
          id?: string
          display_name?: string
          partner_id?: string | null
          onboarded_at?: string | null
          mascot?: 'raccoon' | 'goldfish' | null
          last_open_at?: string | null
          reunion_date?: string | null
        }
        Relationships: []
      }
      films: {
        Row: {
          id: string
          media_type: 'movie' | 'tv'
          title: string
          year: number | null
          runtime: number | null
          overview: string | null
          poster_path: string | null
          backdrop_path: string | null
          original_language: string | null
          genres: string[] | null
          vote_average: number | null
          trailer_key: string | null
          top_cast: Json | null
          directors: Json | null
          countries: string[] | null
          providers: Json | null
          providers_at: string | null
          enriched_at: string | null
          letterboxd_uri: string | null
        }
        Insert: {
          id: string
          media_type: 'movie' | 'tv'
          title: string
          letterboxd_uri?: string | null
          year?: number | null
          runtime?: number | null
          overview?: string | null
          poster_path?: string | null
          backdrop_path?: string | null
          original_language?: string | null
          genres?: string[] | null
          vote_average?: number | null
          trailer_key?: string | null
          top_cast?: Json | null
          directors?: Json | null
          countries?: string[] | null
          providers?: Json | null
          providers_at?: string | null
          enriched_at?: string | null
        }
        Update: {
          id?: string
          media_type?: 'movie' | 'tv'
          title?: string
          letterboxd_uri?: string | null
          year?: number | null
          runtime?: number | null
          overview?: string | null
          poster_path?: string | null
          backdrop_path?: string | null
          original_language?: string | null
          genres?: string[] | null
          vote_average?: number | null
          trailer_key?: string | null
          top_cast?: Json | null
          directors?: Json | null
          countries?: string[] | null
          providers?: Json | null
          providers_at?: string | null
          enriched_at?: string | null
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          id: string
          user_id: string
          film_id: string
          source: string
          letterboxd_uri: string | null
          added_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          film_id: string
          source?: string
          letterboxd_uri?: string | null
          added_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          film_id?: string
          source?: string
          letterboxd_uri?: string | null
          added_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'watchlist_items_film_id_fkey'
            columns: ['film_id']
            isOneToOne: false
            referencedRelation: 'films'
            referencedColumns: ['id']
          },
        ]
      }
      recommendations: {
        Row: {
          id: string
          from_user: string
          to_user: string
          film_id: string
          note: string | null
          status: 'queued' | 'passed' | 'watched'
          seen: boolean
          created_at: string | null
          responded_at: string | null
        }
        Insert: {
          id?: string
          from_user: string
          to_user: string
          film_id: string
          note?: string | null
          status?: 'queued' | 'passed' | 'watched'
          seen?: boolean
          created_at?: string | null
          responded_at?: string | null
        }
        Update: {
          id?: string
          from_user?: string
          to_user?: string
          film_id?: string
          note?: string | null
          status?: 'queued' | 'passed' | 'watched'
          seen?: boolean
          created_at?: string | null
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'recommendations_film_id_fkey'
            columns: ['film_id']
            isOneToOne: false
            referencedRelation: 'films'
            referencedColumns: ['id']
          },
        ]
      }
      shared_list_items: {
        Row: {
          id: string
          film_id: string
          added_by: string
          added_at: string | null
        }
        Insert: {
          id?: string
          film_id: string
          added_by: string
          added_at?: string | null
        }
        Update: {
          id?: string
          film_id?: string
          added_by?: string
          added_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'shared_list_items_film_id_fkey'
            columns: ['film_id']
            isOneToOne: true
            referencedRelation: 'films'
            referencedColumns: ['id']
          },
        ]
      }
      spins: {
        Row: {
          id: string
          user_id: string
          film_id: string | null
          filters: Json | null
          outcome: 'watched' | 'rerolled' | 'removed' | 'abandoned' | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          film_id?: string | null
          filters?: Json | null
          outcome?: 'watched' | 'rerolled' | 'removed' | 'abandoned' | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          film_id?: string | null
          filters?: Json | null
          outcome?: 'watched' | 'rerolled' | 'removed' | 'abandoned' | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'spins_film_id_fkey'
            columns: ['film_id']
            isOneToOne: false
            referencedRelation: 'films'
            referencedColumns: ['id']
          },
        ]
      }
      watched: {
        Row: {
          id: string
          user_id: string
          film_id: string
          rating: number | null
          watched_on: string | null
          together: boolean | null
          picked_by: string | null
          source: string
          prev_added_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          film_id: string
          rating?: number | null
          watched_on?: string | null
          together?: boolean | null
          picked_by?: string | null
          source?: string
          prev_added_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          film_id?: string
          rating?: number | null
          watched_on?: string | null
          together?: boolean | null
          picked_by?: string | null
          source?: string
          prev_added_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'watched_film_id_fkey'
            columns: ['film_id']
            isOneToOne: false
            referencedRelation: 'films'
            referencedColumns: ['id']
          },
        ]
      }
      custom_wheels: {
        Row: {
          id: string
          user_id: string
          name: string
          shared: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          shared?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          shared?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      custom_wheel_items: {
        Row: {
          id: string
          wheel_id: string
          film_id: string
          added_at: string | null
        }
        Insert: {
          id?: string
          wheel_id: string
          film_id: string
          added_at?: string | null
        }
        Update: {
          id?: string
          wheel_id?: string
          film_id?: string
          added_at?: string | null
        }
        Relationships: []
      }
      filter_presets: {
        Row: {
          id: string
          user_id: string
          name: string
          filters: Json
          created_at: string | null
          starred_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          filters: Json
          created_at?: string | null
          starred_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          filters?: Json
          created_at?: string | null
          starred_at?: string | null
        }
        Relationships: []
      }
      nudges: {
        Row: {
          from_user: string
          to_user: string
          message: string
          dismissed: boolean
          created_at: string | null
          on_splash: boolean
        }
        Insert: {
          from_user: string
          to_user: string
          message: string
          dismissed?: boolean
          created_at?: string | null
          on_splash?: boolean
        }
        Update: {
          from_user?: string
          to_user?: string
          message?: string
          dismissed?: boolean
          created_at?: string | null
          on_splash?: boolean
        }
        Relationships: []
      }
      events: {
        Row: {
          id: number
          user_id: string
          type: string
          film_id: string | null
          detail: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          // Defaults to auth.uid() in the database.
          user_id?: string
          type: string
          film_id?: string | null
          detail?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          type?: string
          film_id?: string | null
          detail?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          user_id: string
          key: string
          reached_at: string
          detail: Json | null
          seen_at: string | null
          created_at: string
        }
        Insert: {
          user_id?: string
          key: string
          reached_at: string
          detail?: Json | null
          seen_at?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          key?: string
          reached_at?: string
          detail?: Json | null
          seen_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      wrapped_gifts: {
        Row: {
          from_user: string
          to_user: string
          year: number
          track_path: string | null
          track_title: string | null
          track_at: string | null
          message_path: string | null
          message_at: string | null
        }
        Insert: {
          from_user?: string
          to_user: string
          year: number
          track_path?: string | null
          track_title?: string | null
          track_at?: string | null
          message_path?: string | null
          message_at?: string | null
        }
        Update: {
          from_user?: string
          to_user?: string
          year?: number
          track_path?: string | null
          track_title?: string | null
          track_at?: string | null
          message_path?: string | null
          message_at?: string | null
        }
        Relationships: []
      }
      splash_lines: {
        Row: {
          from_user: string
          to_user: string
          line: string
          set_at: string
        }
        Insert: {
          from_user: string
          to_user: string
          line: string
          set_at?: string
        }
        Update: {
          from_user?: string
          to_user?: string
          line?: string
          set_at?: string
        }
        Relationships: []
      }
      imports: {
        Row: {
          id: string
          user_id: string
          filename: string | null
          rows_in_file: number | null
          added: number | null
          vanished: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          filename?: string | null
          rows_in_file?: number | null
          added?: number | null
          vanished?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string | null
          rows_in_file?: number | null
          added?: number | null
          vanished?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      /**
       * Truth or dare, as played: readable by the two of us, written only
       * through draw_card, answer_turn, pass_turn, react_turn and
       * td_mark_seen. The cards themselves (td_cards) are deliberately
       * absent from these types: that table is not readable and must never
       * be queried.
       */
      td_turns: {
        Row: {
          id: string
          drawn_by: string
          player: string
          partner: string
          mode: 'in_person' | 'virtual'
          deck: 'serious' | 'funny' | 'flirty' | 'spicy'
          kind: 'truth' | 'dare'
          card_id: string | null
          prompt: string
          status: 'open' | 'answered' | 'passed'
          answer_text: string | null
          answer_photo: string | null
          answered_at: string | null
          reaction: string | null
          reacted_at: string | null
          seen_at: string | null
          created_at: string
        }
        // Never inserted or updated directly.
        Insert: Record<never, never>
        Update: Record<never, never>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      /**
       * Security definer, one film at a time. It answers a single yes/no
       * about a film already chosen — it is not a way to read, browse or
       * enumerate the other person's history, and must never be called in
       * a loop over a list.
       */
      partner_has_watched: {
        Args: { p_film_id: string }
        Returns: boolean
      }
      /**
       * Stamps profiles.last_open_at with the database clock and hands
       * back what it was before, in one step.
       */
      /**
       * Security definer. Whether the other person has left me anything
       * for this year's Wrapped — yes or no, never what.
       */
      gift_waiting: {
        Args: { p_year: number }
        Returns: boolean
      }
      /**
       * Sets (or, with null, clears) the reunion date on my profile and
       * my partner's together, so whoever sets it sets it for both.
       */
      set_reunion_date: {
        Args: { p_date: string | null }
        Returns: undefined
      }
      /**
       * Security definer. Draws one card I haven't drawn since my last
       * reset of that deck and kind, and opens a turn with it. No row back
       * means that deck and kind have run out for me.
       */
      draw_card: {
        Args: { p_deck: string; p_kind: string; p_mode: string; p_player?: string }
        Returns: Database['public']['Tables']['td_turns']['Row'][]
      }
      answer_turn: {
        Args: { p_turn: string; p_text: string | null; p_photo?: string | null }
        Returns: Database['public']['Tables']['td_turns']['Row']
      }
      pass_turn: {
        Args: { p_turn: string }
        Returns: Database['public']['Tables']['td_turns']['Row']
      }
      react_turn: {
        Args: { p_turn: string; p_reaction: string }
        Returns: Database['public']['Tables']['td_turns']['Row']
      }
      td_mark_seen: {
        Args: { p_turns: string[] }
        Returns: undefined
      }
      /** Reshuffles one deck and kind for me alone; how many came back. */
      reset_deck: {
        Args: { p_deck: string; p_kind: string }
        Returns: number
      }
      touch_last_open: {
        Args: Record<string, never>
        Returns: string | null
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
