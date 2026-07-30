# RFC-008 — Visualization Engine

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the Visualization Engine, the bounded context responsible for rendering the Knowledge Graph as an interactive, high-performance visual experience.

The Visualization Engine is not a diagramming tool. It is the primary user interface for understanding software architecture — the visual manifestation of the principle "Visual First" defined in PRODUCT_CONTEXT.md.

Users should explore systems through interactive graphs, not file trees.

---

# 2. Motivation

Software architecture is inherently relational. Modules depend on modules. Services call services. Events flow between producers and consumers.

Text-based navigation — file trees, code search, grep — forces developers to reconstruct these relationships mentally. Every dependency traversal requires opening another file. Every architectural question requires assembling a mental model from scattered observations.

Visual exploration reduces this cognitive load by making relationships explicit, immediate, and navigable.

A developer should understand a system's architecture by looking at it — not by reading about it.

---

# 3. Goals

The Visualization Engine must:

- Render the Knowledge Graph as an interactive graph visualization.
- Support hierarchical navigation (Repository → Module → Domain → Service).
- Provide multiple visualization modes (graph, tree, list, matrix).
- Maintain 60 FPS during zoom, pan, and node interaction.
- Render incrementally — users see results before the full graph loads.
- Adapt layout algorithms to graph size and structure.
- Integrate with Search (RFC-012) for node discovery.
- Integrate with AI (RFC-009) for contextual explanations.
- Remain framework-agnostic at the rendering layer.
- Support theming (light, dark, high-contrast).
- Be accessible (keyboard navigation, screen reader support for graph structure).

---

# 4. Non-Goals

This RFC does **not** define:

- How the Knowledge Graph is built (see RFC-007).
- How search indexes are constructed (see RFC-012).
- How AI generates explanations (see RFC-009, RFC-010).
- How documentation is exported (see RFC-011).
- The specific UI component library.
- The exact color palette or typography.

---

# 5. Architecture

## 5.1 Layered Design

```text
Knowledge Graph API (RFC-007)
        │
        ▼
Visualization Data Layer
  - Graph data fetching
  - Incremental loading
  - Progressive detail
  - Layout computation
        │
        ▼
Rendering Layer
  - Canvas / WebGL rendering
  - DOM overlay for interactivity
  - Animation system
  - Viewport management
        │
        ▼
Interaction Layer
  - Zoom, pan, drag
  - Node selection
  - Context menus
  - Keyboard shortcuts
        │
        ▼
User Interface
  - Toolbar
  - Legend
  - Minimap
  - Detail panel
  - Search integration
```

## 5.2 Separation of Concerns

- The **Data Layer** knows what to render (graph structure).
- The **Rendering Layer** knows how to render (pixels on screen).
- The **Interaction Layer** knows how users navigate (gestures, clicks).
- The **UI Layer** provides chrome and controls.

Layers communicate through events, not direct method calls. This allows replacing the rendering technology without touching interaction logic.

---

# 6. Visualization Modes

## 6.1 Graph View (Default)

Force-directed or hierarchical layout showing nodes as shapes and relationships as edges.

- **Nodes**: colored by type (Module = blue, Service = green, Controller = orange, Event = purple, External = gray).
- **Edges**: styled by relationship type (solid = dependency, dashed = event, dotted = implementation).
- **Direction**: edges flow left-to-right or top-to-bottom, configurable.
- **Clustering**: related nodes collapse into groups at higher zoom levels.

## 6.2 Dependency Matrix

Grid view where rows and columns are modules/services. Colored cells indicate dependency strength.

- Useful for identifying highly coupled modules.
- Supports sorting by dependency count, cohesion, and coupling metrics.
- Clicking a cell expands to show the specific relationships.

## 6.3 Tree View

Hierarchical expandable tree: Repository → Package → Module → Service → Endpoint.

- Familiar to developers accustomed to file explorers.
- Each node shows relationship counts (dependencies, dependents).
- Right-click reveals graph view centered on the selected node.

## 6.4 Event Flow View

Sankey-style or sequence diagram showing event publication and consumption chains.

- Left: producers; Right: consumers; Edges: event types.
- Thickness represents event volume (when available from runtime data).
- Click an event to see its full journey through the system.

## 6.5 Domain Map

High-level view of bounded contexts and their relationships.

- Each bounded context is a region.
- Aggregates and entities appear within their context.
- Cross-context dependencies are highlighted.
- Contexts can be expanded to reveal internal structure.

## 6.6 Architecture Layers

Vertical stack showing architectural layers (Presentation → Application → Domain → Infrastructure).

- Nodes are placed in their detected layer.
- Layer violations (e.g., Domain depending on Infrastructure) are highlighted in red.
- Useful for architecture governance and review.

---

# 7. Rendering Technology

## 7.1 Primary: Canvas/WebGL

For graphs with more than 200 nodes, WebGL rendering via a library like `react-force-graph` or a custom renderer using `pixi.js` or `three.js`.

- GPU-accelerated node positioning.
- Smooth animations at 60 FPS.
- Texture-based node rendering for performance.

## 7.2 Fallback: SVG/DOM

For graphs with fewer than 200 nodes, SVG rendering via a library like `react-flow` or `d3.js`.

- Better accessibility (DOM nodes are inspectable).
- Easier CSS styling.
- Simpler interaction model.

## 7.3 Hybrid Mode

The engine selects the rendering backend at runtime based on:
- Number of visible nodes.
- Device GPU capability (detected via WebGL support).
- User preference (performance vs. accessibility).

---

# 8. Progressive Loading

Large repositories may contain thousands of nodes. Rendering all nodes simultaneously degrades performance and overwhelms users.

## 8.1 Strategy

1. **Initial load**: top-level nodes only (modules, bounded contexts, top-level services).
2. **Viewport-based loading**: load detail nodes as the user zooms into a region.
3. **Relationship-on-demand**: show only direct relationships initially; load transitive edges on expansion.
4. **Detail levels**: each node has `overview`, `standard`, and `detailed` representations.

## 8.2 Transitions

When loading additional detail:
- New nodes animate into position (fade + scale).
- Existing nodes shift smoothly to accommodate new layout.
- A skeleton indicator shows loading regions.

---

# 9. Interaction Model

## 9.1 Navigation

| Action | Gesture |
|---|---|
| Pan | Click + drag on empty space |
| Zoom | Scroll wheel / pinch |
| Select node | Click |
| Select multiple | Shift + click / drag selection box |
| Open detail | Double-click / Enter |
| Context menu | Right-click |
| Fit to screen | F key |
| Search | Ctrl+K / Cmd+K |
| Reset view | Escape |

## 9.2 Node Interaction

- **Hover**: tooltip with node type, name, and summary stats.
- **Click**: select node, highlight its direct relationships, show detail panel.
- **Double-click**: focus view on this node and its neighborhood.
- **Right-click**: context menu with actions (Explain with AI, Show dependencies, Show dependents, View source, Copy path).

## 9.3 Keyboard Navigation

Full keyboard accessibility:
- Tab: move between nodes.
- Arrow keys: navigate relationships.
- Enter: select/open.
- Numbers 1-6: switch visualization mode.

---

# 10. Layout Algorithms

The engine selects layout algorithms based on graph characteristics:

| Graph Shape | Algorithm | Use Case |
|---|---|---|
| Tree-like (modules → classes) | Layered (Sugiyama) | Module hierarchy |
| Mesh (service dependencies) | Force-directed (d3-force) | Service mesh |
| Sequential (event chains) | Layered left-to-right | Event flows |
| Matrix | Grid (row/column) | Dependency matrix |
| Clustered | Force-directed with clustering | Large graphs |

Users can switch algorithms manually. The engine defaults to the best-fit algorithm for the current graph shape.

---

# 11. Theming

The Visualization Engine supports:

- **Light theme**: white background, high contrast edges, accessible color palette.
- **Dark theme**: dark background, bright nodes, reduced eye strain.
- **High contrast**: maximum contrast, thick edges, large hit targets.
- **Custom themes**: organization-level theming for white-label deployments.

Colors are semantic (Module = blue), not decorative. Color is never the sole differentiator (icons and shapes provide redundancy).

---

# 12. Integration Points

## 12.1 Search Integration (RFC-012)

- Search results highlight matching nodes in the graph.
- Selecting a search result navigates the graph view to that node.
- The minimap shows search result distribution.

## 12.2 AI Integration (RFC-009)

- "Explain this" context menu action triggers AI explanation of the selected node.
- AI responses appear in a side panel without disrupting the graph view.
- AI can suggest "Show me the dependency chain" which triggers graph navigation.

## 12.3 Documentation Integration (RFC-011)

- "Export view" captures the current visualization as Mermaid/PlantUML.
- Documentation exports include the current graph state as an embedded diagram.

## 12.4 Metrics Integration (RFC-013)

- Nodes can be colored by metric values (e.g., coupling score = red-to-green gradient).
- Metrics panel overlays quantitative data on the graph.

---

# 13. Performance Targets

| Metric | Target |
|---|---|
| Initial render (100 nodes) | < 500ms |
| Initial render (1000 nodes, progressive) | < 2s to first meaningful paint |
| Frame rate (pan/zoom) | 60 FPS |
| Frame rate (500+ nodes animating) | ≥ 30 FPS |
| Memory (5000 nodes loaded) | < 200MB |
| Node selection response | < 16ms |
| Mode switch (graph → matrix) | < 300ms |

Virtual rendering ensures only visible nodes consume GPU resources. Off-screen nodes are culled.

---

# 14. Accessibility

- All graph interactions are achievable via keyboard.
- Graph structure is exposed as an ARIA tree for screen readers.
- Node labels are always readable at any zoom level (dynamic font sizing).
- Color is never the sole differentiator — nodes have distinct shapes and icons.
- High-contrast mode meets WCAG 2.1 AA contrast ratios.

---

# 15. Future Considerations

- **3D graph rendering**: optional third dimension for very large graphs.
- **VR/AR exploration**: immersive architecture walkthroughs.
- **Collaborative viewing**: multiple users viewing the same graph simultaneously.
- **Custom layout algorithms**: user-defined layout strategies.
- **Animation recording**: export graph navigation as video for presentations.
- **Timeline scrubber**: animate graph evolution across commits (requires RFC-007 historical snapshots).

---

# 16. References

- RFC-001 — Architecture Principles (Visual First principle)
- RFC-002 — System Architecture
- RFC-007 — Knowledge Extraction Platform
- RFC-009 — AI Orchestration
- RFC-012 — Search & Discovery
- EPIC-007 — Visualization
- PRODUCT_CONTEXT.md — Section 5 (Product Principles, #2: Visual First)
