import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isTableNode, TableNode } from '@lexical/table';
import { $getRoot } from 'lexical';
import { useEffect, useRef } from 'react';
import { usePageSize } from '../context/PageSizeContext';

function redistributeAllTables(
  root: ReturnType<typeof $getRoot>,
  containerWidth: number,
) {
  const visit = (node: any) => {
    if ($isTableNode(node)) {
      const numColumns = node.getColumnCount();
      if (numColumns === 0) return;

      node.setColWidths(
        Array.from({ length: numColumns }, (_, i) => {
          const allocated = Math.round((containerWidth * (i + 1)) / numColumns);
          const previous = Math.round((containerWidth * i) / numColumns);
          return allocated - previous;
        }),
      );
    }
    if ('getChildren' in node) {
      for (const child of node.getChildren()) {
        visit(child);
      }
    }
  };

  visit(root);
}

export default function TableResizeOnPageChangePlugin(): null {
  const [editor] = useLexicalComposerContext();
  const { widthAfterMargin } = usePageSize();

  // Keep a ref so the mutation listener always sees the latest value
  // without needing to be re-registered on every width change
  const widthRef = useRef(widthAfterMargin);
  useEffect(() => {
    widthRef.current = widthAfterMargin;
  }, [widthAfterMargin]);

  // 1️⃣ Re-distribute when the page / margin changes (existing behaviour)
  useEffect(() => {
    editor.update(() => {
      redistributeAllTables($getRoot(), widthAfterMargin);
    });
  }, [editor, widthAfterMargin]);

  // 2️⃣ Re-distribute when a column is added to any table.
  //
  // Why not check `numColumns > colWidths.length`:
  //   TableCellResizerPlugin's registerNodeTransform runs in the same commit
  //   as the insertion and pads colWidths with MIN_COLUMN_WIDTH (92px), so by
  //   the time this mutation listener fires both lengths are already equal.
  //
  // Instead we check whether the sum of colWidths exceeds the container —
  // that is only true when a new MIN_COLUMN_WIDTH column was appended and
  // has pushed the total over the available width.
  useEffect(() => {
    return editor.registerMutationListener(
      TableNode,
      (mutations) => {
        let needsUpdate = false;

        editor.getEditorState().read(() => {
          for (const [nodeKey, mutation] of mutations) {
            if (mutation !== 'updated') continue;

            const tableNode = editor.getEditorState()._nodeMap.get(nodeKey);
            if (!tableNode || !$isTableNode(tableNode)) continue;

            const colWidths = tableNode.getColWidths() ?? [];
            const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);

            // totalWidth exceeds container → a new column was added at its
            // default MIN_COLUMN_WIDTH and is now overflowing
            if (totalWidth > widthRef.current + 1) {
              needsUpdate = true;
              break;
            }
          }
        });

        if (needsUpdate) {
          editor.update(() => {
            redistributeAllTables($getRoot(), widthRef.current);
          });
        }
      },
      { skipInitialization: true },
    );
  }, [editor]);

  return null;
}
