// src/plugins/tableUtils.ts
import {
  $getTableNodeFromLexicalNodeOrThrow,
  $isTableCellNode,
} from '@lexical/table';
import { $getSelection, $isRangeSelection } from 'lexical';

export function $redistributeTableColWidths(containerWidth: number): void {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return;

  const cell = selection.anchor.getNode().getParents().find($isTableCellNode);
  if (!cell || !$isTableCellNode(cell)) return;

  const tableNode = $getTableNodeFromLexicalNodeOrThrow(cell);
  const numColumns = tableNode.getColumnCount();
  if (numColumns === 0) return;

  const colWidths = Array.from({ length: numColumns }, (_, i) => {
    // Distribute pixels left-to-right so rounding is spread across columns,
    // rather than piling remainder onto the last one
    const allocated = Math.round((containerWidth * (i + 1)) / numColumns);
    const previous = Math.round((containerWidth * i) / numColumns);
    return allocated - previous;
  });

  tableNode.setColWidths(colWidths);
}
