import type { JSX } from 'react';

import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { CharacterLimitPlugin } from '@lexical/react/LexicalCharacterLimitPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin';
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin';
import {
  CollaborationPlugin,
  CollaborationPluginV2__EXPERIMENTAL,
} from '@lexical/react/LexicalCollaborationPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { SelectionAlwaysOnDisplay } from '@lexical/react/LexicalSelectionAlwaysOnDisplay';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { CAN_USE_DOM } from '@lexical/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Doc } from 'yjs';

import {
  createWebsocketProvider,
  createWebsocketProviderWithDoc,
} from './collaboration';
import { useSettings } from './context/SettingsContext';
import { useSharedHistoryContext } from './context/SharedHistoryContext';
import AutocompletePlugin from './plugins/AutocompletePlugin';
import AutoEmbedPlugin from './plugins/AutoEmbedPlugin';
import AutoLinkPlugin from './plugins/AutoLinkPlugin';
import CodeActionMenuPlugin from './plugins/CodeActionMenuPlugin';
import CodeHighlightPrismPlugin from './plugins/CodeHighlightPrismPlugin';
import CodeHighlightShikiPlugin from './plugins/CodeHighlightShikiPlugin';
import CollapsiblePlugin from './plugins/CollapsiblePlugin';
import ComponentPickerPlugin from './plugins/ComponentPickerPlugin';
import ContextMenuPlugin from './plugins/ContextMenuPlugin';
import DateTimePlugin from './plugins/DateTimePlugin';
import DragDropPaste from './plugins/DragDropPastePlugin';
import DraggableBlockPlugin from './plugins/DraggableBlockPlugin';
import EmojiPickerPlugin from './plugins/EmojiPickerPlugin';
import EmojisPlugin from './plugins/EmojisPlugin';
import EquationsPlugin from './plugins/EquationsPlugin';
import ExcalidrawPlugin from './plugins/ExcalidrawPlugin';
import FigmaPlugin from './plugins/FigmaPlugin';
import FloatingLinkEditorPlugin from './plugins/FloatingLinkEditorPlugin';
import FloatingTextFormatToolbarPlugin from './plugins/FloatingTextFormatToolbarPlugin';
import ImagesPlugin from './plugins/ImagesPlugin';
import KeywordsPlugin from './plugins/KeywordsPlugin';
import { LayoutPlugin } from './plugins/LayoutPlugin/LayoutPlugin';
import LinkPlugin from './plugins/LinkPlugin';
import MarkdownShortcutPlugin from './plugins/MarkdownShortcutPlugin';
import { MaxLengthPlugin } from './plugins/MaxLengthPlugin';
import MentionsPlugin from './plugins/MentionsPlugin';
import PageBreakPlugin from './plugins/PageBreakPlugin';
import PollPlugin from './plugins/PollPlugin';
import ShortcutsPlugin from './plugins/ShortcutsPlugin';
import SpecialTextPlugin from './plugins/SpecialTextPlugin';
import SpeechToTextPlugin from './plugins/SpeechToTextPlugin';
import TabFocusPlugin from './plugins/TabFocusPlugin';
import TableCellActionMenuPlugin from './plugins/TableActionMenuPlugin';
import TableHoverActionsV2Plugin from './plugins/TableHoverActionsV2Plugin';
import TableOfContentsPlugin from './plugins/TableOfContentsPlugin';
import ToolbarPlugin from './plugins/ToolbarPlugin';
import TreeViewPlugin from './plugins/TreeViewPlugin';
import TwitterPlugin from './plugins/TwitterPlugin';
import { VersionsPlugin } from './plugins/VersionsPlugin';
import YouTubePlugin from './plugins/YouTubePlugin';
import ContentEditable from './ui/ContentEditable';
import { UploadS3 } from './App';

import { usePageSize } from './context/PageSizeContext';
import TableResizeOnPageChangePlugin from './plugins/TableResizeOnPageChangePlugin';

const COLLAB_DOC_ID = 'main';

const skipCollaborationInit =
  // @ts-expect-error
  window.parent != null && window.parent.frames.right === window;

interface EditorProps {
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
  uploadS3?: UploadS3;
}

export default function Editor({
  editorContainerRef,
  uploadS3,
}: EditorProps): JSX.Element {
  const {
    pageDimensions,
    widthAfterMargin,
    margins,
    effectiveScale,
    isFitMode,
    wrapperWidth,
    canvasHeight,
    setFitScale,
    setWrapperWidth,
    setCanvasHeight,
    handleZoomSet,
  } = usePageSize();

  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const pageCanvasRef = useRef<HTMLDivElement>(null);

  // Compute fit scale from wrapper width
  useEffect(() => {
    const wrapper = pageWrapperRef.current;
    if (!wrapper) return;

    const compute = () => {
      const WRAPPER_H_PADDING = 64;
      const innerWidth = wrapper.clientWidth - WRAPPER_H_PADDING;
      setWrapperWidth(innerWidth);
      const ratio = innerWidth / pageDimensions.w;
      setFitScale(ratio < 1 ? ratio : 1);
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [pageDimensions.w, setFitScale, setWrapperWidth]);

  // Debounced canvas height observer
  useEffect(() => {
    const canvas = pageCanvasRef.current;
    if (!canvas) return;

    let raf: number;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCanvasHeight(canvas.offsetHeight));
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [setCanvasHeight]);

  const maxImageWidth = widthAfterMargin;

  const { historyState } = useSharedHistoryContext();
  const {
    settings: {
      isCodeHighlighted,
      isCodeShiki,
      isCollab,
      useCollabV2,
      isAutocomplete,
      isMaxLength,
      isCharLimit,
      hasLinkAttributes,
      hasNestedTables,
      hasFitNestedTables,
      isCharLimitUtf8,
      isRichText,
      showTreeView,
      showTableOfContents,
      shouldUseLexicalContextMenu,
      shouldPreserveNewLinesInMarkdown,
      tableCellMerge,
      tableCellBackgroundColor,
      tableHorizontalScroll,
      shouldAllowHighlightingWithBrackets,
      selectionAlwaysOnDisplay,
      listStrictIndent,
      shouldDisableFocusOnClickChecklist,
    },
  } = useSettings();

  const isEditable = useLexicalEditable();
  const placeholder = isCollab
    ? 'Enter some collaborative rich text...'
    : isRichText
      ? 'Create your pdf here'
      : 'Enter some plain text...';

  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);
  const [isSmallWidthViewport, setIsSmallWidthViewport] =
    useState<boolean>(false);
  const [editor] = useLexicalComposerContext();
  const [activeEditor, setActiveEditor] = useState(editor);
  const [isLinkEditMode, setIsLinkEditMode] = useState<boolean>(false);

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  useEffect(() => {
    const updateViewPortWidth = () => {
      const isNextSmallWidthViewport =
        CAN_USE_DOM && window.matchMedia('(max-width: 1025px)').matches;
      if (isNextSmallWidthViewport !== isSmallWidthViewport) {
        setIsSmallWidthViewport(isNextSmallWidthViewport);
      }
    };
    updateViewPortWidth();
    window.addEventListener('resize', updateViewPortWidth);
    return () => window.removeEventListener('resize', updateViewPortWidth);
  }, [isSmallWidthViewport]);

  return (
    <>
      {isRichText && (
        <ToolbarPlugin
          editor={editor}
          activeEditor={activeEditor}
          setActiveEditor={setActiveEditor}
          setIsLinkEditMode={setIsLinkEditMode}
          uploadS3={uploadS3}
          effectiveScale={effectiveScale}
          isFitMode={isFitMode}
          onZoomSet={handleZoomSet}
        />
      )}
      {isRichText && (
        <ShortcutsPlugin
          editor={activeEditor}
          setIsLinkEditMode={setIsLinkEditMode}
        />
      )}
      <div className="page-canvas-wrapper" ref={pageWrapperRef}>
        <div
          ref={pageCanvasRef}
          className="page-canvas"
          style={
            {
              width: pageDimensions.w,
              minHeight: pageDimensions.h,
              transform: `scale(${effectiveScale})`,
              transformOrigin: 'top left',
              marginLeft: `${Math.max(32, (wrapperWidth - pageDimensions.w * effectiveScale) / 2)}px`,
              marginRight: `${Math.max(32, (wrapperWidth - pageDimensions.w * effectiveScale) / 2)}px`,
              marginBottom: `${canvasHeight * effectiveScale - canvasHeight}px`,
              transition:
                'width 300ms ease, min-height 300ms ease, transform 300ms ease, margin-bottom 300ms ease, margin-left 300ms ease',
              padding: `${margins?.top}px ${margins?.right}px ${margins?.bottom}px ${margins?.left}px`,
              '--page-margin-left': `${margins?.left ?? 0}px`,
              '--page-margin-right': `${margins?.right ?? 0}px`,
              '--page-margin-top': `${margins?.top ?? 0}px`, // add this
              '--page-margin-bottom': `${margins?.bottom ?? 0}px`, // add this
            } as React.CSSProperties
          }
        >
          <div
            ref={editorContainerRef}
            className={`editor-container ${showTreeView ? 'tree-view' : ''} ${
              !isRichText ? 'plain-text' : ''
            }`}
          >
            {isMaxLength && <MaxLengthPlugin maxLength={30} />}
            <DragDropPaste />
            <AutoFocusPlugin />
            {selectionAlwaysOnDisplay && <SelectionAlwaysOnDisplay />}
            <ClearEditorPlugin />
            <ComponentPickerPlugin />
            <EmojiPickerPlugin />
            <AutoEmbedPlugin />
            <MentionsPlugin />
            <EmojisPlugin />
            <KeywordsPlugin />
            <SpeechToTextPlugin />
            <AutoLinkPlugin />
            <DateTimePlugin />
            {isRichText ? (
              <>
                {isCollab ? (
                  useCollabV2 ? (
                    <>
                      <CollabV2
                        id={COLLAB_DOC_ID}
                        shouldBootstrap={!skipCollaborationInit}
                      />
                      <VersionsPlugin id={COLLAB_DOC_ID} />
                    </>
                  ) : (
                    <CollaborationPlugin
                      id={COLLAB_DOC_ID}
                      providerFactory={createWebsocketProvider}
                      shouldBootstrap={!skipCollaborationInit}
                    />
                  )
                ) : (
                  <HistoryPlugin externalHistoryState={historyState} />
                )}
                <RichTextPlugin
                  contentEditable={
                    <div className="editor-scroller">
                      <div className="editor" ref={onRef}>
                        <ContentEditable placeholder={placeholder} />
                      </div>
                    </div>
                  }
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <MarkdownShortcutPlugin />
                {isCodeHighlighted &&
                  (isCodeShiki ? (
                    <CodeHighlightShikiPlugin />
                  ) : (
                    <CodeHighlightPrismPlugin />
                  ))}
                <ListPlugin
                  hasStrictIndent={listStrictIndent}
                  shouldPreserveNumbering={false}
                />
                <CheckListPlugin
                  disableTakeFocusOnClick={shouldDisableFocusOnClickChecklist}
                />
                <TablePlugin
                  hasCellMerge={tableCellMerge}
                  hasCellBackgroundColor={tableCellBackgroundColor}
                  hasHorizontalScroll={false}
                  hasFitNestedTables={false}
                  hasNestedTables={false}
                />
                <TableResizeOnPageChangePlugin />
                <ImagesPlugin maxImageWidth={maxImageWidth} />
                <LinkPlugin hasLinkAttributes={hasLinkAttributes} />
                <PollPlugin />
                <TwitterPlugin />
                <YouTubePlugin />
                <FigmaPlugin />
                <ClickableLinkPlugin disabled={isEditable} />
                <HorizontalRulePlugin />
                <EquationsPlugin />
                <ExcalidrawPlugin />
                <TabFocusPlugin />
                <TabIndentationPlugin maxIndent={7} />
                <CollapsiblePlugin />
                <PageBreakPlugin />
                <LayoutPlugin />
                {floatingAnchorElem && (
                  <>
                    <FloatingLinkEditorPlugin
                      anchorElem={floatingAnchorElem}
                      isLinkEditMode={isLinkEditMode}
                      setIsLinkEditMode={setIsLinkEditMode}
                    />
                    <TableCellActionMenuPlugin
                      anchorElem={floatingAnchorElem}
                      cellMerge={true}
                      scale={effectiveScale}
                    />
                  </>
                )}
                {floatingAnchorElem && !isSmallWidthViewport && (
                  <>
                    <DraggableBlockPlugin
                      anchorElem={floatingAnchorElem}
                      scale={effectiveScale}
                    />
                    <CodeActionMenuPlugin anchorElem={floatingAnchorElem} />
                    <TableHoverActionsV2Plugin
                      anchorElem={floatingAnchorElem}
                    />
                    <FloatingTextFormatToolbarPlugin
                      anchorElem={floatingAnchorElem}
                      setIsLinkEditMode={setIsLinkEditMode}
                      scale={effectiveScale}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <PlainTextPlugin
                  contentEditable={
                    <ContentEditable placeholder={placeholder} />
                  }
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin externalHistoryState={historyState} />
              </>
            )}
            {(isCharLimit || isCharLimitUtf8) && (
              <CharacterLimitPlugin
                charset={isCharLimit ? 'UTF-16' : 'UTF-8'}
                maxLength={5}
              />
            )}
            {isAutocomplete && <AutocompletePlugin />}
            <div>{showTableOfContents && <TableOfContentsPlugin />}</div>
            {shouldUseLexicalContextMenu && <ContextMenuPlugin />}
            {shouldAllowHighlightingWithBrackets && <SpecialTextPlugin />}
          </div>
        </div>
      </div>
      {showTreeView && <TreeViewPlugin />}
    </>
  );
}

function CollabV2({
  id,
  shouldBootstrap,
}: {
  id: string;
  shouldBootstrap: boolean;
}) {
  const doc = useMemo(() => new Doc({ gc: false }), []);

  const provider = useMemo(() => {
    return createWebsocketProviderWithDoc('main', doc);
  }, [doc]);

  return (
    <CollaborationPluginV2__EXPERIMENTAL
      id={id}
      doc={doc}
      provider={provider}
      __shouldBootstrapUnsafe={shouldBootstrap}
    />
  );
}
