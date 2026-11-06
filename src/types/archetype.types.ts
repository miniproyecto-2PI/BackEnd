import { ErrorPayload } from './errors.types';

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
  success?: boolean;
  message?: string;
  data?: T;
  error?: ErrorPayload;
  timestamp?: string;
}
