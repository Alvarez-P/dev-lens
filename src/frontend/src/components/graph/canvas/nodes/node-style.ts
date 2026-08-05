import type { LucideIcon } from 'lucide-react';
import {
  FolderGit2,
  Package,
  Folder,
  Route,
  Cog,
  Database,
  Layers,
  FileCode,
  Puzzle,
  Link2,
  Cloud,
  HelpCircle,
} from 'lucide-react';
import { NodeType } from '@/lib/visualization/types';

/**
 * Visual vocabulary per KG node type (design.md Node/Edge Visual Mapping —
 * based on the actual `NodeType` enum). Accents are the dark-theme design
 * token hexes from `tailwind.config.ts`.
 */
export type NodeShape =
  | 'diamond'
  | 'diamond-dashed'
  | 'rounded-rect'
  | 'folder'
  | 'hexagon'
  | 'rectangle'
  | 'cylinder'
  | 'pentagon'
  | 'circle'
  | 'chevron'
  | 'cloud';

export type NodeBadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface NodeStyle {
  icon: LucideIcon;
  /** Design accent hex (icon/border/glyph color). */
  accent: string;
  shape: NodeShape;
  badgeVariant: NodeBadgeVariant;
}

export const NODE_STYLE: Record<NodeType, NodeStyle> = {
  [NodeType.PROJECT]: {
    icon: FolderGit2,
    accent: '#caff3a',
    shape: 'diamond',
    badgeVariant: 'info',
  },
  [NodeType.PACKAGE]: {
    icon: Package,
    accent: '#a1a1a4',
    shape: 'rounded-rect',
    badgeVariant: 'default',
  },
  [NodeType.MODULE]: { icon: Folder, accent: '#d6ff2e', shape: 'folder', badgeVariant: 'info' },
  [NodeType.CONTROLLER]: {
    icon: Route,
    accent: '#fbbf24',
    shape: 'hexagon',
    badgeVariant: 'warning',
  },
  [NodeType.SERVICE]: { icon: Cog, accent: '#47e02e', shape: 'rectangle', badgeVariant: 'success' },
  [NodeType.REPOSITORY]: {
    icon: Database,
    accent: '#c9c9cb',
    shape: 'cylinder',
    badgeVariant: 'default',
  },
  [NodeType.ENTITY]: {
    icon: Layers,
    accent: '#a1a1a4',
    shape: 'rounded-rect',
    badgeVariant: 'default',
  },
  [NodeType.DTO]: { icon: FileCode, accent: '#727276', shape: 'pentagon', badgeVariant: 'default' },
  [NodeType.INTERFACE]: { icon: Puzzle, accent: '#d6ff2e', shape: 'circle', badgeVariant: 'info' },
  [NodeType.ENDPOINT]: { icon: Link2, accent: '#e2ff5c', shape: 'chevron', badgeVariant: 'info' },
  [NodeType.EXTERNAL_DEPENDENCY]: {
    icon: Cloud,
    accent: '#505054',
    shape: 'cloud',
    badgeVariant: 'default',
  },
  [NodeType.UNKNOWN]: {
    icon: HelpCircle,
    accent: '#f87171',
    shape: 'diamond-dashed',
    badgeVariant: 'error',
  },
};
