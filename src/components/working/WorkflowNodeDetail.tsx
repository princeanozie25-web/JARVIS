"use client";

// WorkflowBox — the SHARED node detail panel (the node's work + sub-item checklist).
//
// ONE panel, reused by BOTH views: the v1b lane (WorkflowLane) and the v1c map
// (WorkflowMap) open THIS exact component on node click. Marking / adding / editing
// / removing a sub-item, and the binary done mark for a no-sub-item node, all go
// through the SAME injected callbacks (WorkflowLaneActions) wired to the v1a store's
// ONE mutation surface. Because both views share this panel + these callbacks, a
// mark from the map and a mark from the lane are the SAME operation on the SAME
// store — the two views cannot drift.

import { useState } from "react";

import type { LaneNodeView } from "@/lib/workflowbox/lane-view";

/** Mutation callbacks — each is wired by the host to the v1a store's ONE API. */
export interface WorkflowLaneActions {
  toggleSubItem(projectId: string, nodeId: string, subItemId: string): void;
  addSubItem(projectId: string, nodeId: string, title: string): void;
  updateSubItem(
    projectId: string,
    nodeId: string,
    subItemId: string,
    patch: { title?: string; done?: boolean },
  ): void;
  removeSubItem(projectId: string, nodeId: string, subItemId: string): void;
  /** Binary mark for a NO-SUB-ITEM node (done/not-done). */
  markNode(projectId: string, nodeId: string, done: boolean): void;
}

function SubItemRow({
  projectId,
  nodeId,
  item,
  actions,
}: Readonly<{
  projectId: string;
  nodeId: string;
  item: LaneNodeView["sub_items"][number];
  actions?: WorkflowLaneActions;
}>) {
  return (
    <li
      className="wfl-subitem"
      data-sub-item-id={item.id}
      data-done={item.done}
    >
      <label className="wfl-subitem-check">
        <input
          type="checkbox"
          checked={item.done}
          disabled={!actions}
          onChange={() => actions?.toggleSubItem(projectId, nodeId, item.id)}
          aria-label={`Toggle ${item.title}`}
        />
        <span className="wfl-subitem-title">{item.title}</span>
      </label>
      {actions ? (
        <span className="wfl-subitem-controls">
          <input
            className="wfl-subitem-edit"
            type="text"
            defaultValue={item.title}
            aria-label={`Rename ${item.title}`}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next.length > 0 && next !== item.title) {
                actions.updateSubItem(projectId, nodeId, item.id, {
                  title: next,
                });
              }
            }}
          />
          <button
            type="button"
            className="wfl-btn wfl-remove"
            onClick={() => actions.removeSubItem(projectId, nodeId, item.id)}
            aria-label={`Remove ${item.title}`}
          >
            Remove
          </button>
        </span>
      ) : null}
    </li>
  );
}

/** The detail panel both the lane and the map open on node click. */
export function WorkflowNodeDetail({
  projectId,
  node,
  actions,
}: Readonly<{
  projectId: string;
  node: LaneNodeView;
  actions?: WorkflowLaneActions;
}>) {
  const [draft, setDraft] = useState("");
  return (
    <div className="wfl-detail" id={`wfl-detail-${node.id}`}>
      {node.detail ? (
        <p className="wfl-detail-text">{node.detail}</p>
      ) : (
        <p className="wfl-detail-text wfl-detail-empty">No detail yet.</p>
      )}

      {node.has_sub_items ? (
        <>
          <ul className="wfl-checklist">
            {node.sub_items.map((item) => (
              <SubItemRow
                key={item.id}
                projectId={projectId}
                nodeId={node.id}
                item={item}
                actions={actions}
              />
            ))}
          </ul>
          <div className="wfl-derived-note">
            {node.sub_items_done}/{node.sub_items_total} done — {node.percent}%
            (derived)
          </div>
        </>
      ) : (
        <label className="wfl-binary">
          <input
            type="checkbox"
            checked={node.status === "done"}
            disabled={!actions}
            onChange={(event) =>
              actions?.markNode(projectId, node.id, event.target.checked)
            }
            aria-label={`Mark ${node.title} done`}
          />
          <span>Done</span>
        </label>
      )}

      {actions ? (
        <div className="wfl-add">
          <input
            className="wfl-add-input"
            type="text"
            value={draft}
            placeholder="New sub-item…"
            aria-label={`Add a sub-item to ${node.title}`}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="button"
            className="wfl-btn wfl-add-btn"
            onClick={() => {
              const title = draft.trim();
              if (title.length === 0) return;
              actions.addSubItem(projectId, node.id, title);
              setDraft("");
            }}
          >
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default WorkflowNodeDetail;
