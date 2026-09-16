/**
 * A request to focus one specific task inside whichever `QuestBoard` view is
 * currently active (Matrix, Tree, or Command Deck), set by `QuestBoard`
 * when the user clicks a result in its shared search dropdown. `nonce` (not
 * just `taskId`) lets the same task be re-selected twice in a row and still
 * re-trigger the jump/highlight, since object identity alone wouldn't be
 * enough once a consuming view ends up comparing primitive fields to decide
 * "is this a new request." Each consumer keeps its own "have I already
 * handled this nonce" ref rather than sharing one, since only one of them is
 * ever mounted at a time (`QuestBoard`'s `TabsContent` panes unmount
 * inactive tabs) and each has its own idea of what "focusing" means (Tree
 * pans/zooms to it, Matrix scrolls to and rings it, Command Deck selects its
 * trader and task).
 */
export interface TaskFocusRequest {
  taskId: string;
  nonce: number;
}

/** How long a search-dropdown jump's target stays visually highlighted (ring + pulse) before fading back to its normal styling. Shared by `QuestTreeView` and `QuestSwimlaneMatrix` so the two board views' search-jump feel identical. */
export const TASK_FOCUS_HIGHLIGHT_MS = 2200;
