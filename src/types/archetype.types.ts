export interface ArchetypeData {
  id?: string;
  projectName: string;
  sprint: string;
  version: string;
  description: string;
  databaseStatus: 'connected' | 'disconnected';
  environment: string;
  updatedAt: string;
  features: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

