import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef } from 'react';
import { usePageSize } from '../../context/PageSizeContext';

export default function PageRulerPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const { pageDimensions } = usePageSize();
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const canvasEl = rootElement.closest('.page-canvas') as HTMLElement;
    if (!canvasEl) return;

    canvasEl.style.position = 'relative';

    const paginate = () => {
      const pageH = pageDimensions.h;
      const rootOffsetTop = rootElement.offsetTop;

      const blocks = Array.from(
        rootElement.querySelectorAll<HTMLElement>(':scope > *'),
      );

      // --- Step 1: compute new margins without touching DOM yet ---
      const newMargins = new Map<HTMLElement, number>();
      let pageTop = 0;

      for (const block of blocks) {
        // Read current margin we previously set (if any) so offsetTop is clean
        const existingMargin = parseFloat(block.style.marginTop) || 0;
        const blockTop = rootOffsetTop + block.offsetTop - existingMargin;
        const blockHeight = block.offsetHeight;
        const blockBottom = blockTop + blockHeight;
        const currentPageBottom = pageTop + pageH;

        if (blockTop < currentPageBottom && blockBottom > currentPageBottom) {
          const gap = currentPageBottom - blockTop;
          newMargins.set(block, gap);
          pageTop = currentPageBottom;
        } else {
          newMargins.set(block, 0);
          while (pageTop + pageH < blockTop) {
            pageTop += pageH;
          }
        }
      }

      // --- Step 2: apply margins only if changed ---
      let marginsChanged = false;
      for (const [block, margin] of newMargins) {
        const current = parseFloat(block.style.marginTop) || 0;
        if (Math.abs(current - margin) > 0.5) {
          block.style.marginTop = margin > 0 ? `${margin}px` : '';
          marginsChanged = true;
        }
      }

      // --- Step 3: redraw rulers only if margins changed or first run ---
      const existingRulers = canvasEl.querySelectorAll('.page-break-ruler');

      // Compute where rulers should be after margin changes
      const rulerPositions: number[] = [];
      let rulerPageTop = 0;
      const updatedBlocks = Array.from(
        rootElement.querySelectorAll<HTMLElement>(':scope > *'),
      );

      for (const block of updatedBlocks) {
        const blockBottom =
          rootOffsetTop + block.offsetTop + block.offsetHeight;
        while (blockBottom > rulerPageTop + pageH) {
          rulerPageTop += pageH;
          rulerPositions.push(rulerPageTop);
        }
      }

      // Check if rulers need updating
      const existingPositions = Array.from(existingRulers).map((el) =>
        parseFloat((el as HTMLElement).style.top),
      );
      const rulersMatch =
        existingPositions.length === rulerPositions.length &&
        rulerPositions.every((p, i) => Math.abs(p - existingPositions[i]) < 1);

      if (!rulersMatch) {
        existingRulers.forEach((el) => el.remove());
        for (const y of rulerPositions) {
          const ruler = document.createElement('div');
          ruler.className = 'page-break-ruler';
          ruler.style.cssText = `
            position: absolute;
            top: ${y}px;
            left: -40px;
            right: -40px;
            height: 24px;
            background: #d0d0d0;
            pointer-events: none;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
          `;
          ruler.innerHTML = `<span style="
            font-size: 10px;
            color: #999;
            user-select: none;
            letter-spacing: 1px;
          ">— PAGE BREAK —</span>`;
          canvasEl.appendChild(ruler);
        }
      }
    };

    // Debounced runner — waits 80ms after last keystroke before running
    const run = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      timerRef.current = setTimeout(() => {
        rafRef.current = requestAnimationFrame(paginate);
      }, 80);
    };

    // Immediate runner for initial load and page size changes
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
        block.style.marginTop = '';
      });
    };
  }, [editor, pageDimensions.h]);

  return null;
}
