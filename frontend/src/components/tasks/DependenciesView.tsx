import { useCallback, useMemo, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeTypes,
  Handle,
  Position,
  MarkerType,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { TaskWithAttemptStatus, TaskStatus } from 'shared/types';
import { cn } from '@/lib/utils';
import {
  Circle,
  Play,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface DependenciesViewProps {
  tasks: TaskWithAttemptStatus[];
  selectedTaskId?: string;
  onViewTaskDetails: (task: TaskWithAttemptStatus) => void;
}

// Modern status styling - left border accent + subtle background
const statusConfig: Record<
  TaskStatus,
  { border: string; bg: string; badge: string; icon: React.ElementType; label: string }
> = {
  todo: {
    border: 'border-l-slate-400',
    bg: 'bg-white dark:bg-slate-900',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    icon: Circle,
    label: 'Todo',
  },
  inprogress: {
    border: 'border-l-blue-500',
    bg: 'bg-white dark:bg-slate-900',
    badge: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    icon: Play,
    label: 'In Progress',
  },
  inreview: {
    border: 'border-l-amber-500',
    bg: 'bg-white dark:bg-slate-900',
    badge: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    icon: Eye,
    label: 'In Review',
  },
  done: {
    border: 'border-l-emerald-500',
    bg: 'bg-white dark:bg-slate-900',
    badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    icon: CheckCircle2,
    label: 'Done',
  },
  cancelled: {
    border: 'border-l-gray-400',
    bg: 'bg-gray-50 dark:bg-slate-900',
    badge: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
    icon: XCircle,
    label: 'Cancelled',
  },
};

// Custom node component - modern card design
interface TaskNodeData {
  label: string;
  status: TaskStatus;
  task: TaskWithAttemptStatus;
  onViewTaskDetails: (task: TaskWithAttemptStatus) => void;
  isSelected: boolean;
}

function TaskNode({ data }: { data: TaskNodeData }) {
  const config = statusConfig[data.status];
  const StatusIcon = config.icon;

  const handleClick = useCallback(() => {
    data.onViewTaskDetails(data.task);
  }, [data]);

  return (
    <>
      {/* Target handle - left side */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-300 dark:!bg-slate-600 !border-2 !border-white dark:!border-slate-800"
      />

      <div
        onClick={handleClick}
        className={cn(
          // Base card styling - fixed size
          'w-[220px] h-[72px] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700',
          'border-l-4 cursor-pointer transition-all duration-200',
          'flex flex-col justify-between',
          // Shadow & hover
          'shadow-sm hover:shadow-md',
          // Status-specific
          config.bg,
          config.border,
          // Selection ring
          data.isSelected && 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900'
        )}
      >
        {/* Title */}
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">
              {data.label}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              config.badge
            )}
          >
            <StatusIcon className="w-3 h-3" />
            {config.label}
          </span>
        </div>
      </div>

      {/* Source handle - right side */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-300 dark:!bg-slate-600 !border-2 !border-white dark:!border-slate-800"
      />
    </>
  );
}

const nodeTypes: NodeTypes = {
  task: TaskNode,
};

// ELK layout configuration
const elk = new ELK();

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.nodeNodeBetweenLayers': '150',
  'elk.layered.spacing.edgeNodeBetweenLayers': '40',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
};

async function getLayoutedElements(
  nodes: Node[],
  edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const graph = {
    id: 'root',
    layoutOptions: elkOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: 220,
      height: 72,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layoutedGraph = await elk.layout(graph);

  return {
    nodes: nodes.map((node) => {
      const layoutedNode = layoutedGraph.children?.find((n) => n.id === node.id);
      return {
        ...node,
        position: {
          x: layoutedNode?.x ?? 0,
          y: layoutedNode?.y ?? 0,
        },
      };
    }),
    edges,
  };
}

// Default edge style
const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: {
    stroke: '#94a3b8',
    strokeWidth: 2,
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color: '#94a3b8',
  },
};

export function DependenciesView({
  tasks,
  selectedTaskId,
  onViewTaskDetails,
}: DependenciesViewProps) {
  const [isLayouting, setIsLayouting] = useState(true);

  // Convert tasks to React Flow nodes
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node<TaskNodeData>[] = tasks.map((task, index) => {
      const status = task.status.toLowerCase() as TaskStatus;
      // Default grid position (will be overridden by ELK)
      const x = task.dag_position_x ?? (index % 4) * 300;
      const y = task.dag_position_y ?? Math.floor(index / 4) * 120;

      return {
        id: task.id,
        type: 'task',
        position: { x, y },
        data: {
          label: task.title,
          status,
          task,
          onViewTaskDetails,
          isSelected: task.id === selectedTaskId,
        },
      };
    });

    // TODO: Get actual dependencies from backend
    // For now, create sample edges based on phase order (demo)
    const edges: Edge[] = [];

    // Create edges from task dependencies if available
    // This will be populated when dependency data is available from backend

    return { initialNodes: nodes, initialEdges: edges };
  }, [tasks, selectedTaskId, onViewTaskDetails]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Apply ELK layout
  useEffect(() => {
    const applyLayout = async () => {
      setIsLayouting(true);
      try {
        if (initialEdges.length > 0) {
          // Use ELK layout if there are edges
          const { nodes: layoutedNodes, edges: layoutedEdges } =
            await getLayoutedElements(initialNodes, initialEdges);
          setNodes(layoutedNodes);
          setEdges(layoutedEdges);
        } else {
          // Fallback: arrange by status columns (left to right)
          const statusOrder: TaskStatus[] = ['todo', 'inprogress', 'inreview', 'done', 'cancelled'];
          const tasksByStatus: Record<TaskStatus, Node<TaskNodeData>[]> = {
            todo: [],
            inprogress: [],
            inreview: [],
            done: [],
            cancelled: [],
          };

          initialNodes.forEach((node) => {
            const status = node.data.status;
            tasksByStatus[status].push(node);
          });

          const columnWidth = 280;
          const rowHeight = 100;
          const startY = 50;

          const layoutedNodes = statusOrder.flatMap((status, colIndex) =>
            tasksByStatus[status].map((node, rowIndex) => ({
              ...node,
              position: {
                x: colIndex * columnWidth + 50,
                y: startY + rowIndex * rowHeight,
              },
            }))
          );

          setNodes(layoutedNodes);
          setEdges(initialEdges);
        }
      } finally {
        setIsLayouting(false);
      }
    };

    applyLayout();
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div className="w-full h-full relative">
      {isLayouting && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-10">
          <div className="text-sm text-slate-500">Loading layout...</div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{
          padding: 0.3,
          maxZoom: 1.2,
          minZoom: 0.3,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-50 dark:bg-slate-950"
      >
        <Controls
          className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700 !rounded-lg !shadow-sm"
          showInteractive={false}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#e2e8f0"
          className="dark:!bg-slate-950"
        />
      </ReactFlow>
    </div>
  );
}
