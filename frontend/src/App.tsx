import { useEffect, useRef, useState } from "react";
import GraphCanvas from "./components/GraphCanvas";
import SearchBar from "./components/SearchBar";
import NodeDetailPanel from "./components/NodeDetailPanel";
import FilterPanel from "./components/FilterPanel";
import StoryMode from "./components/StoryMode";
import NotesPanel from "./components/NotesPanel";
import { useGraphStore } from "./store/graphStore";
import { buildShareUrl, readGraphFromLocation } from "./lib/shareGraph";

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

function ShareButton() {
  const nodesMap = useGraphStore((s) => s.nodes);
  const edgesMap = useGraphStore((s) => s.edges);
  const storyMode = useGraphStore((s) => s.storyMode);
  const isRevealing = useGraphStore((s) => s.isRevealing());
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (nodesMap.size === 0 || storyMode || isRevealing) return null;

  async function handleShare() {
    const url = buildShareUrl(Array.from(nodesMap.values()), Array.from(edgesMap.values()));
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copiá el link para compartir este grafo:", url);
      return;
    }
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      className="pointer-events-auto absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/10 bg-[#131318]/90 px-3 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur transition hover:bg-white/10"
    >
      {copied ? "Link copiado ✓" : "🔗 Compartir grafo"}
    </button>
  );
}

function App() {
  const ingest = useGraphStore((s) => s.ingest);

  useEffect(() => {
    const shared = readGraphFromLocation();
    if (shared) ingest(shared.nodes, shared.edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full">
      <GraphCanvas />
      <SearchBar />
      <FilterPanel />
      <NotesPanel />
      <DiscoveryIndicator />
      <RateLimitBanner />
      <StoryMode />
      <ShareButton />
      <NodeDetailPanel />
    </div>
  );
}

export default App;
