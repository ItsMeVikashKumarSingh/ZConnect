-- Migration: Add Standalone Multi-Tenant Chat Schema
-- Target Schema: chat

CREATE SCHEMA IF NOT EXISTS chat;

-- 1. Projects/Tenants (Allows separate websites to use the widget)
CREATE TABLE chat.tbl_projects (
    tp_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tp_client_id uuid, -- Client reference ID from host system (if multi-tenant)
    tp_name character varying(100) NOT NULL,
    tp_domain character varying(255) NOT NULL,
    tp_api_key character varying(100) DEFAULT encode(digest(gen_random_uuid()::text, 'sha256'), 'hex') NOT NULL,
    tp_widget_config jsonb DEFAULT '{
        "primaryColor": "#9333ea",
        "accentColor": "#22d3ee",
        "backgroundColor": "#050510",
        "title": "Help Center",
        "botName": "Virtual Assistant",
        "defaultMode": "faq",
        "allowHandover": true,
        "isDark": true
    }'::jsonb NOT NULL,
    tp_created_at timestamp with time zone DEFAULT now() NOT NULL,
    tp_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tp_status_flag boolean DEFAULT true,
    tp_deleted_flag boolean DEFAULT false
);

-- 2. Frequently Asked Questions (FAQ)
CREATE TABLE chat.tbl_faqs (
    tf_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tf_project_id uuid NOT NULL REFERENCES chat.tbl_projects(tp_id) ON DELETE CASCADE,
    tf_question character varying(255) NOT NULL,
    tf_answer text NOT NULL,
    tf_category character varying(100) DEFAULT 'General'::character varying NOT NULL,
    tf_sort_order integer DEFAULT 0 NOT NULL,
    tf_created_at timestamp with time zone DEFAULT now() NOT NULL,
    tf_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tf_status_flag boolean DEFAULT true,
    tf_deleted_flag boolean DEFAULT false
);

-- 3. Conversations (Tickets generated from human handover)
CREATE TABLE chat.tbl_conversations (
    tc_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tc_project_id uuid NOT NULL REFERENCES chat.tbl_projects(tp_id) ON DELETE CASCADE,
    tc_user_id character varying(100) NOT NULL,
    tc_user_name character varying(255) NOT NULL,
    tc_user_email character varying(255) NOT NULL,
    tc_subject character varying(255) NOT NULL,
    tc_category character varying(50) NOT NULL,
    tc_status character varying(50) DEFAULT 'open'::character varying NOT NULL, -- 'open', 'resolved', 'closed'
    tc_is_priority boolean DEFAULT false NOT NULL,
    tc_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    tc_created_at timestamp with time zone DEFAULT now() NOT NULL,
    tc_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tc_status_flag boolean DEFAULT true,
    tc_deleted_flag boolean DEFAULT false
);

-- 4. Messages (Active chat log)
CREATE TABLE chat.tbl_messages (
    tm_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tm_conversation_id uuid NOT NULL REFERENCES chat.tbl_conversations(tc_id) ON DELETE CASCADE,
    tm_sender_id character varying(100) NOT NULL,
    tm_sender_role character varying(50) NOT NULL, -- 'user', 'client', 'admin'
    tm_message text NOT NULL,
    tm_created_at timestamp with time zone DEFAULT now() NOT NULL,
    tm_status_flag boolean DEFAULT true,
    tm_deleted_flag boolean DEFAULT false
);

-- 5. Canned Responses / Shortcuts
CREATE TABLE chat.tbl_canned_responses (
    tcr_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tcr_project_id uuid NOT NULL REFERENCES chat.tbl_projects(tp_id) ON DELETE CASCADE,
    tcr_shortcut character varying(50) NOT NULL,
    tcr_response text NOT NULL,
    tcr_created_at timestamp with time zone DEFAULT now() NOT NULL,
    tcr_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tcr_status_flag boolean DEFAULT true,
    tcr_deleted_flag boolean DEFAULT false,
    CONSTRAINT unique_shortcut_per_project UNIQUE (tcr_project_id, tcr_shortcut)
);

CREATE INDEX IF NOT EXISTS idx_chat_projects_client ON chat.tbl_projects(tp_client_id);
CREATE INDEX IF NOT EXISTS idx_chat_faqs_project ON chat.tbl_faqs(tf_project_id, tf_category);
CREATE INDEX IF NOT EXISTS idx_chat_convs_lookup ON chat.tbl_conversations(tc_project_id, tc_status);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_conv ON chat.tbl_messages(tm_conversation_id);
