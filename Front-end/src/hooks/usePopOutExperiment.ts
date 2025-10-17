import { useEffect, useRef, useState, useCallback } from 'react';

interface ClickMeta {
  productName?: string;  // lista
  fieldName?: string;    // cadastro
  page?: string;       
}

interface ClickData {
  tentativa: number;
  clickIndex: number;
  timestampPerf: number;
  timestampIso: string;
  tempoAcumulado: number;
  targetId: string;
  isCorrect: boolean;
  position: { x: number; y: number };
  tempoReacao?: number;
  meta?: ClickMeta;
}

interface ExperimentMetrics {
  sessionId: string;
  startPerfMs: number;
  startEpochMs: number;
  firstInteractionTime?: number;
  clicks: ClickData[];
  totalCorrectClicks: number;
  totalIncorrectClicks: number;
  currentTrial: number;
}

type CurrentTask = {
  taskId: string;
  startPerfMs: number;
  startEpochMs: number;
  targetId: string;
  itemCount: number;
} | null;

type Options = {
  autoStart?: boolean;
  persist?: boolean;
  persistKey?: string;
};

const defaultOptions: Required<Options> = {
  autoStart: true,
  persist: false,
  persistKey: 'fastmart_experiment',
};

export const usePopOutExperiment = (opts?: Options) => {
  const { autoStart, persist, persistKey } = { ...defaultOptions, ...(opts || {}) };

  // Estado base
  const [metrics, setMetrics] = useState<ExperimentMetrics>({
    sessionId: `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    startPerfMs: 0,
    startEpochMs: 0,
    clicks: [],
    totalCorrectClicks: 0,
    totalIncorrectClicks: 0,
    currentTrial: 0,
  });

  const [currentTask, setCurrentTask] = useState<CurrentTask>(null);
  const [isActive, setIsActive] = useState(false);

  const sessionStartedRef = useRef(false);
  const trialStartPerfRef = useRef<number>(0);
  const trialStartEpochRef = useRef<number>(0);

  // jsPsych refs
  const jsPsychRef = useRef<any | null>(null);
  const initJsPsychFnRef = useRef<any | null>(null);
  const loadingJsPsychRef = useRef<Promise<void> | null>(null);

  const save = useCallback((m: ExperimentMetrics, task: CurrentTask) => {
    if (!persist) return;
    try {
      const payload = JSON.stringify({ metrics: m, currentTask: task });
      localStorage.setItem(persistKey, payload);
    } catch {}
  }, [persist, persistKey]);

  const restore = useCallback(() => {
    if (!persist) return false;
    try {
      const raw = localStorage.getItem(persistKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { metrics: ExperimentMetrics; currentTask: CurrentTask };
      if (!parsed?.metrics) return false;

      setMetrics(parsed.metrics);
      setCurrentTask(parsed.currentTask || null);

      if (parsed.currentTask) {
        trialStartPerfRef.current = parsed.currentTask.startPerfMs;
        trialStartEpochRef.current = parsed.currentTask.startEpochMs;
      }

      sessionStartedRef.current = parsed.metrics.startPerfMs > 0;
      setIsActive(sessionStartedRef.current);
      return true;
    } catch {
      return false;
    }
  }, [persist, persistKey]);

  useEffect(() => {
    if (persist) restore();
  }, [persist, restore]);

  useEffect(() => {
    save(metrics, currentTask);
  }, [metrics, currentTask, save]);

  const loadJsPsychSafe = useCallback(async () => {
 
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (initJsPsychFnRef.current && jsPsychRef.current) return; 
    if (loadingJsPsychRef.current) { await loadingJsPsychRef.current; return; }

    loadingJsPsychRef.current = (async () => {
      try {
        const mod: any = await import('jspsych');
        const initJsPsych = mod?.initJsPsych ?? mod?.default?.initJsPsych;
        if (!initJsPsych) throw new Error('initJsPsych não encontrado no módulo jspsych');

        initJsPsychFnRef.current = initJsPsych;

        jsPsychRef.current = initJsPsych({
          on_finish: () => {},
          show_progress_bar: false,
          override_safe_mode: true,
        });
      } catch (err) {
        console.warn('[usePopOutExperiment] jsPsych não pôde ser carregado. Seguindo no modo local.', err);
        initJsPsychFnRef.current = null;
        jsPsychRef.current = null;
      } finally {
        loadingJsPsychRef.current = null;
      }
    })();

    await loadingJsPsychRef.current;
  }, []);

  // Sessão
  const startExperimentSession = useCallback(() => {
    if (sessionStartedRef.current) return;

    void loadJsPsychSafe().then(() => {
      const jp = jsPsychRef.current;
      const nowPerf = performance.now();
      const nowEpoch = Date.now();

      sessionStartedRef.current = true;

      try {
        jp?.data?.addProperties?.({
          session_id: `session_${nowEpoch}`,
          app_sessionId: metrics.sessionId,
          start_epoch_ms: nowEpoch,
        });
        jp?.data?.write?.({
          rowType: 'session',
          event: 'session_start',
          timestamp_iso: new Date(nowEpoch).toISOString(),
        });
      } catch (e) {

      }

      setMetrics(prev => ({
        ...prev,
        startPerfMs: nowPerf,
        startEpochMs: nowEpoch,
      }));
      setIsActive(true);
    });

  }, [loadJsPsychSafe, metrics.sessionId]);

  const startSearchTask = useCallback((targetId: string, itemCount: number) => {

    void loadJsPsychSafe().then(() => {
      const jp = jsPsychRef.current;

      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const nowPerf = performance.now();
      const nowEpoch = Date.now();
      trialStartPerfRef.current = nowPerf;
      trialStartEpochRef.current = nowEpoch;

      setCurrentTask({
        taskId,
        startPerfMs: nowPerf,
        startEpochMs: nowEpoch,
        targetId,
        itemCount,
      });

      setMetrics(prev => {
        const nextTrial = prev.currentTrial + 1;

        try {
          jp?.data?.write?.({
            rowType: 'trial',
            event: 'trial_start',
            tentativa: nextTrial,
            target_id: targetId,
            item_count: itemCount,
            timestamp_iso: new Date(nowEpoch).toISOString(),
          });
        } catch {}

        return { ...prev, currentTrial: nextTrial };
      });
    });

    return `task_pending_${Date.now()}`; 
  }, [loadJsPsychSafe]);

  // Registro de cliques 
  const registerClick = useCallback((
    targetId: string,
    isCorrect: boolean,
    position: { x: number; y: number } = { x: 0, y: 0 },
    meta?: ClickMeta
  ) => {
    const nowPerf = performance.now();
    const nowEpoch = Date.now();

    setMetrics(prev => {
      const basePerf = prev.startPerfMs || 0;
      const baseEpoch = prev.startEpochMs || nowEpoch;

      const tempoAcumulado = basePerf > 0
        ? (nowPerf - basePerf)
        : (nowEpoch - baseEpoch);

      const tempoReacao = trialStartPerfRef.current > 0
        ? (nowPerf - trialStartPerfRef.current)
        : (trialStartEpochRef.current > 0 ? (nowEpoch - trialStartEpochRef.current) : 0);

      const clickIndex = prev.clicks.length + 1;

      const click: ClickData = {
        tentativa: Math.max(prev.currentTrial, 1),
        clickIndex,
        timestampPerf: nowPerf,
        timestampIso: new Date(nowEpoch).toISOString(),
        tempoAcumulado,
        targetId,
        isCorrect,
        position,
        tempoReacao,
        meta,
      };

      try {
        jsPsychRef.current?.data?.write?.({
          rowType: 'click',
          onde_clicou: click.targetId,
          nome_produto: click.meta?.productName ?? '',
          campo_form: click.meta?.fieldName ?? '',
          quantas_vezes: click.clickIndex,
          tempo_reacao_ms: Number((click.tempoReacao ?? 0).toFixed(0)),
          acertou: click.isCorrect ? 'SIM' : 'NÃO',
          tempo_acumulado_ms: Number(click.tempoAcumulado.toFixed(0)),
          tentativa: click.tentativa,
          timestamp_iso: click.timestampIso,
          posicao_x: click.position.x,
          posicao_y: click.position.y,
          page: click.meta?.page ?? '',
        });
      } catch {}

      const updated: ExperimentMetrics = {
        ...prev,
        clicks: [...prev.clicks, click],
        totalCorrectClicks: prev.totalCorrectClicks + (isCorrect ? 1 : 0),
        totalIncorrectClicks: prev.totalIncorrectClicks + (isCorrect ? 0 : 1),
        firstInteractionTime: prev.firstInteractionTime ?? tempoAcumulado,
      };

      return updated;
    });

    if (isCorrect && currentTask && targetId === currentTask.targetId) {
      try {
        jsPsychRef.current?.data?.write?.({
          rowType: 'trial',
          event: 'trial_success',
          target_id: targetId,
          timestamp_iso: new Date(Date.now()).toISOString(),
        });
      } catch {}
      setCurrentTask(null);
    }
  }, [currentTask]);

  // CSV
  const exportToCSV = useCallback(() => {
    const header = [
      'onde_clicou',
      'nome_produto',
      'campo_form',
      'quantas_vezes',
      'tempo_reacao_ms',
      'acertou',
      'tempo_acumulado_ms',
      'tentativa',
      'timestamp_iso',
      'posicao_x',
      'posicao_y',
    ];

    let rows: any[] = [];

    try {
      const jp = jsPsychRef.current;
      if (jp) {
        const data = jp.data.get().filter({ rowType: 'click' }).values();
        rows = data.map((d: any) => ([
          d.onde_clicou ?? '',
          d.nome_produto ?? '',
          d.campo_form ?? '',
          d.quantas_vezes ?? '',
          d.tempo_reacao_ms ?? '',
          d.acertou ?? '',
          d.tempo_acumulado_ms ?? '',
          d.tentativa ?? '',
          d.timestamp_iso ?? '',
          d.posicao_x ?? '',
          d.posicao_y ?? '',
        ]));
      }
    } catch {

    }

    if (!rows.length) {
      rows = metrics.clicks.map(c => ([
        c.targetId,
        c.meta?.productName ?? '',
        c.meta?.fieldName ?? '',
        c.clickIndex,
        (c.tempoReacao ?? 0).toFixed(0),
        c.isCorrect ? 'SIM' : 'NÃO',
        c.tempoAcumulado.toFixed(0),
        c.tentativa,
        c.timestampIso,
        c.position.x,
        c.position.y,
      ]));
    }

    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fastmart_experimento_${metrics.sessionId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [metrics.clicks, metrics.sessionId]);

  // Stats 
  const getStats = useCallback(() => {
    const total = metrics.clicks.length;
    const acertos = metrics.totalCorrectClicks;

    const avgReactionTime = (() => {
      const valids = metrics.clicks.filter(c => typeof c.tempoReacao === 'number');
      if (!valids.length) return 0;
      const sum = valids.reduce((s, c) => s + (c.tempoReacao ?? 0), 0);
      return sum / valids.length;
    })();

    const nowPerf = performance.now();
    const nowEpoch = Date.now();
    const sessionDuration = metrics.startPerfMs
      ? (nowPerf - metrics.startPerfMs)
      : (nowEpoch - (metrics.startEpochMs || nowEpoch));

    return {
      sessionDuration,
      firstInteractionTime: metrics.firstInteractionTime ?? 0,
      totalClicks: total,
      accuracy: total ? (acertos / total) * 100 : 0,
      avgReactionTime,
      completedTasks: metrics.currentTrial,
      totalCorrect: acertos,
      totalIncorrect: metrics.totalIncorrectClicks,
    };
  }, [metrics]);

  // Auto-start
  useEffect(() => {
    if (autoStart && !sessionStartedRef.current) {
      if (!metrics.startPerfMs && !metrics.startEpochMs) {
        startExperimentSession();
      } else {
        sessionStartedRef.current = true;
        setIsActive(true);
      }
    }

  }, [autoStart]);

  return {
    metrics,
    startSearchTask,
    registerClick,
    exportToCSV,
    getStats,
    currentTask,
    isActive,
  };
};

export default usePopOutExperiment;
