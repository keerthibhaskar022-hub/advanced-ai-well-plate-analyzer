import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Point, GridConfig } from '../types';
import { RotateRightIcon } from './icons';

type Step = 
  | 'cropping'
  | 'selectTopLeft' 
  | 'selectTopRight'
  | 'selectBottomLeft'
  | 'confirmGrid'
  | 'controlPositive' 
  | 'controlNegative' 
  | 'concentrations' 
  | 'done';

interface PlateAnalyzerProps {
  imageFile: File;
  onAnalysisComplete: (
    gridConfig: GridConfig,
    rowCount: number,
    colCount: number,
    controlNegative: Point, 
    controlPositive: Point,
    rowConcentrations: number[],
    concentrationUnits: string,
    imageDataUrl?: string
  ) => void;
  onCancel: () => void;
}

interface CropRect { x: number; y: number; width: number; height: number; }
type CropInteraction = 
  | { type: 'move'; startX: number; startY: number; } 
  | { type: 'resize'; handle: string; startX: number; startY: number; }
  | { type: 'draw'; startX: number; startY: number; };

/**
 * Extracts relative coordinates from a mouse or touch event.
 * @param e The native MouseEvent or TouchEvent.
 * @param target The element relative to which coordinates should be calculated.
 * @returns A Point object with x and y coordinates.
 */
function getRelativeCoords(e: MouseEvent | TouchEvent, target: HTMLElement): Point {
  const rect = target.getBoundingClientRect();
  const touch = e instanceof TouchEvent ? (e.touches[0] || e.changedTouches[0]) : undefined;
  const clientX = touch ? touch.clientX : (e as MouseEvent).clientX;
  const clientY = touch ? touch.clientY : (e as MouseEvent).clientY;
  
  return { x: clientX - rect.left, y: clientY - rect.top };
}


export const PlateAnalyzer: React.FC<PlateAnalyzerProps> = ({ imageFile, onAnalysisComplete, onCancel }) => {
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('');
  const [rotatedImageUrl, setRotatedImageUrl] = useState<string | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);

  const [step, setStep] = useState<Step>('selectTopLeft');
  const [isLoading, setIsLoading] = useState(false);
  
  const [topLeftPoint, setTopLeftPoint] = useState<Point | null>(null);
  const [topRightPoint, setTopRightPoint] = useState<Point | null>(null);
  const [bottomLeftPoint, setBottomLeftPoint] = useState<Point | null>(null);

  const [rowCount, setRowCount] = useState(8);
  const [colCount, setColCount] = useState(12);

  const [controlNegative, setControlNegative] = useState<Point | null>(null);
  const [controlPositive, setControlPositive] = useState<Point | null>(null);
  
  const [rowConcentrations, setRowConcentrations] = useState<string[]>([]);
  const [concentrationUnits, setConcentrationUnits] = useState('nM');

  const [crosshair, setCrosshair] = useState<Point | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});

  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const cropRectRef = useRef<CropRect | null>(null);
  cropRectRef.current = cropRect; // Keep ref in sync with state for use in callbacks
  
  const displayImageUrl = useMemo(() => croppedImageUrl || rotatedImageUrl || originalImageUrl, [croppedImageUrl, rotatedImageUrl, originalImageUrl]);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  useEffect(() => {
    const updateOverlayStyle = () => {
      if (imageRef.current && containerRef.current) {
        const img = imageRef.current;
        setOverlayStyle({
          position: 'absolute',
          top: img.offsetTop,
          left: img.offsetLeft,
          width: img.offsetWidth,
          height: img.offsetHeight,
        });
      }
    };
    
    const img = imageRef.current;
    if (img) {
      img.addEventListener('load', updateOverlayStyle);
      if (img.complete) {
        updateOverlayStyle();
      }
      
      const resizeObserver = new ResizeObserver(updateOverlayStyle);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
      
      return () => {
        if (img) {
          img.removeEventListener('load', updateOverlayStyle);
        }
        resizeObserver.disconnect();
      };
    }
  }, [displayImageUrl]);

  useEffect(() => {
    setRowConcentrations(Array(rowCount).fill(''));
  }, [rowCount]);

  const handleFullReset = () => {
    setTopLeftPoint(null);
    setTopRightPoint(null);
    setBottomLeftPoint(null);
    setControlNegative(null);
    setControlPositive(null);
    setCroppedImageUrl(null);
    setCropRect(null);
    setStep('selectTopLeft');
  };
  
  const handleRotate = async () => {
    if (!originalImageUrl) return;

    setIsLoading(true);
    handleFullReset();
    
    const newAngle = (rotationAngle + 90) % 360;

    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = originalImageUrl;

    image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setIsLoading(false);
            return;
        }

        if (newAngle === 90 || newAngle === 270) {
            canvas.width = image.naturalHeight;
            canvas.height = image.naturalWidth;
        } else {
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(newAngle * Math.PI / 180);
        ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
        
        const dataUrl = canvas.toDataURL(imageFile.type);
        setRotationAngle(newAngle);
        setRotatedImageUrl(dataUrl);
        setIsLoading(false);
    };
    image.onerror = () => {
        setIsLoading(false);
        alert('Failed to load image for rotation.');
    }
  };

  const getAbsoluteCoords = (relativePoint: Point): Point => {
    if (!imageRef.current) return relativePoint;
    const { naturalWidth, offsetWidth, naturalHeight, offsetHeight } = imageRef.current;
    if (offsetWidth === 0 || offsetHeight === 0) return relativePoint;
    const scaleX = naturalWidth / offsetWidth;
    const scaleY = naturalHeight / offsetHeight;
    return {
      x: relativePoint.x * scaleX,
      y: relativePoint.y * scaleY,
    };
  };
  
  const handleTap = useCallback((coords: Point) => {
    setStep(prevStep => {
      switch (prevStep) {
        case 'selectTopLeft':
            setTopLeftPoint(coords);
            return 'selectTopRight';
        case 'selectTopRight':
            setTopRightPoint(coords);
            return 'selectBottomLeft';
        case 'selectBottomLeft':
            setBottomLeftPoint(coords);
            return 'confirmGrid';
        case 'controlPositive':
            setControlPositive(coords);
            return 'controlNegative';
        case 'controlNegative':
            setControlNegative(coords);
            return 'concentrations';
        default:
            return prevStep;
      }
    });
  }, []);

  // Effect to handle all drag interactions (cropping, resizing, moving)
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    let interactionStartRef: { point: Point; time: number } | null = null;
    let cropInteractionRef: CropInteraction | null = null;
    let initialCropRectRef: CropRect | null = null;

    const handleInteractionMove = (e: MouseEvent | TouchEvent) => {
      // Prevent default browser actions like text selection (mouse) or page scrolling (touch).
      // This is crucial for a smooth drag experience on both mobile and desktop.
      e.preventDefault();

      const coords = getRelativeCoords(e, overlay);

      if (interactionStartRef) {
        const { point } = interactionStartRef;
        const dist = Math.hypot(coords.x - point.x, coords.y - point.y);
        if (dist > 10) {
          interactionStartRef = null;
        }
      }

      if (cropInteractionRef && imageRef.current) {
        let newRect: CropRect | null = null;
        const { startX, startY } = cropInteractionRef;
        const initialRect = initialCropRectRef;

        switch (cropInteractionRef.type) {
          case 'draw':
            newRect = {
              x: Math.min(startX, coords.x), y: Math.min(startY, coords.y),
              width: Math.abs(coords.x - startX), height: Math.abs(coords.y - startY),
            };
            break;
          case 'move':
            if (initialRect) {
              const dx = coords.x - startX; const dy = coords.y - startY;
              newRect = { ...initialRect, x: initialRect.x + dx, y: initialRect.y + dy };
            }
            break;
          case 'resize':
            if (initialRect) {
              newRect = { ...initialRect };
              const dx = coords.x - startX; const dy = coords.y - startY;
              const { handle } = cropInteractionRef;
              if (handle.includes('right')) newRect.width += dx;
              if (handle.includes('left')) { newRect.x += dx; newRect.width -= dx; }
              if (handle.includes('bottom')) newRect.height += dy;
              if (handle.includes('top')) { newRect.y += dy; newRect.height -= dy; }
            }
            break;
        }

        if (newRect) {
          if (newRect.width < 0) { newRect.x += newRect.width; newRect.width = Math.abs(newRect.width); }
          if (newRect.height < 0) { newRect.y += newRect.height; newRect.height = Math.abs(newRect.height); }
          const { offsetWidth, offsetHeight } = imageRef.current;
          newRect.x = Math.max(0, Math.min(newRect.x, offsetWidth - newRect.width));
          newRect.y = Math.max(0, Math.min(newRect.y, offsetHeight - newRect.height));
          newRect.width = Math.min(newRect.width, offsetWidth - newRect.x);
          newRect.height = Math.min(newRect.height, offsetHeight - newRect.y);
          setCropRect(newRect);
        }
      }
    };
    
    const handleInteractionEnd = (e: MouseEvent | TouchEvent) => {
      window.removeEventListener('mousemove', handleInteractionMove);
      window.removeEventListener('touchmove', handleInteractionMove);
      window.removeEventListener('mouseup', handleInteractionEnd);
      window.removeEventListener('touchend', handleInteractionEnd);
      window.removeEventListener('touchcancel', handleInteractionEnd);

      if (interactionStartRef) {
        const { point, time } = interactionStartRef;
        const duration = Date.now() - time;
        const endCoords = getRelativeCoords(e, overlay);
        const dist = Math.hypot(endCoords.x - point.x, endCoords.y - point.y);
        if (duration < 500 && dist < 10 && step !== 'cropping') {
          handleTap(point);
        }
      }

      if (cropInteractionRef?.type === 'draw' && cropRectRef.current) {
        initialCropRectRef = cropRectRef.current;
      }
      cropInteractionRef = null;
      interactionStartRef = null;
    };

    const handleInteractionStart = (e: MouseEvent | TouchEvent) => {
      // For touch events, prevent the default action (like firing compatibility mouse events).
      // This is crucial to stop a single tap on mobile from registering twice.
      if (e.type === 'touchstart') {
          e.preventDefault();
      }

      const coords = getRelativeCoords(e, overlay);
      interactionStartRef = { point: coords, time: Date.now() };

      const target = e.target as HTMLElement;
      const isResizeHandle = target.closest('.crop-resize-handle');
      const isMoveHandle = target.closest('.crop-move-handle');
      
      if (isResizeHandle || isMoveHandle) {
        e.stopPropagation();
      }
      
      const currentCropRect = cropRectRef.current;
      if (isResizeHandle && currentCropRect) {
        initialCropRectRef = { ...currentCropRect };
        cropInteractionRef = { type: 'resize', handle: (isResizeHandle as HTMLElement).dataset.handle!, startX: coords.x, startY: coords.y };
      } else if (isMoveHandle && currentCropRect) {
        initialCropRectRef = { ...currentCropRect };
        cropInteractionRef = { type: 'move', startX: coords.x, startY: coords.y };
      } else if (step === 'cropping') {
        cropInteractionRef = { type: 'draw', startX: coords.x, startY: coords.y };
        setCropRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
      }

      window.addEventListener('mousemove', handleInteractionMove);
      window.addEventListener('touchmove', handleInteractionMove, { passive: false });
      window.addEventListener('mouseup', handleInteractionEnd);
      window.addEventListener('touchend', handleInteractionEnd);
      window.addEventListener('touchcancel', handleInteractionEnd);
    };

    overlay.addEventListener('mousedown', handleInteractionStart);
    overlay.addEventListener('touchstart', handleInteractionStart, { passive: false });

    return () => {
      overlay.removeEventListener('mousedown', handleInteractionStart);
      overlay.removeEventListener('touchstart', handleInteractionStart);
      // Clean up window listeners if component unmounts mid-drag
      window.removeEventListener('mousemove', handleInteractionMove);
      window.removeEventListener('touchmove', handleInteractionMove);
      window.removeEventListener('mouseup', handleInteractionEnd);
      window.removeEventListener('touchend', handleInteractionEnd);
      window.removeEventListener('touchcancel', handleInteractionEnd);
    };
  }, [step, handleTap]);

  // Handle crosshair display on hover
  const handleHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (['selectTopLeft', 'selectTopRight', 'selectBottomLeft', 'controlPositive', 'controlNegative'].includes(step)) {
      const coords = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      setCrosshair(coords);
    } else {
      setCrosshair(null);
    }
  };
  
  const handleMouseLeave = () => {
    setCrosshair(null);
  };

  const gridConfig = useMemo((): GridConfig | null => {
    if (colCount <= 1 || rowCount <= 1) return null;
    if (!topLeftPoint || !topRightPoint || !bottomLeftPoint) return null;
    const u_vector = { x: (topRightPoint.x - topLeftPoint.x) / (colCount - 1), y: (topRightPoint.y - topLeftPoint.y) / (colCount - 1) };
    const v_vector = { x: (bottomLeftPoint.x - topLeftPoint.x) / (rowCount - 1), y: (bottomLeftPoint.y - topLeftPoint.y) / (rowCount - 1) };
    return { origin: topLeftPoint, u: u_vector, v: v_vector };
  }, [topLeftPoint, topRightPoint, bottomLeftPoint, rowCount, colCount]);

  const handleConfirmCrop = () => {
    const sourceUrl = rotatedImageUrl || originalImageUrl;
    if (!sourceUrl || !cropRect || !imageRef.current) return;
    
    setIsLoading(true);
    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = sourceUrl;
    image.onload = () => {
        const { naturalWidth, offsetWidth, naturalHeight, offsetHeight } = imageRef.current!;
        const scaleX = naturalWidth / offsetWidth;
        const scaleY = naturalHeight / offsetHeight;
        const sx = cropRect.x * scaleX, sy = cropRect.y * scaleY, sWidth = cropRect.width * scaleX, sHeight = cropRect.height * scaleY;
        const canvas = document.createElement('canvas');
        canvas.width = sWidth;
        canvas.height = sHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setIsLoading(false); return; }
        ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        const croppedDataUrl = canvas.toDataURL(imageFile.type);
        setCroppedImageUrl(croppedDataUrl);
        
        // Reset calibration state for the new cropped image, but don't clear the image itself.
        setTopLeftPoint(null);
        setTopRightPoint(null);
        setBottomLeftPoint(null);
        setControlNegative(null);
        setControlPositive(null);
        setCropRect(null);
        setStep('selectTopLeft');
        
        setIsLoading(false);
    };
    image.onerror = () => {
        alert('Failed to load image for cropping.');
        setIsLoading(false);
    };
  };

  const handleCancelCrop = () => {
      setStep('selectTopLeft');
      setCropRect(null);
  };

  const handleAnalyze = () => {
    if (gridConfig && controlNegative && controlPositive) {
      const parsedConcentrations = rowConcentrations.map(c => parseFloat(c)).filter(c => !isNaN(c) && c > 0);
      const numericConcentrations = rowConcentrations.map(c => parseFloat(c) || 0);

      if (parsedConcentrations.length < 2) {
        alert("Please enter at least two valid, positive concentrations to calculate IC50.");
        return;
      }
      
      const absoluteGridConfig: GridConfig = {
          origin: getAbsoluteCoords(gridConfig.origin),
          u: {
              x: getAbsoluteCoords({x: gridConfig.u.x, y: 0}).x - getAbsoluteCoords({x: 0, y: 0}).x,
              y: getAbsoluteCoords({x: 0, y: gridConfig.u.y}).y - getAbsoluteCoords({x: 0, y: 0}).y,
          },
          v: {
              x: getAbsoluteCoords({x: gridConfig.v.x, y: 0}).x - getAbsoluteCoords({x: 0, y: 0}).x,
              y: getAbsoluteCoords({x: 0, y: gridConfig.v.y}).y - getAbsoluteCoords({x: 0, y: 0}).y,
          }
      };
      
      onAnalysisComplete(
        absoluteGridConfig,
        rowCount,
        colCount,
        getAbsoluteCoords(controlNegative),
        getAbsoluteCoords(controlPositive),
        numericConcentrations,
        concentrationUnits,
        displayImageUrl
      );
    }
  };
  
  const getDotStyle = (point: Point | null): React.CSSProperties => {
    if (!point) return { display: 'none' };
    return {
      position: 'absolute', left: `${point.x}px`, top: `${point.y}px`,
      transform: 'translate(-50%, -50%)', pointerEvents: 'none',
    };
  };

  const getCrosshairStyle = (): React.CSSProperties => {
    if (!crosshair) return { display: 'none' };
    return {
      position: 'absolute', left: `${crosshair.x}px`, top: `${crosshair.y}px`,
    };
  };

  const instructions = {
    cropping: "Drag on the image to select the area to crop.",
    selectTopLeft: "Step 1: Click the center of the top-left well (e.g., A1).",
    selectTopRight: "Step 2: Click the center of the top-right well (e.g., A12).",
    selectBottomLeft: "Step 3: Click the center of the bottom-left well (e.g., H1).",
    confirmGrid: "Confirm the number of rows and columns for your selected points.",
    controlPositive: "Click to set the 100% viability reference (e.g., an untreated well).",
    controlNegative: "Click to set the 0% viability reference (e.g., max concentration well).",
    concentrations: "Enter drug concentrations for each row in your selection.",
    done: "Ready to analyze."
  };
  const instruction = isLoading ? 'Processing image...' : instructions[step];
  
  const gridOverlay = useMemo(() => {
    if (!gridConfig) return null;
    const { origin, u, v } = gridConfig;
    const u_mag = Math.hypot(u.x, u.y), v_mag = Math.hypot(v.x, v.y);
    if (u_mag === 0 || v_mag === 0) return null;
    const WELL_RADIUS_FACTOR = 0.30;
    const radius = Math.min(u_mag, v_mag) * WELL_RADIUS_FACTOR;
    if (!isFinite(radius) || radius <= 0) return null;
    const points = [];
    for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
            points.push({ x: origin.x + c * u.x + r * v.x, y: origin.y + c * u.y + r * v.y });
        }
    }
    return points.map((p, i) => (
        <div key={i} className="absolute rounded-full border-2 border-yellow-400 bg-yellow-400/20 box-border pointer-events-none" 
            style={{ left: p.x, top: p.y, width: radius * 2, height: radius * 2, transform: 'translate(-50%, -50%)' }}
        ></div>
    ));
  }, [gridConfig, rowCount, colCount]);

  const resizeHandles = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'];
  const cursorClass = ['selectTopLeft', 'selectTopRight', 'selectBottomLeft', 'controlPositive', 'controlNegative'].includes(step) ? 'cursor-crosshair' 
    : step === 'cropping' ? 'cursor-crosshair' : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-2xl font-bold">Calibrate Plate</h2>
      </div>
      <p className="text-[--color-text-muted] font-semibold h-6">{instruction}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div 
            ref={containerRef}
            className="relative inline-block border rounded-lg overflow-hidden shadow-md col-span-1 md:col-span-2"
        >
          <img
            ref={imageRef}
            src={displayImageUrl}
            alt="Well Plate"
            className="max-w-full max-h-[70vh] block"
          />
          <div 
            ref={overlayRef}
            className={`absolute top-0 left-0 w-full h-full ${cursorClass}`}
            style={{...overlayStyle, touchAction: 'none'}}
            onMouseMove={handleHover}
            onMouseLeave={handleMouseLeave}
          >
            {step === 'cropping' && cropRect && (
                <>
                    <div className="absolute w-full h-full bg-black/50 pointer-events-none" style={{ clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${cropRect.x}px ${cropRect.y}px, ${cropRect.x}px ${cropRect.y + cropRect.height}px, ${cropRect.x + cropRect.width}px ${cropRect.y + cropRect.height}px, ${cropRect.x + cropRect.width}px ${cropRect.y}px, ${cropRect.x}px ${cropRect.y}px)`}}/>
                    <div
                        className="absolute border-2 border-dashed border-white cursor-move crop-move-handle"
                        style={{ left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height }}
                    >
                        {resizeHandles.map(handle => (
                            <div key={handle} 
                                data-handle={handle}
                                className="absolute w-3 h-3 bg-white rounded-full border border-gray-500 crop-resize-handle"
                                style={{
                                    top: handle.includes('top') ? '-6px' : handle.includes('bottom') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                                    left: handle.includes('left') ? '-6px' : handle.includes('right') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                                    cursor: `${handle.includes('top') ? 'n' : ''}${handle.includes('left') ? 'w' : ''}${handle.includes('bottom') ? 's' : ''}${handle.includes('right') ? 'e' : ''}-resize`
                                }}
                            />
                        ))}
                    </div>
                </>
            )}

            {gridOverlay}
            
            {topLeftPoint && <div style={getDotStyle(topLeftPoint)} className="w-3 h-3 bg-green-500 rounded-full border-2 border-[--color-point-border]"></div>}
            {topRightPoint && <div style={getDotStyle(topRightPoint)} className="w-3 h-3 bg-green-500 rounded-full border-2 border-[--color-point-border]"></div>}
            {bottomLeftPoint && <div style={getDotStyle(bottomLeftPoint)} className="w-3 h-3 bg-green-500 rounded-full border-2 border-[--color-point-border]"></div>}

            {controlPositive && <div style={getDotStyle(controlPositive)} className="w-3 h-3 bg-fuchsia-500 rounded-full border-2 border-[--color-point-border]"></div>}
            {controlNegative && <div style={getDotStyle(controlNegative)} className="w-3 h-3 bg-cyan-400 rounded-full border-2 border-[--color-point-border]"></div>}

            {crosshair && (
                <div style={getCrosshairStyle()} className="pointer-events-none absolute inset-0">
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-px bg-[--color-crosshair]" style={{top: `${crosshair.y}px`}}></div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 h-full w-px bg-[--color-crosshair]" style={{left: `${crosshair.x}px`}}></div>
                </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
            <div className="p-4 border rounded-lg border-[--color-border-primary] space-y-4">
                <h3 className="font-semibold text-lg">Plate Setup</h3>
                <div>
                  <p className="text-sm text-[--color-text-muted] mb-2">If your image is tilted or needs cropping, do this first.</p>
                  <div className="flex flex-wrap gap-2">
                       <button onClick={handleRotate} disabled={isLoading || step === 'cropping'} className="flex items-center gap-1 px-3 py-1 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-semibold rounded-lg hover:bg-[--color-button-secondary-hover-bg] disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                          <RotateRightIcon className="w-4 h-4" />
                          Rotate 90°
                      </button>
                      {step !== 'cropping' && (
                        <button onClick={() => { setStep('cropping'); setCropRect(null); }} disabled={isLoading || !!croppedImageUrl} className="px-3 py-1 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-semibold rounded-lg hover:bg-[--color-button-secondary-hover-bg] disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                            Enable Cropping
                        </button>
                      )}
                  </div>
                </div>

                {step === 'cropping' && (
                    <div className="pt-4 border-t border-[--color-border-secondary]">
                      <h4 className="font-semibold mb-2">Cropping</h4>
                      <p className="text-sm text-[--color-text-muted] mb-2">Drag to select an area, then confirm or cancel.</p>
                      <div className="flex flex-wrap gap-2">
                          <button onClick={handleConfirmCrop} disabled={isLoading || !cropRect} className="px-3 py-1 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                              Confirm Crop
                          </button>
                          <button onClick={handleCancelCrop} disabled={isLoading} className="px-3 py-1 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-semibold rounded-lg hover:bg-[--color-button-secondary-hover-bg] disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                              Cancel Crop
                          </button>
                      </div>
                    </div>
                )}
            </div>

          {step === 'confirmGrid' && (
            <div className="p-4 border rounded-lg border-[--color-border-primary]">
                <h3 className="font-semibold text-lg mb-2">Confirm Grid Dimensions</h3>
                <div className="flex flex-col gap-3">
                    <label>Rows: <input type="number" min="2" value={rowCount} onChange={e => setRowCount(parseInt(e.target.value) || 2)} className="w-20 ml-2 px-2 py-1 border rounded bg-[--color-input-background] border-[--color-input-border]" /></label>
                    <label>Cols: <input type="number" min="2" value={colCount} onChange={e => setColCount(parseInt(e.target.value) || 2)} className="w-20 ml-2 px-2 py-1 border rounded bg-[--color-input-background] border-[--color-input-border]" /></label>
                </div>
                <button onClick={() => setStep('controlPositive')} className="mt-4 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Confirm Grid</button>
            </div>
          )}
          {(step === 'concentrations' || step === 'done') && (
              <div className="p-4 border rounded-lg border-[--color-border-primary]">
                <h3 className="text-lg font-semibold mb-2">Drug Concentrations by Row</h3>
                <div className="flex items-center gap-4 mb-4">
                  <label htmlFor="units" className="font-medium">Units:</label>
                  <select id="units" value={concentrationUnits} onChange={(e) => setConcentrationUnits(e.target.value)} className="px-2 py-1 border rounded bg-[--color-input-background] border-[--color-input-border]">
                    <option value="nM">nM</option>
                    <option value="µM">µM</option>
                    <option value="mM">mM</option>
                  </select>
                </div>
                <div className="flex flex-col gap-3 mt-4 max-h-60 overflow-y-auto">
                    {rowConcentrations.map((conc, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <label htmlFor={`row-${index}`} className="text-sm font-medium w-16">Row {String.fromCharCode(65 + index)}</label>
                            <input id={`row-${index}`} type="number" placeholder="e.g., 100" value={conc} onChange={(e) => {
                                const newConcentrations = [...rowConcentrations];
                                newConcentrations[index] = e.target.value;
                                setRowConcentrations(newConcentrations);
                            }} className="w-full px-2 py-1 border rounded bg-[--color-input-background] border-[--color-input-border]" />
                        </div>
                    ))}
                </div>
                {step === 'concentrations' && <button onClick={() => setStep('done')} className="mt-4 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Confirm Concentrations</button>}
              </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 mt-4">
        <button onClick={handleAnalyze} disabled={step !== 'done' || isLoading} className="px-4 py-2 bg-[--color-accent-primary] text-[--color-accent-primary-text] font-semibold rounded-lg shadow-md hover:bg-[--color-accent-primary-hover] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
          Analyze
        </button>
        <button onClick={handleFullReset} disabled={isLoading} className="px-4 py-2 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-semibold rounded-lg hover:bg-[--color-button-secondary-hover-bg] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          Reset
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-semibold rounded-lg hover:bg-[--color-button-secondary-hover-bg] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
};