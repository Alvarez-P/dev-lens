'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Globe,
  ArrowRight,
  Shield,
  Filter,
  Zap,
  Layers,
  Database,
  Play,
  Pause,
  ChevronDown,
  Activity,
  Server,
  Route,
  Braces,
} from 'lucide-react';
import { getGraphNodes, getEndpointFlow } from '@/lib/visualization/graph-api';
import { isSuccessResponse } from '@/lib/api-client';
import { NodeType, type EndpointFlowResponse } from '@/lib/visualization/types';
import { LoadingState } from '@/components/molecules/loading-state';
import { EmptyState } from '@/components/molecules/empty-state';
import { Button } from '@/components/atoms/button';

interface ApiEndpointsViewProps {
  repoId: string;
}

interface EndpointCard {
  fqn: string;
  method: string;
  path: string;
  steps: import('@/lib/visualization/types').RequestFlowStep[];
  flowAvailable: boolean;
}

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  GET: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-500/10',
  },
  POST: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
    glow: 'shadow-sky-500/10',
  },
  PUT: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    glow: 'shadow-amber-500/10',
  },
  PATCH: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/20',
    glow: 'shadow-yellow-500/10',
  },
  DELETE: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    glow: 'shadow-red-500/10',
  },
};

const KIND_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  middleware: {
    icon: <Layers className="h-4 w-4" />,
    label: 'Middleware',
    color: 'border-purple-500/30 bg-purple-500/5',
  },
  guard: {
    icon: <Shield className="h-4 w-4" />,
    label: 'Guard',
    color: 'border-red-500/30 bg-red-500/5',
  },
  pipe: {
    icon: <Filter className="h-4 w-4" />,
    label: 'Pipe',
    color: 'border-cyan-500/30 bg-cyan-500/5',
  },
  interceptor: {
    icon: <Zap className="h-4 w-4" />,
    label: 'Interceptor',
    color: 'border-orange-500/30 bg-orange-500/5',
  },
  handler: {
    icon: <Globe className="h-4 w-4" />,
    label: 'Handler',
    color: 'border-primary-500/30 bg-primary-500/5',
  },
  service: {
    icon: <Server className="h-4 w-4" />,
    label: 'Service',
    color: 'border-blue-500/30 bg-blue-500/5',
  },
  repository: {
    icon: <Database className="h-4 w-4" />,
    label: 'Repository',
    color: 'border-green-500/30 bg-green-500/5',
  },
};

function shortName(fqn: string): string {
  const parts = fqn.split(/[.#~]/);
  return parts[parts.length - 1] || fqn;
}

function parentName(fqn: string): string {
  const parts = fqn.split(/[.#~]/);
  if (parts.length >= 2) return parts.slice(0, -1).join('/');
  return '';
}

function ConnectorArrow({
  isActive,
  isPast,
  payloadType,
}: {
  isActive: boolean;
  isPast: boolean;
  payloadType: string | null;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <ArrowRight
        className={clsx(
          'h-5 w-5 transition-all duration-300',
          isActive
            ? 'text-primary-400 scale-125'
            : isPast
              ? 'text-primary-500/50'
              : 'text-surface-700',
        )}
      />
      {payloadType && (
        <div
          className={clsx(
            'absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-primary-500/20 bg-surface-800 px-2.5 py-1 text-[11px] font-mono text-primary-300 shadow-lg transition-all duration-200',
            showTooltip
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-1 pointer-events-none',
          )}
        >
          <Braces className="mr-1 inline h-3 w-3" />
          {payloadType}
        </div>
      )}
    </div>
  );
}

export function ApiEndpointsView({ repoId }: ApiEndpointsViewProps): React.ReactNode {
  const [expandedFqn, setExpandedFqn] = useState<string | null>(null);
  const [playingFqn, setPlayingFqn] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const flowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const {
    data: endpoints,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['api-endpoints', repoId],
    queryFn: async () => {
      const nodesRes = await getGraphNodes(repoId, { type: NodeType.ENDPOINT, limit: 100 });
      if (!isSuccessResponse(nodesRes) || !nodesRes.data?.length) return [];

      const cards: EndpointCard[] = [];
      for (const node of nodesRes.data) {
        const flowRes = await getEndpointFlow(repoId, node.fqn);
        const flow = isSuccessResponse(flowRes) ? flowRes.data : null;
        cards.push({
          fqn: node.fqn,
          method: (node.properties.httpMethod as string) ?? 'GET',
          path: (node.properties.path as string) ?? '/',
          steps: flow?.steps ?? [],
          flowAvailable: flow?.flowAvailable ?? false,
        });
      }

      return cards.sort((a, b) => {
        const order = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
        const ma = order.indexOf(a.method);
        const mb = order.indexOf(b.method);
        if (ma !== mb) return ma - mb;
        return a.path.localeCompare(b.path);
      });
    },
    refetchOnWindowFocus: false,
  });

  const handleTogglePlay = useCallback(
    (fqn: string, stepsLength: number) => {
      if (playingFqn === fqn) {
        // Pause
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setPlayingFqn(null);
        return;
      }

      // Play
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPlayingFqn(fqn);
      setActiveStep(0);
      let step = 0;
      intervalRef.current = setInterval(() => {
        step++;
        if (step >= stepsLength) {
          step = 0;
        }
        setActiveStep(step);
      }, 800);
    },
    [playingFqn],
  );

  // Auto-play when expanding
  const handleExpand = useCallback(
    (fqn: string, stepsLength: number) => {
      const willExpand = expandedFqn !== fqn;
      setExpandedFqn(willExpand ? fqn : null);
      if (willExpand && stepsLength > 0 && playingFqn !== fqn) {
        handleTogglePlay(fqn, stepsLength);
      }
    },
    [expandedFqn, playingFqn, handleTogglePlay],
  );

  // Auto-scroll flow container to follow active step
  useEffect(() => {
    if (!playingFqn) return;
    const container = flowRefs.current.get(playingFqn);
    if (!container) return;

    const stepNodes = container.querySelectorAll('[data-step-index]');
    const activeNode = stepNodes[activeStep] as HTMLElement | undefined;
    if (activeNode) {
      activeNode.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeStep, playingFqn]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (isLoading) return <LoadingState />;

  if (error || !endpoints?.length) {
    return (
      <EmptyState
        icon={<Globe className="h-12 w-12" />}
        title="No API endpoints detected"
        description="Sync the repository to analyze its API surface."
      />
    );
  }

  return (
    <div className="space-y-4">
      {endpoints.map((ep, cardIndex) => {
        const isExpanded = expandedFqn === ep.fqn;
        const isPlaying = playingFqn === ep.fqn;
        const m = METHOD_COLORS[ep.method] ?? {
          bg: 'bg-surface-500/10',
          text: 'text-surface-400',
          border: 'border-surface-500/20',
          glow: '',
        };

        return (
          <div
            key={ep.fqn}
            className="animate-fade-in overflow-hidden"
            style={{ animationDelay: `${cardIndex * 60}ms`, animationFillMode: 'backwards' }}
          >
            <div
              className={clsx(
                'rounded-xl border border-white/[0.04] bg-surface-900/60 backdrop-blur-sm transition-all duration-500',
                isExpanded && `border-primary-500/20 ${m.glow} shadow-lg`,
              )}
            >
              {/* Header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleExpand(ep.fqn, ep.steps.length)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleExpand(ep.fqn, ep.steps.length);
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-4 p-5 text-left transition-colors hover:bg-white/[0.02]"
              >
                <span
                  className={clsx(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider',
                    m.bg,
                    m.text,
                    m.border,
                  )}
                >
                  <Route className="h-3 w-3" />
                  {ep.method}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium text-surface-100">
                  {ep.path}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-surface-400">
                  <Activity className="h-3 w-3" />
                  {ep.steps.length} steps
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isExpanded) setExpandedFqn(ep.fqn);
                    handleTogglePlay(ep.fqn, ep.steps.length);
                  }}
                  leftIcon={
                    isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />
                  }
                  className="text-primary-400 hover:text-primary-300"
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <ChevronDown
                  className={clsx(
                    'h-4 w-4 text-surface-500 transition-transform duration-300',
                    isExpanded && 'rotate-180',
                  )}
                />
              </div>

              {/* Expanded flow */}
              <div
                className={clsx(
                  'grid transition-all duration-500 ease-in-out',
                  isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-white/[0.04] px-8 py-10">
                    <div
                      ref={(el) => {
                        if (el) flowRefs.current.set(ep.fqn, el);
                      }}
                      className="flex items-start gap-3 overflow-x-auto pb-2 scrollbar-flow"
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgb(255 255 255 / 0.06) transparent',
                      }}
                    >
                      <style>{`.scrollbar-flow::-webkit-scrollbar{height:4px}.scrollbar-flow::-webkit-scrollbar-track{background:transparent}.scrollbar-flow::-webkit-scrollbar-thumb{background:rgb(255 255 255 / 0.08);border-radius:4px}.scrollbar-flow::-webkit-scrollbar-thumb:hover{background:rgb(255 255 255 / 0.15)}`}</style>
                      {/* Entry */}
                      <div className="flex shrink-0 flex-col items-center gap-2">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-primary-500/20 bg-primary-500/5">
                          <ArrowRight className="h-6 w-6 text-primary-400" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-surface-500">
                          Request
                        </span>
                        <span className="rounded bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono text-surface-400">
                          {ep.method}
                        </span>
                      </div>

                      {/* Flow steps */}
                      {ep.steps.map((step, i) => {
                        const meta = KIND_META[step.kind] ?? {
                          icon: null,
                          label: step.kind,
                          color: 'border-surface-500/20 bg-surface-500/5',
                        };
                        const name = step.nodeLabel || shortName(step.nodeFqn);
                        const parent = parentName(step.nodeFqn);
                        const nextPayload =
                          i < ep.steps.length - 1 ? ep.steps[i + 1].payloadType : null;

                        return (
                          <div key={i} className="flex shrink-0 items-start gap-3">
                            <ConnectorArrow
                              isActive={isPlaying && i === activeStep}
                              isPast={isPlaying && i < activeStep}
                              payloadType={step.payloadType}
                            />

                            <div
                              data-step-index={i}
                              className={clsx(
                                'flex min-w-[140px] flex-col items-center gap-1.5 rounded-2xl border-2 px-5 py-4 transition-all duration-300',
                                meta.color,
                                isPlaying &&
                                  i === activeStep &&
                                  'border-primary-400/60 bg-primary-500/10 shadow-xl shadow-primary-500/20 ring-2 ring-primary-400/40 z-10',
                                isPlaying && i < activeStep && 'opacity-50 saturate-0',
                              )}
                            >
                              <div
                                className={clsx(
                                  'flex items-center gap-1.5',
                                  isPlaying && i === activeStep
                                    ? 'text-primary-300'
                                    : 'text-surface-400',
                                )}
                              >
                                {meta.icon}
                                <span className="text-[11px] font-bold uppercase tracking-wider">
                                  {meta.label}
                                </span>
                              </div>

                              <span
                                className={clsx(
                                  'text-sm font-semibold',
                                  isPlaying && i === activeStep
                                    ? 'text-primary-100'
                                    : 'text-surface-100',
                                )}
                              >
                                {name}
                              </span>

                              {parent && (
                                <span className="max-w-[160px] truncate text-[11px] text-surface-500">
                                  {parent}
                                </span>
                              )}

                              {step.payloadType && (
                                <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-mono text-primary-400">
                                  <Braces className="h-3 w-3" />
                                  {step.payloadType}
                                </span>
                              )}

                              {step.approximate && (
                                <span className="text-[10px] font-medium text-amber-400">
                                  ≈ inferred
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Exit */}
                      <div className="flex shrink-0 items-start gap-3">
                        <ConnectorArrow
                          isActive={isPlaying && activeStep >= ep.steps.length}
                          isPast={isPlaying && activeStep >= ep.steps.length}
                          payloadType={null}
                        />
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/5">
                            <ArrowRight className="h-6 w-6 text-emerald-400" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-surface-500">
                            Response
                          </span>
                          <span className="text-[11px] font-medium text-emerald-400">200 OK</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
