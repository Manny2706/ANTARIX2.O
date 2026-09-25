export interface SocketSendMessage {
    key: string;
    userId: string;
    conversationId?: string;
    message?: string;
    images?: string[];
    bbox?: [number, number, number, number] | number[] | null;
}
export interface SocketChatData {
    conversationId?: string;
    userId: string;
    message?: string;
    images?: string[];
    bbox?: [number, number, number, number] | number[] | null;
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
    stac_metadata?: Record<string, unknown>;
    output_image_b64?: string;
}

export type SocketLocationSend = {
    key: string;

    conversationId: string;
    userId: string;

    query: string;
    max_retries: number;
    bbox: [number, number, number, number];
    session_id: string;
}

export type LocationMLRequest = {
    query: string;
    max_retries: number;
    bbox: [number, number, number, number];
    session_id: string;
}
export type HandleLocationMessage = {
    conversationId: string;
    userId: string;

    query: string;
    max_retries: number;
    bbox: [number, number, number, number];
    session_id: string;
}
