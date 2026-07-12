export interface HealthStatus {
  status: string;
}

export interface ErrorResponse {
  error: string;
}

export type ModRequestInputModLoader = typeof ModRequestInputModLoader[keyof typeof ModRequestInputModLoader];

export const ModRequestInputModLoader = {
  forge: 'forge',
  fabric: 'fabric',
  neoforge: 'neoforge',
  quilt: 'quilt',
} as const;

export interface ModRequestInput {
  mcVersion: string;
  modLoader: ModRequestInputModLoader;
  prompt: string;
}

export type ModRequestModLoader = typeof ModRequestModLoader[keyof typeof ModRequestModLoader];

export const ModRequestModLoader = {
  forge: 'forge',
  fabric: 'fabric',
  neoforge: 'neoforge',
  quilt: 'quilt',
} as const;

export type ModRequestStatus = typeof ModRequestStatus[keyof typeof ModRequestStatus];

export const ModRequestStatus = {
  pending: 'pending',
  completed: 'completed',
  refused: 'refused',
  failed: 'failed',
} as const;

export interface ModRequest {
  id: number;
  mcVersion: string;
  modLoader: ModRequestModLoader;
  prompt: string;
  title: string;
  status: ModRequestStatus;
  summary: string;
  resultMarkdown: string;
  createdAt: string;
}

export interface CountBucket {
  label: string;
  count: number;
}

export interface ModStats {
  totalMods: number;
  byVersion: CountBucket[];
  byLoader: CountBucket[];
}
