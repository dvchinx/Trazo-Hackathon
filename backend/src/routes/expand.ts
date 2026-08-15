import { Router } from "express";
import type { ExpandRequest, ExpandResponse } from "../../../shared/types.js";
import { MAX_NODES_PER_EXPANSION } from "../../../shared/types.js";
import {
  secopContractsByProvider,
  secopSanctionsByProvider,
  secopProcessesByEntity,
  secopProcess,
  CromaRateLimitError,
} from "../services/data-source.js";
import {
  providerContractsToGraph,
  entityProcessesToGraph,
  sanctionsToGraph,
  pickDiverseContracts,
  pickCandidateProcesses,
  dedupeAndCap,
} from "../graph/transform.js";

const PROCESS_CANDIDATE_LIMIT = 8;
const CONTRACT_CANDIDATE_LIMIT = 12;

const router = Router();

router.post("/", async (req, res) => {
  const { nodeId, nodeType, document_number, existingProviderNits, existingEntityNits } =
    req.body as ExpandRequest;

  if (!document_number) {
    return res.status(400).json({ error: "document_number requerido" });
  }

  // El propio nodo que se está expandiendo siempre debe quedar "existente", para que
  // las aristas hacia/desde él sobrevivan al filtro de dedupeAndCap aunque el cliente
  // no lo haya incluido en sus arrays de nodos actuales.
  const existingIds = new Set([nodeId, ...(existingProviderNits ?? []), ...(existingEntityNits ?? [])]);

  try {
    if (nodeType === "proveedor") {
      const [contractsResponse, sanctionsResponse] = await Promise.all([
        secopContractsByProvider(document_number),
        secopSanctionsByProvider(document_number),
      ]);
      const contracts = pickDiverseContracts(contractsResponse.data.contracts, CONTRACT_CANDIDATE_LIMIT);
      const providerLabel = contracts[0]?.provider ?? nodeId;
      const { nodes: contractNodes, edges: contractEdges } = providerContractsToGraph(
        document_number,
        providerLabel,
        contracts
      );
      const { nodes: sanctionNodes, edges: sanctionEdges } = sanctionsToGraph(
        document_number,
        sanctionsResponse.data.sanctions
      );
      // Las sanciones van primero: son pocas y valiosas, no deben perderse si el tope
      // de nodos nuevos recorta la cola de contratos.
      const result = dedupeAndCap(
        [...sanctionNodes, ...contractNodes],
        [...sanctionEdges, ...contractEdges],
        existingIds,
        MAX_NODES_PER_EXPANSION
      );
      return res.json(result satisfies ExpandResponse);
    }

    if (nodeType === "entidad_estatal") {
      const fromDate = new Date();
      fromDate.setFullYear(fromDate.getFullYear() - 3);
      const listResponse = await secopProcessesByEntity(document_number, {
        from_date: fromDate.toISOString().slice(0, 10),
      });
      const candidates = pickCandidateProcesses(listResponse.data.processes, PROCESS_CANDIDATE_LIMIT);

      const details = await Promise.all(
        candidates.map((c) => secopProcess(c.notice_uid as string).then((r) => r.data))
      );

      const { nodes, edges } = entityProcessesToGraph(document_number, details);
      const result = dedupeAndCap(nodes, edges, existingIds, MAX_NODES_PER_EXPANSION);
      return res.json(result satisfies ExpandResponse);
    }

    return res.status(400).json({ error: `nodeType "${nodeType}" no es expandible` });
  } catch (error) {
    if (error instanceof CromaRateLimitError) {
      return res.status(429).json({ status: "rate_limited", retry_after: error.retryAfter });
    }
    console.error("[expand] error", error);
    return res.status(502).json({ error: "Error consultando Croma" });
  }
});

export default router;
