// Generated from the local public schema with Supabase CLI 3.0.0.
export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    "public": {
        Tables: {
            "cities": {
                Row: {
                    "created_at": string;
                    "created_by": string;
                    "id": string;
                    "invite_token": string;
                    "name": string;
                    "seed": number;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "created_by": string;
                    "id"?: string;
                    "invite_token"?: string;
                    "name": string;
                    "seed"?: number;
                };
                Update: {
                    "created_at"?: string;
                    "created_by"?: string;
                    "id"?: string;
                    "invite_token"?: string;
                    "name"?: string;
                    "seed"?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "cities_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "city_members": {
                Row: {
                    "city_id": string;
                    "role": Database["public"]['Enums']["city_role"];
                    "seat": number;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "city_id": string;
                    "role": Database["public"]['Enums']["city_role"];
                    "seat": number;
                    "user_id": string;
                };
                Update: {
                    "city_id"?: string;
                    "role"?: Database["public"]['Enums']["city_role"];
                    "seat"?: number;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "city_members_city_id_fkey";
                        columns: [
                            "city_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "cities";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "city_members_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "city_objects": {
                Row: {
                    "cell_x": number;
                    "cell_z": number;
                    "city_id": string;
                    "id": string;
                    "rotation": number;
                    "size": Database["public"]['Enums']["task_size"];
                    "stage": Database["public"]['Enums']["object_stage"];
                    "task_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "cell_x": number;
                    "cell_z": number;
                    "city_id": string;
                    "id"?: string;
                    "rotation"?: number;
                    "size": Database["public"]['Enums']["task_size"];
                    "stage"?: Database["public"]['Enums']["object_stage"];
                    "task_id": string;
                };
                Update: {
                    "cell_x"?: number;
                    "cell_z"?: number;
                    "city_id"?: string;
                    "id"?: string;
                    "rotation"?: number;
                    "size"?: Database["public"]['Enums']["task_size"];
                    "stage"?: Database["public"]['Enums']["object_stage"];
                    "task_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "city_objects_city_id_task_id_size_fkey";
                        columns: [
                            "city_id",
                            "task_id",
                            "size"
                        ];
                        isOneToOne: false;
                        referencedRelation: "team_tasks";
                        referencedColumns: [
                            "city_id",
                            "id",
                            "size"
                        ];
                    }
                ];
            };
            "personal_tasks": {
                Row: {
                    "created_at": string;
                    "id": string;
                    "owner_id": string;
                    "status": Database["public"]['Enums']["task_status"];
                    "title": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "id"?: string;
                    "owner_id"?: string;
                    "status"?: Database["public"]['Enums']["task_status"];
                    "title": string;
                };
                Update: {
                    "created_at"?: string;
                    "id"?: string;
                    "owner_id"?: string;
                    "status"?: Database["public"]['Enums']["task_status"];
                    "title"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "personal_tasks_owner_id_fkey";
                        columns: [
                            "owner_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "profiles": {
                Row: {
                    "avatar": NonNullable<Json>;
                    "display_name": string;
                    "id": string;
                };
                ComputedFields: never;
                Insert: {
                    "avatar"?: NonNullable<Json>;
                    "display_name"?: string;
                    "id": string;
                };
                Update: {
                    "avatar"?: NonNullable<Json>;
                    "display_name"?: string;
                    "id"?: string;
                };
                Relationships: [
                ];
            };
            "task_assignees": {
                Row: {
                    "city_id": string;
                    "task_id": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "city_id": string;
                    "task_id": string;
                    "user_id": string;
                };
                Update: {
                    "city_id"?: string;
                    "task_id"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "task_assignees_city_id_task_id_fkey";
                        columns: [
                            "city_id",
                            "task_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "team_tasks";
                        referencedColumns: [
                            "city_id",
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "task_assignees_city_id_user_id_fkey";
                        columns: [
                            "city_id",
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "city_members";
                        referencedColumns: [
                            "city_id",
                            "user_id"
                        ];
                    }
                ];
            };
            "team_tasks": {
                Row: {
                    "city_id": string;
                    "closed_at": string | null;
                    "description": string;
                    "due_on": string;
                    "id": string;
                    "size": Database["public"]['Enums']["task_size"];
                    "status": Database["public"]['Enums']["task_status"];
                    "title": string;
                };
                ComputedFields: never;
                Insert: {
                    "city_id": string;
                    "closed_at"?: string | null;
                    "description"?: string;
                    "due_on": string;
                    "id"?: string;
                    "size": Database["public"]['Enums']["task_size"];
                    "status"?: Database["public"]['Enums']["task_status"];
                    "title": string;
                };
                Update: {
                    "city_id"?: string;
                    "closed_at"?: string | null;
                    "description"?: string;
                    "due_on"?: string;
                    "id"?: string;
                    "size"?: Database["public"]['Enums']["task_size"];
                    "status"?: Database["public"]['Enums']["task_status"];
                    "title"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "team_tasks_city_id_fkey";
                        columns: [
                            "city_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "cities";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            "create_city": {
                Args: {
                    "p_name": string;
                };
                Returns: string;
            };
            "create_team_task": {
                Args: {
                    "p_assignee_ids"?: (string)[];
                    "p_city_id": string;
                    "p_description"?: string;
                    "p_due_on": string;
                    "p_size": Database["public"]['Enums']["task_size"];
                    "p_title": string;
                };
                Returns: string;
            };
            "get_city_invite": {
                Args: {
                    "p_city_id": string;
                };
                Returns: string;
            };
            "join_city": {
                Args: {
                    "p_invite_token": string;
                };
                Returns: string;
            };
            "set_task_status": {
                Args: {
                    "p_status": Database["public"]['Enums']["task_status"];
                    "p_task_id": string;
                };
                Returns: undefined;
            };
        };
        Enums: {
            "city_role": "leader" | "member" | "guest";
            "object_stage": "foundation" | "construction" | "complete";
            "task_size": "S" | "M" | "L";
            "task_status": "todo" | "in_progress" | "done";
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
    Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
    schema: keyof DatabaseWithoutInternals;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
    schema: keyof DatabaseWithoutInternals;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export const Constants = {
    "public": {
        Enums: {
            "city_role": ["leader", "member", "guest"], "object_stage": ["foundation", "construction", "complete"], "task_size": ["S", "M", "L"], "task_status": ["todo", "in_progress", "done"]
        }
    }
} as const;
