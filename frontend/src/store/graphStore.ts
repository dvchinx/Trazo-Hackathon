import { create } from "zustand";
import type { GraphNode, GraphEdge, NodeType } from "@shared/types";

export type StoreStatus = "idle" | "loading" | "rate_limited";

export interface ContractFilters {
  minValue?: number;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
}

export interface StoredNode extends GraphNode {
  mergedAt?: number;
}

export interface StoredEdge extends GraphEdge {
  revealedAt: number;
}

interface GraphStoreState {
  nodes: Map<string, StoredNode>;
  edges: Map<string, StoredEdge>;
  pendingNodes: GraphNode[];
  pendingEdges: GraphEdge[];
  selectedNodeId: string | null;
  status: StoreStatus;
  retryAfter?: number;
  error?: string;
  hiddenTypes: Set<NodeType>;
  contractFilters: ContractFilters;
  focusRequest: { id: string; ts: number } | null;
  storyMode: boolean;

  ingest: (nodes: GraphNode[], edges: GraphEdge[], mergedNodeIds?: string[]) => void;
  selectNode: (id: string | null) => void;
  markExpanded: (id: string) => void;
  setStatus: (status: StoreStatus, extra?: { retryAfter?: number; error?: string }) => void;
  toggleTypeVisibility: (type: NodeType) => void;
  setContractFilters: (filters: ContractFilters) => void;
  requestFocus: (id: string) => void;
  setStoryMode: (active: boolean) => void;
  reset: () => void;
  isRevealing: () => boolean;
}

const REVEAL_MIN_MS = 150;
const REVEAL_MAX_MS = 300;
const MERGE_PULSE_MS = 1200;

let revealTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleNextReveal(get: () => GraphStoreState, set: (fn: (s: GraphStoreState) => Partial<GraphStoreState>) => void) {
  if (revealTimer) return; // ya hay uno agendado
  const delay = REVEAL_MIN_MS + Math.random() * (REVEAL_MAX_MS - REVEAL_MIN_MS);
  revealTimer = setTimeout(() => {
    revealTimer = null;
    revealOne(get, set);
  }, delay);
}

function revealOne(get: () => GraphStoreState, set: (fn: (s: GraphStoreState) => Partial<GraphStoreState>) => void) {
  const state = get();

  if (state.pendingNodes.length > 0) {
    const [next, ...rest] = state.pendingNodes;
    set((s) => {
      const nodes = new Map(s.nodes);
      nodes.set(next.id, { ...next, discovered_at: Date.now() });
      return { nodes, pendingNodes: rest };
    });
  } else if (state.pendingEdges.length > 0) {
    // revela la primera arista cuyos dos extremos ya están visibles; si ninguna
    // califica todavía, espera al próximo tick (los nodos se están revelando).
    const currentNodes = get().nodes;
    const idx = state.pendingEdges.findIndex(
      (e) => currentNodes.has(e.source) && currentNodes.has(e.target)
    );
    if (idx >= 0) {
      const edge = state.pendingEdges[idx];
      set((s) => {
        const edges = new Map(s.edges);
        edges.set(edge.id, { ...edge, revealedAt: Date.now() });
        const pendingEdges = s.pendingEdges.filter((_, i) => i !== idx);
        return { edges, pendingEdges };
      });
    }
  }

  const stillPending = get().pendingNodes.length > 0 || get().pendingEdges.length > 0;
  if (stillPending) {
    scheduleNextReveal(get, set);
  }
}

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  nodes: new Map(),
  edges: new Map(),
  pendingNodes: [],
  pendingEdges: [],
  selectedNodeId: null,
  status: "idle",
  hiddenTypes: new Set(),
  contractFilters: {},
  focusRequest: null,
  storyMode: false,

  ingest: (newNodes, newEdges, mergedNodeIds = []) => {
    if (mergedNodeIds.length > 0) {
      set((s) => {
        const nodes = new Map(s.nodes);
        const now = Date.now();
        for (const id of mergedNodeIds) {
          const existing = nodes.get(id);
          if (existing) nodes.set(id, { ...existing, mergedAt: now });
        }
        return { nodes };
      });
      setTimeout(() => {
        set((s) => {
          const nodes = new Map(s.nodes);
          for (const id of mergedNodeIds) {
            const existing = nodes.get(id);
            if (existing?.mergedAt) nodes.set(id, { ...existing, mergedAt: undefined });
          }
          return { nodes };
        });
      }, MERGE_PULSE_MS);
    }

    set((s) => ({
      pendingNodes: [...s.pendingNodes, ...newNodes],
      pendingEdges: [...s.pendingEdges, ...newEdges],
    }));

    scheduleNextReveal(get, set);
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  markExpanded: (id) =>
    set((s) => {
      const nodes = new Map(s.nodes);
      const existing = nodes.get(id);
      if (existing) nodes.set(id, { ...existing, expanded: true });
      return { nodes };
    }),

  setStatus: (status, extra) =>
    set({ status, retryAfter: extra?.retryAfter, error: extra?.error }),

  toggleTypeVisibility: (type) =>
    set((s) => {
      const hiddenTypes = new Set(s.hiddenTypes);
      if (hiddenTypes.has(type)) hiddenTypes.delete(type);
      else hiddenTypes.add(type);
      return { hiddenTypes };
    }),

  setContractFilters: (filters) =>
    set((s) => ({ contractFilters: { ...s.contractFilters, ...filters } })),

  requestFocus: (id) => set({ focusRequest: { id, ts: Date.now() }, selectedNodeId: id }),

  setStoryMode: (active) => set({ storyMode: active }),

  reset: () => {
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    set({
      nodes: new Map(),
      edges: new Map(),
      pendingNodes: [],
      pendingEdges: [],
      selectedNodeId: null,
      status: "idle",
      retryAfter: undefined,
      error: undefined,
      hiddenTypes: new Set(),
      contractFilters: {},
      focusRequest: null,
      storyMode: false,
    });
  },

  isRevealing: () => get().pendingNodes.length > 0 || get().pendingEdges.length > 0,
}));
