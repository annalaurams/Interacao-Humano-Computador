import { useRef, useState, useCallback } from 'react';

type Meta = Record<string, any> | undefined;

interface ClickRow {
  tentativa: number;
  produto_clicado: string;
  produto_nome?: string;
  acertou: boolean;
  tempo_reacao_ms: number;
  tempo_acumulado_ms: number;
  pos_x: number;
  pos_y: number;
  timestamp: string;
  meta?: Meta;
}

interface SessionData {
  sessionId: string;
  inicio: number; // performance.now()
  inicioTentativa: number; // performance.now() of current trial
  tentativaAtual: number;
  targets: string[]; // list of product ids (e.g. 'product-12') precomputed
  itemCount: number;
  clicks: ClickRow[];
}

export default function usePrecomputedExperiment(opts?: { autoStart?: boolean; persist?: boolean; persistKey?: string }) {
  const session = useRef<SessionData>({
    sessionId: `precomp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    inicio: 0,
    inicioTentativa: 0,
    tentativaAtual: 0,
    targets: [],
    itemCount: 0,
    clicks: []
  });

  const [active, setActive] = useState<boolean>(!!opts?.autoStart);
  const [suppressHighlight] = useState<boolean>(true); // this hook intentionally suppresses UI highlight

  const startSession = useCallback((targets: string[], itemCount: number) => {
    session.current.targets = targets.slice();
    session.current.itemCount = itemCount;
    session.current.inicio = performance.now();
    session.current.inicioTentativa = performance.now();
    session.current.tentativaAtual = 1;
    session.current.clicks = [];
    setActive(true);
    console.log('usePrecomputedExperiment: session started', {targets, itemCount});
  }, []);

  // Registers a click. API kept to match existing calls: (produtoId, isCorrect, position, meta)
  const registerClick = useCallback((produtoId: string, isCorrect: boolean, position: { x:number; y:number }, meta?: Meta) => {
    if (session.current.inicio === 0) {
      // If session not started yet, start it automatically with empty targets
      session.current.inicio = performance.now();
      session.current.inicioTentativa = performance.now();
      session.current.tentativaAtual = 1;
      setActive(true);
    }

    const now = performance.now();
    const tempoReacao = Math.round(now - session.current.inicioTentativa);
    const tempoAcumulado = Math.round(now - session.current.inicio);

    const row: ClickRow = {
      tentativa: session.current.tentativaAtual,
      produto_clicado: produtoId,
      acertou: !!isCorrect,
      tempo_reacao_ms: tempoReacao,
      tempo_acumulado_ms: tempoAcumulado,
      pos_x: Math.round(position.x),
      pos_y: Math.round(position.y),
      timestamp: new Date().toISOString(),
      meta
    };

    // Try to attach a friendly name if meta.productName provided
    if (meta && (meta as any).productName) {
      row.produto_nome = (meta as any).productName;
    }

    session.current.clicks.push(row);
    console.log('usePrecomputedExperiment: click', row);

    // If correct, advance trial
    if (isCorrect) {
      session.current.tentativaAtual += 1;
      session.current.inicioTentativa = performance.now();
      // optionally remove this target from list
      session.current.targets = session.current.targets.filter(t => t !== produtoId);
    }
  }, []);

  const exportToCSV = useCallback(() => {
    const s = session.current;
    if (!s.clicks || s.clicks.length === 0) {
      alert('Nenhum clique registrado — nada para exportar');
      return;
    }

    const header = ['tentativa','produto_clicado','produto_nome','acertou','tempo_reacao_ms','tempo_acumulado_ms','pos_x','pos_y','timestamp'];
    const rows = s.clicks.map(r => [
      r.tentativa,
      r.produto_clicado,
      r.produto_nome || '',
      r.acertou ? 'SIM' : 'NAO',
      r.tempo_reacao_ms,
      r.tempo_acumulado_ms,
      r.pos_x,
      r.pos_y,
      r.timestamp
    ]);

    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `precomputed_experiment_${s.sessionId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    console.log('usePrecomputedExperiment: CSV exported', {file: link.download, totalRows: s.clicks.length});
  }, []);

  const getStats = useCallback(() => {
    const clicks = session.current.clicks;
    const total = clicks.length;
    const correct = clicks.filter(c => c.acertou).length;
    const incorrect = total - correct;
    const acertos = clicks.filter(c => c.acertou);
    const avgRt = acertos.length > 0 ? Math.round(acertos.reduce((s,n) => s + n.tempo_reacao_ms, 0) / acertos.length) : 0;
    const precision = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
    return {
      totalClicks: total,
      totalCorrect: correct,
      totalIncorrect: incorrect,
      completedTasks: session.current.tentativaAtual - 1,
      avgReactionTime: avgRt,
      accuracy: precision
    };
  }, []);

  return {
    startSession,
    registerClick,
    exportToCSV,
    getStats,
    isActive: active,
    suppressHighlight: suppressHighlight,
    sessionData: session.current
  };
}
