export interface SocketSendMessage {
    key: string;
    userId: string;
    conversationId: string;
    message?: string;
    images?: string[];
}
export interface SocketChatData {
    conversationId: string;
    userId:string;
    message?: string;
    images?: string[];
}
export interface MLArtifact {
  artifact_id: string;
  kind: string;
  produced_by: string;
  image_b64?: string;
  [key: string]: any;
}

export interface MLResponse {
    query: string;
    final_answer?: string;
    confidence?: number;
    current_task?: string;
    temporal_mode?: string;
    modalities?: string[];
    image_count?: number;
    input_valid?: boolean;
    validation_errors?: string[];
    retry_count?: number;

    reflection?: {
        decision: string;
        required_action: string;
        reason: string;
        confidence: number;
        evidence_confidence: number;
        min_confidence: number;
        retry_count: number;
    };

    evidence?: Record<string, unknown>[];
    execution_trace?: Record<string, unknown>[];
    duration_seconds?: number;
     artifacts?: MLArtifact[];
}
