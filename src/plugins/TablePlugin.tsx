/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { JSX } from 'react';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  INSERT_TABLE_COMMAND,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { EditorThemeClasses, Klass, LexicalEditor, LexicalNode } from 'lexical';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import Button from '../ui/Button';
import { DialogActions } from '../ui/Dialog';
import TextInput from '../ui/TextInput';

export type InsertTableCommandPayload = Readonly<{
  columns: string;
  rows: string;
  includeHeaders?: boolean;
}>;

export type CellContextShape = {
  cellEditorConfig: null | CellEditorConfig;
  cellEditorPlugins: null | JSX.Element | Array<JSX.Element>;
  set: (
    cellEditorConfig: null | CellEditorConfig,
    cellEditorPlugins: null | JSX.Element | Array<JSX.Element>,
  ) => void;
};

export type CellEditorConfig = Readonly<{
  namespace: string;
  nodes?: ReadonlyArray<Klass<LexicalNode>>;
  onError: (error: Error, editor: LexicalEditor) => void;
  readOnly?: boolean;
  theme?: EditorThemeClasses;
}>;

export const CellContext = createContext<CellContextShape>({
  cellEditorConfig: null,
  cellEditorPlugins: null,
  set: () => {
    // Empty
  },
});

export function TableContext({ children }: { children: JSX.Element }) {
  const [contextValue, setContextValue] = useState<{
    cellEditorConfig: null | CellEditorConfig;
    cellEditorPlugins: null | JSX.Element | Array<JSX.Element>;
  }>({
    cellEditorConfig: null,
    cellEditorPlugins: null,
  });
  return (
    <CellContext.Provider
      value={useMemo(
        () => ({
          cellEditorConfig: contextValue.cellEditorConfig,
          cellEditorPlugins: contextValue.cellEditorPlugins,
          set: (cellEditorConfig, cellEditorPlugins) => {
            setContextValue({ cellEditorConfig, cellEditorPlugins });
          },
        }),
        [contextValue.cellEditorConfig, contextValue.cellEditorPlugins],
      )}
    >
      {children}
    </CellContext.Provider>
  );
}

const ROW_MIN = 1;
const ROW_MAX = 500;
const COL_MIN = 1;
const COL_MAX = 30;

function getRowHelperText(value: string): string | null {
  const num = Number(value);
  if (value === '') return null;
  if (isNaN(num) || !Number.isInteger(num))
    return 'Please enter a whole number.';
  if (num < ROW_MIN) return `Minimum number of rows is ${ROW_MIN}.`;
  if (num > ROW_MAX) return `Maximum number of rows is ${ROW_MAX}.`;
  return null;
}

function getColumnHelperText(value: string): string | null {
  const num = Number(value);
  if (value === '') return null;
  if (isNaN(num) || !Number.isInteger(num))
    return 'Please enter a whole number.';
  if (num < COL_MIN) return `Minimum number of columns is ${COL_MIN}.`;
  if (num > COL_MAX) return `Maximum number of columns is ${COL_MAX}.`;
  return null;
}

export function InsertTableDialog({
  activeEditor,
  onClose,
}: {
  activeEditor: LexicalEditor;
  onClose: () => void;
}): JSX.Element {
  const [rows, setRows] = useState('5');
  const [columns, setColumns] = useState('5');
  const [isDisabled, setIsDisabled] = useState(true);

  const rowHelperText = getRowHelperText(rows);
  const columnHelperText = getColumnHelperText(columns);

  useEffect(() => {
    const row = Number(rows);
    const column = Number(columns);
    if (
      row &&
      row >= ROW_MIN &&
      row <= ROW_MAX &&
      column &&
      column >= COL_MIN &&
      column <= COL_MAX
    ) {
      setIsDisabled(false);
    } else {
      setIsDisabled(true);
    }
  }, [rows, columns]);

  const onClick = () => {
    activeEditor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns,
      rows,
    });

    onClose();
  };

  return (
    <>
      <TextInput
        placeholder={`# of rows (${ROW_MIN}–${ROW_MAX})`}
        label="Rows"
        onChange={setRows}
        value={rows}
        data-test-id="table-modal-rows"
        type="number"
        helperText={rowHelperText}
      />
      <TextInput
        placeholder={`# of columns (${COL_MIN}–${COL_MAX})`}
        label="Columns"
        onChange={setColumns}
        value={columns}
        data-test-id="table-modal-columns"
        type="number"
        helperText={columnHelperText}
      />
      <DialogActions data-test-id="table-model-confirm-insert">
        <Button
          disabled={isDisabled}
          onClick={onClick}
          title={
            isDisabled
              ? `Enter rows (${ROW_MIN}–${ROW_MAX}) and columns (${COL_MIN}–${COL_MAX}) to insert a table`
              : undefined
          }
        >
          Confirm
        </Button>
      </DialogActions>
    </>
  );
}

export function TablePlugin({
  cellEditorConfig,
  children,
}: {
  cellEditorConfig: CellEditorConfig;
  children: JSX.Element | Array<JSX.Element>;
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const cellContext = useContext(CellContext);
  useEffect(() => {
    if (!editor.hasNodes([TableNode, TableRowNode, TableCellNode])) {
      throw new Error(
        'TablePlugin: TableNode, TableRowNode, or TableCellNode is not registered on editor',
      );
    }
  }, [editor]);
  useEffect(() => {
    cellContext.set(cellEditorConfig, children);
  }, [cellContext, cellEditorConfig, children]);
  return null;
}
