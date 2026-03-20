import axios from 'axios';

export const opcuaApi = axios.create({
  baseURL: '/opcua',
  headers: { 'Content-Type': 'application/json' },
});

opcuaApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Typed API helpers ──────────────────────────────────────────────────────────

export interface NodeNames {
  process: string[];
  alarms: string[];
}

export interface TimeseriesPoint {
  ts: number;
  value: number;
}

export interface TimeseriesResponse {
  measurement: string;
  node: string;
  from_ts: number;
  to_ts: number;
  count: number;
  points: TimeseriesPoint[];
}

export async function getNodes(): Promise<NodeNames> {
  const res = await opcuaApi.get<NodeNames>('/nodes');
  return res.data;
}

export interface SensorUnit {
  id: number;
  category: string;
  unit: string;
  description: string;
}

export async function getSensorUnits(): Promise<SensorUnit[]> {
  const res = await opcuaApi.get<SensorUnit[]>('/sensor-units');
  return res.data;
}

export interface NodeDef {
  id: number;
  name: string;
  node_id: string;
  type: 'process' | 'alarm';
  unit: string | null;
  description: string | null;
  is_active: boolean;
  sim_behavior: string;
  sim_min: number;
  sim_max: number;
  sim_period: number;
  created_at: string;
}

export type NodeDefCreate = Omit<NodeDef, 'id' | 'created_at'>;
export type NodeDefUpdate = Partial<NodeDefCreate>;

export async function getNodeConfig(): Promise<NodeDef[]> {
  const res = await opcuaApi.get<NodeDef[]>('/node-config');
  return res.data;
}

export async function createNodeConfig(body: NodeDefCreate): Promise<NodeDef> {
  const res = await opcuaApi.post<NodeDef>('/node-config', body);
  return res.data;
}

export async function updateNodeConfig(id: number, body: NodeDefUpdate): Promise<NodeDef> {
  const res = await opcuaApi.put<NodeDef>(`/node-config/${id}`, body);
  return res.data;
}

export async function deleteNodeConfig(id: number): Promise<void> {
  await opcuaApi.delete(`/node-config/${id}`);
}

export async function getTimeseries(
  measurement: string,
  node: string,
  fromTs: number,
  toTs: number,
  limit = 1000,
): Promise<TimeseriesResponse> {
  const res = await opcuaApi.get<TimeseriesResponse>('/timeseries', {
    params: { measurement, node, from_ts: fromTs, to_ts: toTs, limit },
  });
  return res.data;
}
