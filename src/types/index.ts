export interface WidgetConfig {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  title: string;
  botName: string;
  defaultMode: 'faq' | 'chat';
  allowHandover: boolean;
  isDark: boolean;
  placeholder?: string;
}

export interface Project {
  tp_id: string;
  tp_client_id: string | null;
  tp_name: string;
  tp_domain: string;
  tp_api_key: string;
  tp_widget_config: WidgetConfig;
  tp_created_at: string;
  tp_updated_at: string;
  tp_status_flag: boolean;
  tp_deleted_flag: boolean;
}

export interface FAQ {
  tf_id: string;
  tf_project_id: string;
  tf_question: string;
  tf_answer: string;
  tf_category: string;
  tf_sort_order: number;
  tf_created_at: string;
  tf_updated_at: string;
  tf_status_flag: boolean;
  tf_deleted_flag: boolean;
}

export interface Conversation {
  tc_id: string;
  tc_project_id: string;
  tc_user_id: string;
  tc_user_name: string;
  tc_user_email: string;
  tc_subject: string;
  tc_category: string;
  tc_status: 'open' | 'resolved' | 'closed';
  tc_is_priority: boolean;
  tc_created_at: string;
  tc_updated_at: string;
  tc_status_flag: boolean;
  tc_deleted_flag: boolean;
}

export interface Message {
  tm_id: string;
  tm_conversation_id: string;
  tm_sender_id: string;
  tm_sender_role: 'user' | 'client' | 'admin';
  tm_message: string;
  tm_created_at: string;
  tm_status_flag: boolean;
  tm_deleted_flag: boolean;
}

export interface CannedResponse {
  tcr_id: string;
  tcr_project_id: string;
  tcr_shortcut: string;
  tcr_response: string;
  tcr_created_at: string;
  tcr_updated_at: string;
  tcr_status_flag: boolean;
  tcr_deleted_flag: boolean;
}
