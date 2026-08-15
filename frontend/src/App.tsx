import GraphCanvas from "./components/GraphCanvas";
import SearchBar from "./components/SearchBar";
import NodeDetailPanel from "./components/NodeDetailPanel";
import { useGraphStore } from "./store/graphStore";

function DiscoveryIndicator() {
  const nodesCount = useGraphStore((s) => s.nodes.size);
  const pendingCount = useGraphStore((s) => s.pendingNodes.length + s.pendingEdges.length);
  const isRevealing = useGraphStore((s) => s.isRevealing());

  if (!isRevealing && nodesCount === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-[#131318]/90 px-3 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur">
      {isRevealing ? (
        <>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span>
            descubriendo conexiones… {nodesCount} nodo(s), {pendingCount} por revelar
          </span>
        </>
      ) : (
        <span>{nodesCount} nodo(s) en el grafo</span>
      )}
    </div>
  );
}

function RateLimitBanner() {
  const status = useGraphStore((s) => s.status);
  const retryAfter = useGraphStore((s) => s.retryAfter);
  const setStatus = useGraphStore((s) => s.setStatus);

  if (status !== "rate_limited") return null;

  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-amber-500/30 bg-amber-950/90 px-4 py-2 text-sm text-amber-200 shadow-lg backdrop-blur">
      Croma está ocupado, reintentando… {retryAfter ? `(${retryAfter}s)` : ""}
      <button
        onClick={() => setStatus("idle")}
        className="pointer-events-auto ml-3 underline hover:text-amber-100"
      >
        cerrar
      </button>
    </div>
  );
}

function App() {
  return (
    <div className="relative h-full w-full">
      <GraphCanvas />
      <SearchBar />
      <DiscoveryIndicator />
      <RateLimitBanner />
      <NodeDetailPanel />
    </div>
  );
}

export default App;
