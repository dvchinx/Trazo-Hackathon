// Tipos compartidos entre backend y frontend — ver CLAUDE.md sección 4.

export type NodeType =
  | "entidad_estatal"
  | "proveedor"
  | "contrato"
  | "sancion"
  | "alerta_fiscal"
  | "alerta_disciplinaria";

export type EdgeType =
  | "contrató_a"
  | "ejecuta"
  | "sancionado_en"
  | "comparte_proveedor_con"
  | "tiene_alerta";

export interface GraphNode {
  id: string; // NIT/cédula para entidad/proveedor, contract_id para contrato, etc.
  type: NodeType;
  label: string;
  raw: unknown; // payload original de Croma, para el panel de detalle
  discovered_at: number; // epoch ms, seteado por el cliente al revelar el nodo
  expanded: boolean;
}

export interface GraphEdge {
  id: string; // `${source}->${target}:${type}`
  source: string;
  target: string;
  type: EdgeType;
  raw?: unknown;
}

export interface SearchCandidate {
  id: string;
  label: string;
  nit: string;
  type: "entidad_estatal" | "proveedor";
  meta?: string; // texto corto adicional (ciudad, cámara de comercio, etc.)
}

export type SearchKind = "entidad" | "proveedor";

export interface SearchRequest {
  query: string;
  kind: SearchKind;
}

export interface SearchResponse {
  candidates: SearchCandidate[];
}

export interface ExpandRequest {
  nodeId: string;
  nodeType: NodeType;
  document_number: string;
  existingProviderNits: string[];
  existingEntityNits: string[];
}

export interface ExpandResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  mergedNodeIds: string[];
  truncated: boolean; // true si se recortó por el tope de nodos nuevos
}

export interface DetailRequest {
  nodeType: NodeType;
  document_number: string;
}

export interface DetailResponse {
  summary: string; // resumen en lenguaje natural
  raw: unknown;
  sourceUrl?: string;
}

export interface RateLimitedResponse {
  status: "rate_limited";
  retry_after: number; // segundos
}

export const NODE_TYPE_COLOR: Record<NodeType, string> = {
  entidad_estatal: "#3b82f6", // azul
  proveedor: "#22c55e", // verde
  contrato: "#eab308", // amarillo
  sancion: "#ef4444", // rojo
  alerta_fiscal: "#f97316", // naranja
  alerta_disciplinaria: "#c2410c", // naranja oscuro
};

export const MAX_NODES_PER_EXPANSION = 15;
