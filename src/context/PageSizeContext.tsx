import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Margins, PageOrientation, PageSize } from '../App';

export const PAGE_DIMENSIONS: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 794, h: 1123 },
  A5: { w: 560, h: 794 },
  A6: { w: 397, h: 560 },
  Letter: { w: 816, h: 1056 },
  Legal: { w: 816, h: 1344 },
};

type PageSizeContextShape = {
  pageSize: PageSize;
  pageOrientation: PageOrientation;
  pageDimensions: { w: number; h: number };
  widthAfterMargin: number;
  heightAfterMargin: number;
  margins: Margins;
  // Scale
  effectiveScale: number;
  isFitMode: boolean;
  wrapperWidth: number;
  canvasHeight: number;
  setFitScale: (scale: number) => void;
  setWrapperWidth: (w: number) => void;
  setCanvasHeight: (h: number) => void;
  handleZoomSet: (value: number | null) => void;
};

const PageSizeContext = createContext<PageSizeContextShape>({
  pageSize: 'A4',
  pageOrientation: 'Portrait',
  pageDimensions: PAGE_DIMENSIONS['A4'],
  widthAfterMargin: PAGE_DIMENSIONS['A4'].w,
  heightAfterMargin: PAGE_DIMENSIONS['A4'].h,
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  effectiveScale: 1,
  isFitMode: true,
  wrapperWidth: 0,
  canvasHeight: 0,
  setFitScale: () => {},
  setWrapperWidth: () => {},
  setCanvasHeight: () => {},
  handleZoomSet: () => {},
});

export function PageSizeProvider({
  pageSize,
  pageOrientation,
  margins,
  children,
}: {
  pageSize: PageSize;
  pageOrientation: PageOrientation;
  margins: Margins;
  children: ReactNode;
}) {
  const pageDimensions = useMemo(() => {
    const { w, h } = PAGE_DIMENSIONS[pageSize];
    return pageOrientation === 'Landscape' ? { w: h, h: w } : { w, h };
  }, [pageSize, pageOrientation]);

  const widthAfterMargin = pageDimensions.w - margins.left - margins.right;
  const heightAfterMargin = pageDimensions.h - margins.top - margins.bottom;

  // Scale state — owned here, updated by Editor via setters
  const [fitScale, setFitScale] = useState(1);
  const [wrapperWidth, setWrapperWidth] = useState(0);
  const [zoomOverride, setZoomOverride] = useState<number | null>(null);
  const [canvasHeight, setCanvasHeight] = useState(0);

  const effectiveScale = zoomOverride ?? fitScale;
  const isFitMode = zoomOverride === null;

  const handleZoomSet = useCallback((value: number | null) => {
    setZoomOverride(value);
  }, []);

  const value = useMemo(
    () => ({
      pageSize,
      pageOrientation,
      pageDimensions,
      widthAfterMargin,
      heightAfterMargin,
      margins,
      effectiveScale,
      isFitMode,
      wrapperWidth,
      canvasHeight,
      setFitScale,
      setWrapperWidth,
      setCanvasHeight,
      handleZoomSet,
    }),
    [
      pageSize,
      pageOrientation,
      pageDimensions,
      widthAfterMargin,
      heightAfterMargin,
      margins,
      effectiveScale,
      isFitMode,
      wrapperWidth,
      canvasHeight,
      handleZoomSet,
    ],
  );

  return (
    <PageSizeContext.Provider value={value}>
      {children}
    </PageSizeContext.Provider>
  );
}

export const usePageSize = () => useContext(PageSizeContext);
