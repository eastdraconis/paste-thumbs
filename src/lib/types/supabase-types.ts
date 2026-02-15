export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      meetings: {
        Row: {
          id: string;
          title: string;
          date: string;
          place: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          date: string;
          place?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          date?: string;
          place?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      meeting_members: {
        Row: {
          id: string;
          meeting_id: string;
          name: string;
          status: "참석" | "불참" | "보류";
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          name: string;
          status?: "참석" | "불참" | "보류";
          created_at?: string;
        };
        Update: {
          id?: string;
          meeting_id?: string;
          name?: string;
          status?: "참석" | "불참" | "보류";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meeting_members_meeting_id_fkey";
            columns: ["meeting_id"];
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, {
      Row: Record<string, unknown>;
      Relationships: [];
    }>;
    Functions: Record<string, unknown>;
    Enums: {
      attendance_status: "참석" | "불참" | "보류";
    };
    CompositeTypes: Record<string, unknown>;
  };
};
