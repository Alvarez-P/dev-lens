import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
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
import type { GraphNode } from '@/lib/visualization/types';
import { nodeTypes } from '../index';
import { NODE_STYLE } from '../node-style';

function makeNode(type: NodeType, label = 'AuthService'): GraphNode {
  return {
    id: `n-${type}`,
    type,
    label,
    fqn: `fqn/${label}`,
    properties: {},
    repoId: 'repo-1',
    version: 1,
    deprecatedAt: null,
  };
}

/** Full NodeProps surface React Flow hands to a custom node. */
function makeNodeProps(node: GraphNode): NodeProps {
  return {
    id: node.id,
    type: node.type,
    data: { node },
    dragging: false,
    zIndex: 0,
    selectable: true,
    deletable: false,
    selected: false,
    draggable: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
}

describe('node style config (VE-001 visual mapping)', () => {
  it('covers every NodeType in the enum with a distinct icon', () => {
    for (const type of Object.values(NodeType)) {
      expect(NODE_STYLE[type], `missing style for ${type}`).toBeDefined();
    }

    const icons = Object.values(NODE_STYLE).map((style) => style.icon);
    expect(new Set(icons).size).toBe(Object.values(NodeType).length);
  });

  it('maps the design accents to the correct node types', () => {
    expect(NODE_STYLE[NodeType.PROJECT].accent).toBe('#caff3a'); // primary-500
    expect(NODE_STYLE[NodeType.MODULE].accent).toBe('#d6ff2e'); // primary-400
    expect(NODE_STYLE[NodeType.INTERFACE].accent).toBe('#d6ff2e'); // primary-400
    expect(NODE_STYLE[NodeType.ENDPOINT].accent).toBe('#e2ff5c'); // primary-300
    expect(NODE_STYLE[NodeType.CONTROLLER].accent).toBe('#fbbf24'); // warning-400
    expect(NODE_STYLE[NodeType.SERVICE].accent).toBe('#47e02e'); // success-400
    expect(NODE_STYLE[NodeType.UNKNOWN].accent).toBe('#f87171'); // error-400
    expect(NODE_STYLE[NodeType.EXTERNAL_DEPENDENCY].accent).toBe('#505054'); // surface-500
  });

  it('assigns the documented lucide icons per type', () => {
    expect(NODE_STYLE[NodeType.PROJECT].icon).toBe(FolderGit2);
    expect(NODE_STYLE[NodeType.PACKAGE].icon).toBe(Package);
    expect(NODE_STYLE[NodeType.MODULE].icon).toBe(Folder);
    expect(NODE_STYLE[NodeType.CONTROLLER].icon).toBe(Route);
    expect(NODE_STYLE[NodeType.SERVICE].icon).toBe(Cog);
    expect(NODE_STYLE[NodeType.REPOSITORY].icon).toBe(Database);
    expect(NODE_STYLE[NodeType.ENTITY].icon).toBe(Layers);
    expect(NODE_STYLE[NodeType.DTO].icon).toBe(FileCode);
    expect(NODE_STYLE[NodeType.INTERFACE].icon).toBe(Puzzle);
    expect(NODE_STYLE[NodeType.ENDPOINT].icon).toBe(Link2);
    expect(NODE_STYLE[NodeType.EXTERNAL_DEPENDENCY].icon).toBe(Cloud);
    expect(NODE_STYLE[NodeType.UNKNOWN].icon).toBe(HelpCircle);
  });
});

describe('custom node components (12 types)', () => {
  for (const type of Object.values(NodeType)) {
    it(`renders ${type} with icon, label and type badge`, () => {
      const Component = nodeTypes[type];
      const node = makeNode(type, `Node-${type}`);

      render(<Component {...makeNodeProps(node)} />);

      const root = screen.getByTestId('node');
      expect(root.getAttribute('data-node-type')).toBe(type);
      expect(root.getAttribute('data-accent')).toBe(NODE_STYLE[type].accent);
      expect(screen.getByTestId('node-label')).toHaveTextContent(`Node-${type}`);
      expect(screen.getByTestId('node-type-badge')).toHaveTextContent(type);
      expect(root.querySelector('svg')).not.toBeNull();
    });
  }

  it('shows the deprecated indicator when deprecatedAt is set', () => {
    const node = makeNode(NodeType.SERVICE);
    node.deprecatedAt = '2026-01-01T00:00:00Z';
    const Component = nodeTypes[NodeType.SERVICE];

    render(<Component {...makeNodeProps(node)} />);

    expect(screen.getByTestId('node-deprecated')).toBeInTheDocument();
  });

  it('omits the deprecated indicator when the node is active', () => {
    const Component = nodeTypes[NodeType.SERVICE];

    render(<Component {...makeNodeProps(makeNode(NodeType.SERVICE))} />);

    expect(screen.queryByTestId('node-deprecated')).not.toBeInTheDocument();
  });

  it('renders hover tooltip with type icon, label and FQN (REQ-VI-003)', () => {
    const node = makeNode(NodeType.CONTROLLER, 'AuthController');
    node.fqn = 'com.example.auth.AuthController';
    const Component = nodeTypes[NodeType.CONTROLLER];

    render(<Component {...makeNodeProps(node)} />);

    // Tooltip is always in the DOM (opacity-0 by default, group-hover:opacity-100 via CSS)
    const tooltip = screen.getByTestId('node-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('AuthController');
    expect(tooltip).toHaveTextContent('Controller');
    expect(tooltip).toHaveTextContent('com.example.auth.AuthController');
    // Verify the tooltip has an SVG icon (lucide)
    expect(tooltip.querySelector('svg')).not.toBeNull();
  });
});
