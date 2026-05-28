import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef } from 'react';
import { usePageSize } from '../../context/PageSizeContext';

export default function PageRulerPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const { pageDimensions, margins } = usePageSize();
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const canvasEl = rootElement.closest('.page-canvas') as HTMLElement;
    if (!canvasEl) return;

    canvasEl.style.position = 'relative';

    const pushedBlocks = new WeakSet<HTMLElement>();

    const paginate = () => {
      canvasEl
        .querySelectorAll('.page-break-ruler')
        .forEach((el) => el.remove());

      const pageH = pageDimensions.h;
      const rootOffsetTop = rootElement.offsetTop;
      const totalHeight = canvasEl.scrollHeight;

      const blocks = Array.from(
        rootElement.querySelectorAll<HTMLElement>(':scope > *'),
      );

      // --- Step 1: reset previously pushed margins ---
      blocks.forEach((block) => {
        if (pushedBlocks.has(block)) {
          block.style.marginTop = '';
          pushedBlocks.delete(block);
        }
      });

      // --- Step 2: push blocks straddling a natural boundary ---
      // Reset pageTop at each PageBreakNode
      let pageTop = -margins?.top;

      for (const block of blocks) {
        if (
          block.tagName === 'FIGURE' &&
          block.getAttribute('type') === 'page-break'
        ) {
          // Reset cycle from the bottom of this forced break
          pageTop = rootOffsetTop + block.offsetTop + block.offsetHeight;
          continue;
        }

        // ✅ Skip tables and text-only paragraphs — don't push them across page boundaries
        const isTable =
          block.tagName === 'TABLE' || block.querySelector('table');
        const isTextOnlyParagraph =
          block.tagName === 'P' &&
          !block.querySelector('[data-lexical-decorator]');

        if (isTable || isTextOnlyParagraph) {
          const blockBottom =
            rootOffsetTop + block.offsetTop + block.offsetHeight;
          while (pageTop + pageH < blockBottom) {
            pageTop += pageH;
          }
          continue;
        }

        const blockTop = rootOffsetTop + block.offsetTop;
        const blockBottom = blockTop + block.offsetHeight;
        const currentPageBottom = pageTop + pageH;

        if (blockTop < currentPageBottom && blockBottom > currentPageBottom) {
          const pushNeeded = currentPageBottom - blockTop;
          const existing = parseFloat(block.style.marginTop) || 0;
          block.style.marginTop = `${existing + pushNeeded}px`;
          pushedBlocks.add(block);
          pageTop = currentPageBottom;
        }

        while (pageTop + pageH < blockBottom) {
          pageTop += pageH;
        }
      }

      // --- Step 3: draw rulers per segment ---
      // A segment is the range between two PageBreakNodes (or doc start/end)
      // For each segment, draw rulers at segmentStart + pageH, + 2*pageH, etc.
      // but ONLY up to the next PageBreakNode's position

      // Build segments: [{start, end}]
      type Segment = { start: number; end: number };
      const segments: Segment[] = [];

      let segStart = 0;

      for (const block of blocks) {
        if (
          block.tagName === 'FIGURE' &&
          block.getAttribute('type') === 'page-break'
        ) {
          const breakTop = rootOffsetTop + block.offsetTop;
          const breakBottom =
            rootOffsetTop + block.offsetTop + block.offsetHeight;

          // Close current segment just before this break
          segments.push({ start: segStart, end: breakTop });

          // Next segment starts after this break
          segStart = breakBottom;
        }
      }

      // Close the final segment
      segments.push({ start: segStart, end: totalHeight });

      // Draw rulers within each segment
      for (const { start, end } of segments) {
        for (let y = start + pageH; y < end; y += pageH) {
          const ruler = document.createElement('div');
          ruler.className = 'page-break-ruler';
          ruler.style.cssText = `
            position: absolute;
            top: ${y}px;
            left: -48px;
            right: -48px;
            height: 0;
            border-top: 2px dashed #bbb;
            pointer-events: none;
            z-index: 10;
          `;
          canvasEl.appendChild(ruler);
        }
      }
    };

    const run = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      timerRef.current = setTimeout(() => {
        rafRef.current = requestAnimationFrame(paginate);
      }, 80);
    };

    const runNow = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(paginate);
    };

    const unregister = editor.registerUpdateListener(run);
    const resizeObserver = new ResizeObserver(runNow);
    resizeObserver.observe(canvasEl);
    runNow();

    return () => {
      unregister();
      resizeObserver.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvasEl
        .querySelectorAll('.page-break-ruler')
        .forEach((el) => el.remove());
      Array.from(
        rootElement.querySelectorAll<HTMLElement>(':scope > *'),
      ).forEach((block) => {
        if (pushedBlocks.has(block)) {
          block.style.marginTop = '';
        }
      });
    };
  }, [editor, pageDimensions.h, margins?.top]);

  return null;
}
