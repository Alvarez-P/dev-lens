# visualization-interaction Specification

> **New capability** | EPIC-007 | Ref: RFC-008 §9, §14

## Purpose

User interaction patterns for the visualization: selection, inspection, context menus, keyboard shortcuts, and the detail panel. All interaction components reuse existing atom patterns from `src/frontend/src/components/atoms/`. Multi-select is disabled for v1.

## Requirements

### REQ-VI-001: Node Selection & Detail Panel

The system MUST render a detail panel (right pane, `.glass-elevated`: `bg-surface-900/80 backdrop-blur-xl`) on node click. The panel SHALL show: type icon, FQN (JetBrains Mono, `text-sm`), label, full properties table, incoming/outgoing edge counts, and "Show Dependencies" / "Show Dependents" action buttons (`<Button variant="secondary" size="sm">`).

**Scenarios:**

- GIVEN a Service node "AuthService" with 5 incoming and 3 outgoing edges
- WHEN the user clicks the node
- THEN the detail panel slides in from the right (`.animate-slide-in` 0.3s)
- AND shows: type icon, FQN, label, properties table, edge counts "5 In / 3 Out"
- AND "Show Dependencies" and "Show Dependents" buttons are visible

- GIVEN the detail panel is open for node A
- WHEN the user clicks node B
- THEN the panel updates to show node B without closing/opening animation

### REQ-VI-002: Edge Interaction

The system MUST show an edge detail popover on edge click: source → target FQNs, edge type (`.badge` with `variant="info"`), and properties. Edge hover SHALL thicken the line + show type label.

**Scenarios:**

- GIVEN a DEPENDS_ON edge from AuthService to UserRepository
- WHEN the user clicks the edge
- THEN a popover shows: "AuthService → UserRepository", badge "DEPENDS_ON"
- WHEN the user hovers the edge
- THEN the edge line thickens and shows a "DEPENDS_ON" label

### REQ-VI-003: Hover Tooltips

The system MUST show a tooltip on node hover (200ms delay) containing: node type icon + label + FQN (monospace). Tooltip SHALL use `.glass-subtle` background, `animate-fade-in` 0.15s entry.

**Scenarios:**

- GIVEN a Controller node "
  AuthController" at `my-project:auth:AuthController`
- WHEN the user hovers for 200ms
- THEN a tooltip appears: [hexagon icon] Controller — AuthController — `my-project:auth:AuthController`

### REQ-VI-004: Context Menu

The system MUST show a context menu on right-click with actions: Copy FQN, Show Dependencies, Show Dependents, Center on Node. Menu SHALL use `.glass-elevated` with issue chip-style entries. Single-select only (clicking elsewhere dismisses).

**Scenarios:**

- GIVEN a node is right-clicked
- WHEN the context menu opens
- THEN four actions are listed
- WHEN "Copy FQN" is clicked
- THEN `my-project:pkg:MyClass` is copied to clipboard

### REQ-VI-005: Keyboard Shortcuts

| Key       | Action                       |
| --------- | ---------------------------- |
| `f`       | Fit view (all nodes visible) |
| `+` / `−` | Zoom in / out (10% step)     |
| `r`       | Reset view to default        |
| `Esc`     | Clear node selection         |
| `Ctrl+F`  | Focus search bar             |
| `1`–`7`   | Switch to view 1–7           |

**Scenarios:**

- GIVEN a node is selected and detail panel is open
- WHEN the user presses `Esc`
- THEN the node is deselected and the detail panel closes
- WHEN the user presses `3`
- THEN the view switches to Dependency Tree

## References

- RFC-008 §9 (Interaction Model), §14 (Accessibility)
- Existing atoms: `button.tsx`, `badge.tsx` for UI patterns
- globals.css: `.glass-elevated`, `.glass-subtle`, `.animate-fade-in`, `.animate-slide-in`
- `atoms/input.tsx` for search bar reference
