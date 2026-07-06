export type AgentSuggestionType = 'birthday' | 'long_silence' | 'manual_reminder_due';
export type AgentSuggestionStatus = 'pending' | 'dismissed' | 'done';

export interface AgentSuggestion {
  id: string;
  contactId: string;
  type: AgentSuggestionType;
  message: string;
  status: AgentSuggestionStatus;
  triggerDate: string;
  createdAt: number;
}
