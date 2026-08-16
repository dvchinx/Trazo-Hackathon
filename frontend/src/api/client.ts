import type {
  SearchRequest,
  SearchResponse,
  ExpandRequest,
  ExpandResponse,
  DetailRequest,
  DetailResponse,
  RateLimitedResponse,
  CreateCaseRequest,
  AddCaseItemsRequest,
  AddCaseNoteRequest,
  CaseResponse,
  CaseNoteResponse,
} from "@shared/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class RateLimitedError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super("Croma está ocupado");
    this.name = "RateLimitedError";
    this.retryAfter = retryAfter;
  }
}

async function post<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    const data = (await response.json()) as RateLimitedResponse;
    throw new RateLimitedError(data.retry_after);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Error ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

async function get<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Error ${response.status}`);
  }
  return response.json() as Promise<TResponse>;
}

export function search(req: SearchRequest): Promise<SearchResponse> {
  return post<SearchResponse>("/api/search", req);
}

export function expand(req: ExpandRequest): Promise<ExpandResponse> {
  return post<ExpandResponse>("/api/expand", req);
}

export function detail(nodeId: string, req: DetailRequest): Promise<DetailResponse> {
  return post<DetailResponse>(`/api/detail/${encodeURIComponent(nodeId)}`, req);
}

export function createCase(req: CreateCaseRequest): Promise<CaseResponse> {
  return post<CaseResponse>("/api/cases", req);
}

export function getCase(caseId: string): Promise<CaseResponse> {
  return get<CaseResponse>(`/api/cases/${encodeURIComponent(caseId)}`);
}

export function addCaseItems(caseId: string, req: AddCaseItemsRequest): Promise<CaseResponse> {
  return post<CaseResponse>(`/api/cases/${encodeURIComponent(caseId)}/items`, req);
}

export function addCaseNote(caseId: string, req: AddCaseNoteRequest): Promise<CaseNoteResponse> {
  return post<CaseNoteResponse>(`/api/cases/${encodeURIComponent(caseId)}/notes`, req);
}
