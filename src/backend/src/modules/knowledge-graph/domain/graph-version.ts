/**
 * Minimum graph snapshot version that carries endpoint-flow data
 * (INVOKES/INJECTS/DEPENDS_ON edges + endpoint lifecycle projection).
 * Snapshots below this version are pre-flow-data and return
 * `flowAvailable: false` from the flow API (REQ-FLOW).
 */
export const GRAPH_FLOW_VERSION = 2;
