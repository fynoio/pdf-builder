import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePageSize } from '../context/PageSizeContext';

const PAGE_GAP = 20;

interface PaginationPluginProps {
  pageGap?: number;
  onHeightChange?: (height: number) => void;
}

interface PageInfo {
  topOffset: number;
  height: number;
}

export function PaginationPlugin({
  pageGap = PAGE_GAP,
  onHeightChange,
}: PaginationPluginProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const { pageDimensions, margins } = usePageSize();
  const containerRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<PageInfo[]>([]);
  const [totalHeight, setTotalHeight] = useState<number>(0);

  // Tracks margins we've applied so we can restore them on recalculation
  const appliedMarginsRef = useRef<Map<HTMLElement, string>>(new Map());
  const isCalculatingRef = useRef(false);
  const lastCalcRef = useRef(0);

  const pageHeight = pageDimensions.h;
  const verticalMargins = (margins?.top ?? 0) + (margins?.bottom ?? 0);
  const availableContentHeight = pageHeight - verticalMargins;

  function calculatePages() {
    const now = Date.now();
    if (isCalculatingRef.current || now - lastCalcRef.current < 50) return;

    isCalculatingRef.current = true;
    lastCalcRef.current = now;

    try {
      const root = editor.getRootElement();
      if (!root) return;

      const childNodes = Array.from(root.childNodes) as HTMLElement[];
      if (childNodes.length === 0) return;

      // --- Pass 1: restore all previously applied margins so measurements are clean ---
      appliedMarginsRef.current.forEach((original, el) => {
        if (el.parentNode) el.style.marginTop = original;
      });
      appliedMarginsRef.current.clear();

      // --- Pass 2: measure and decide page breaks ---
      const newPages: PageInfo[] = [{ topOffset: 0, height: 0 }];
      const marginsToApply = new Map<HTMLElement, string>();

      let currentPageIndex = 0;
      let currentPageUsed = 0; // px used on the current page so far

      childNodes.forEach((node, index) => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();

        // getBoundingClientRect already reflects the CSS scale transform on
        // .page-canvas, so we need to undo it to get logical (CSS-px) sizes.
        // We derive the scale from the canvas element itself.
        const canvas = root.closest('.page-canvas') as HTMLElement | null;
        const scaleStr = canvas?.style.transform ?? '';
        const scaleMatch = scaleStr.match(/scale\(([^)]+)\)/);
        const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

        const elHeight = rect.height / scale;
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        const totalElHeight = elHeight + marginTop + marginBottom;

        const isExplicitPageBreak = node.getAttribute('type') === 'page-break';

        const wouldOverflow =
          currentPageUsed + totalElHeight > availableContentHeight &&
          currentPageUsed > 0;

        if (isExplicitPageBreak || wouldOverflow) {
          // Close out the current page
          newPages[currentPageIndex].height = currentPageUsed;

          // How far to push the *next* element so it lands on the next page
          const pushDown =
            availableContentHeight -
            currentPageUsed +
            pageGap +
            verticalMargins;

          if (isExplicitPageBreak) {
            // The element *after* the page-break node gets pushed
            const nextEl = childNodes[index + 1] as HTMLElement | undefined;
            if (nextEl) {
              const original = nextEl.style.marginTop ?? '';
              appliedMarginsRef.current.set(nextEl, original);
              marginsToApply.set(nextEl, `${pushDown}px`);
            }
          } else {
            // The overflowing element itself gets pushed
            const original = node.style.marginTop ?? '';
            appliedMarginsRef.current.set(node, original);
            marginsToApply.set(node, `${pushDown}px`);
          }

          // Open a new page
          const prevTop = newPages[currentPageIndex].topOffset;
          currentPageIndex++;
          newPages.push({
            topOffset: prevTop + pageHeight + pageGap,
            height: 0,
          });

          // The element that caused the break still lives on the new page
          if (isExplicitPageBreak) {
            currentPageUsed = totalElHeight; // page-break node height on new page
          } else {
            currentPageUsed = totalElHeight; // overflowing element starts the new page
          }
        } else {
          currentPageUsed += totalElHeight;
        }
      });

      // Close the last page
      newPages[currentPageIndex].height = currentPageUsed;

      // --- Pass 3: apply computed margins ---
      marginsToApply.forEach((marginValue, el) => {
        el.style.marginTop = marginValue;
      });

      // --- Update state ---
      const lastPage = newPages[newPages.length - 1];
      const totalContentHeight = lastPage.topOffset + lastPage.height;

      const totalPages = newPages.length;
      const shapeHeight =
        totalPages === 1
          ? Math.max(pageHeight, totalContentHeight)
          : pageHeight * totalPages + pageGap * (totalPages - 1);

      setPages(newPages);
      setTotalHeight(shapeHeight);
      onHeightChange?.(shapeHeight);
    } catch (err) {
      console.error('[PaginationPlugin] calculatePages error:', err);
    } finally {
      isCalculatingRef.current = false;
    }
  }

  // Re-run whenever the editor content changes
  useEffect(() => {
    const initialTimer = setTimeout(calculatePages, 200);

    const unregister = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => setTimeout(calculatePages, 100));
    });

    return () => {
      clearTimeout(initialTimer);
      unregister();
    };
  }, [editor, pageHeight, pageGap, availableContentHeight]);

  // Re-run when page size / margins / gap props change
  useEffect(() => {
    calculatePages();
  }, [pageHeight, pageGap, availableContentHeight]);

  return (
    <div
      ref={containerRef}
      className="pagination-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        minHeight: pageHeight,
        height: totalHeight || 'auto',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {pages.map((page, i) => (
        <div
          key={`page-${i}`}
          style={{
            position: 'absolute',
            top: page.topOffset,
            left: 0,
            right: 0,
            height: pageHeight,
            backgroundColor: '#fff',
            borderTop: i > 0 ? '1px solid #ddd' : 'none',
            borderBottom: '1px solid #ddd',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            zIndex: -1,
          }}
        />
      ))}
    </div>
  );
}
