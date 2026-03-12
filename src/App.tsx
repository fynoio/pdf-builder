/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { DecoratorTextExtension } from '@lexical/extension';
import { $createLinkNode } from '@lexical/link';
import { $createListItemNode, $createListNode } from '@lexical/list';
import { LexicalCollaboration } from '@lexical/react/LexicalCollaborationContext';
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  defineExtension,
  LexicalEditor,
} from 'lexical';
import {
  forwardRef,
  type JSX,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { buildHTMLConfig } from './buildHTMLConfig';
import { FlashMessageContext } from './context/FlashMessageContext';
import { SettingsContext, useSettings } from './context/SettingsContext';
import { SharedHistoryContext } from './context/SharedHistoryContext';
import { ToolbarContext } from './context/ToolbarContext';
import Editor from './Editor';
import PlaygroundNodes from './nodes/PlaygroundNodes';
import { TableContext } from './plugins/TablePlugin';
import TypingPerfPlugin from './plugins/TypingPerfPlugin';
import PlaygroundEditorTheme from './themes/PlaygroundEditorTheme';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';

import './index.css';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';

/**
 * Interface for the exported Ref handle.
 * Export this so it can be used in the host application for Type Safety.
 */
export interface PlaygroundRef {
  getHtml: () => string;
  getJson: () => string;
  getEditor: () => LexicalEditor;
}

/**
 * NEW: Interface for the Component Props.
 * This tells TypeScript exactly what the Next.js app is allowed to pass in.
 */
export interface PlaygroundProps {
  initialHtml?: string;
  handleChange?: () => void;
}

interface AppProps extends PlaygroundProps {
  imperativeRef: React.Ref<PlaygroundRef>;
}

/**
 * Internal Plugin to bridge the Lexical Context to the Forwarded Ref
 */
const ImperativeHandlePlugin = forwardRef<PlaygroundRef>((_, ref) => {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(ref, () => ({
    getHtml: () => {
      let html = '';
      editor.getEditorState().read(() => {
        html = $generateHtmlFromNodes(editor, null);
      });
      return html;
    },
    getJson: () => {
      return JSON.stringify(editor.getEditorState().toJSON());
    },
    getEditor: () => editor,
  }));

  return null;
});

function $prepopulatedRichText() {
  const root = $getRoot();
  if (root.getFirstChild() === null) {
    const heading = $createHeadingNode('h1');
    heading.append($createTextNode('Welcome to the playground'));
    root.append(heading);
    const quote = $createQuoteNode();
    quote.append(
      $createTextNode(
        `In case you were wondering what the black box at the bottom is – it's the debug view, showing the current state of the editor. ` +
          `You can disable it by pressing on the settings control in the bottom-left of your screen and toggling the debug view setting.`,
      ),
    );
    root.append(quote);
    const paragraph = $createParagraphNode();
    paragraph.append(
      $createTextNode('The playground is a demo environment built with '),
      $createTextNode('@lexical/react').toggleFormat('code'),
      $createTextNode('.'),
      $createTextNode(' Try typing in '),
      $createTextNode('some text').toggleFormat('bold'),
      $createTextNode(' with '),
      $createTextNode('different').toggleFormat('italic'),
      $createTextNode(' formats.'),
    );
    root.append(paragraph);
    const paragraph2 = $createParagraphNode();
    paragraph2.append(
      $createTextNode(
        'Make sure to check out the various plugins in the toolbar. You can also use #hashtags or @-mentions too!',
      ),
    );
    root.append(paragraph2);
    const paragraph3 = $createParagraphNode();
    paragraph3.append(
      $createTextNode(`If you'd like to find out more about Lexical, you can:`),
    );
    root.append(paragraph3);
    const list = $createListNode('bullet');
    list.append(
      $createListItemNode().append(
        $createTextNode(`Visit the `),
        $createLinkNode('https://lexical.dev/').append(
          $createTextNode('Lexical website'),
        ),
        $createTextNode(` for documentation and more information.`),
      ),
      $createListItemNode().append(
        $createTextNode(`Check out the code on our `),
        $createLinkNode('https://github.com/facebook/lexical').append(
          $createTextNode('GitHub repository'),
        ),
        $createTextNode(`.`),
      ),
      $createListItemNode().append(
        $createTextNode(`Playground code can be found `),
        $createLinkNode(
          'https://github.com/facebook/lexical/tree/main/packages/lexical-playground',
        ).append($createTextNode('here')),
        $createTextNode(`.`),
      ),
      $createListItemNode().append(
        $createTextNode(`Join our `),
        $createLinkNode('https://discord.com/invite/KmG4wQnnD9').append(
          $createTextNode('Discord Server'),
        ),
        $createTextNode(` and chat with the team.`),
      ),
    );
    root.append(list);
    const paragraph4 = $createParagraphNode();
    paragraph4.append(
      $createTextNode(
        `Lastly, we're constantly adding cool new features to this playground. So make sure you check back here when you next get a chance :).`,
      ),
    );
    root.append(paragraph4);
  }
}

// Inside your component or as a helper
function $importHTML(editor: LexicalEditor, htmlString: string) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(htmlString, 'text/html');
  const nodes = $generateNodesFromDOM(editor, dom);

  const root = $getRoot();
  root.clear(); // Remove default paragraph if any
  root.append(...nodes);
}

function App({
  imperativeRef,
  initialHtml,
  handleChange,
}: AppProps): JSX.Element {
  const {
    settings: { isCollab, emptyEditor, measureTypingPerf },
  } = useSettings();

  const lastContentRef = useRef<string>('');

  const app = useMemo(
    () =>
      defineExtension({
        $initialEditorState: (editor) => {
          if (isCollab) return;

          if (initialHtml) {
            $importHTML(editor, initialHtml);
            lastContentRef.current = initialHtml;
          } else if (!emptyEditor) {
            $prepopulatedRichText();
          }
        },
        dependencies: [DecoratorTextExtension],
        html: buildHTMLConfig(),
        name: '@fyno/pdf-builder',
        namespace: 'PDF Builder',
        nodes: PlaygroundNodes,
        theme: PlaygroundEditorTheme,
      }),
    [emptyEditor, isCollab],
  );

  return (
    <LexicalCollaboration>
      <LexicalExtensionComposer extension={app} contentEditable={null}>
        <OnChangePlugin
          onChange={(editorState, editor) => {
            editorState.read(() => {
              const currentHtml = $generateHtmlFromNodes(editor, null);

              if (currentHtml !== lastContentRef.current) {
                lastContentRef.current = currentHtml;

                if (handleChange) {
                  handleChange();
                }
              }
            });
          }}
        />

        {/* Mount the Ref bridge inside the Composer to access the editor context */}
        <ImperativeHandlePlugin ref={imperativeRef} />

        <SharedHistoryContext>
          <TableContext>
            <ToolbarContext>
              <div className="editor-shell">
                <Editor />
              </div>
              {measureTypingPerf ? <TypingPerfPlugin /> : null}
            </ToolbarContext>
          </TableContext>
        </SharedHistoryContext>
      </LexicalExtensionComposer>
    </LexicalCollaboration>
  );
}

const PlaygroundApp = forwardRef<PlaygroundRef, PlaygroundProps>(
  (props, ref) => {
    return (
      <SettingsContext>
        <FlashMessageContext>
          <App {...props} imperativeRef={ref} />
        </FlashMessageContext>
      </SettingsContext>
    );
  },
);

export default PlaygroundApp;
