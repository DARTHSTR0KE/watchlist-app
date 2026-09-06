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
        }
        Insert: {
          id: string
          display_name: string
          partner_id?: string | null
        }
        Update: {
          id?: string
          display_name?: string
          partner_id?: string | null
        }
        Relationships: []
      }
      films: {
        Row: {
          id: number
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
          providers: Json | null
          providers_at: string | null
          enriched_at: string | null
        }
        Insert: {
          id: number
          media_type: 'movie' | 'tv'
          title: string
          year?: number | null
          runtime?: number | null
          overview?: string | null
          poster_path?: string | null
          backdrop_path?: string | null
          original_language?: string | null
          genres?: string[] | null
          vote_average?: number | null
          trailer_key?: string | null
          providers?: Json | null
          providers_at?: string | null
          enriched_at?: string | null
        }
        Update: {
          id?: number
          media_type?: 'movie' | 'tv'
          title?: string
          year?: number | null
          runtime?: number | null
          overview?: string | null
          poster_path?: string | null
          backdrop_path?: string | null
          original_language?: string | null
          genres?: string[] | null
          vote_average?: number | null
          trailer_key?: string | null
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
          film_id: number
          source: string
          letterboxd_uri: string | null
          added_at: string | null
          on_wheel: boolean
        }
        Insert: {
          id?: string
          user_id: string
          film_id: number
          source?: string
          letterboxd_uri?: string | null
          added_at?: string | null
          on_wheel?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          film_id?: number
          source?: string
          letterboxd_uri?: string | null
          added_at?: string | null
          on_wheel?: boolean
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
          film_id: number
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
          film_id: number
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
          film_id?: number
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
          film_id: number
          added_by: string
          added_at: string | null
        }
        Insert: {
          id?: string
          film_id: number
          added_by: string
          added_at?: string | null
        }
        Update: {
          id?: string
          film_id?: number
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
          film_id: number | null
          filters: Json | null
          outcome: 'watched' | 'rerolled' | 'removed' | 'abandoned' | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          film_id?: number | null
          filters?: Json | null
          outcome?: 'watched' | 'rerolled' | 'removed' | 'abandoned' | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          film_id?: number | null
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
          film_id: number
          rating: number | null
          watched_on: string | null
          together: boolean
          picked_by: string | null
          source: string
        }
        Insert: {
          id?: string
          user_id: string
          film_id: number
          rating?: number | null
          watched_on?: string | null
          together?: boolean
          picked_by?: string | null
          source?: string
        }
        Update: {
          id?: string
          user_id?: string
          film_id?: number
          rating?: number | null
          watched_on?: string | null
          together?: boolean
          picked_by?: string | null
          source?: string
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
      filter_presets: {
        Row: {
          id: string
          user_id: string
          name: string
          filters: Json
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          filters: Json
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          filters?: Json
          created_at?: string | null
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
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
