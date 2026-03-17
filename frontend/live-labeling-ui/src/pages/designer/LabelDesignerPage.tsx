// src/pages/designer/LabelDesignerPage.tsx
// Konva-based label designer: Text, Image, Barcode (Code128/Code39/EAN13), QR, DataMatrix
// ZPL generation + print via POST /labeling/print

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Stage, Layer, Text, Image as KonvaImage, Transformer, Rect, Line, Ellipse } from 'react-konva';
import type Konva from 'konva';
import bwipjs from 'bwip-js/browser';
import { nanoid } from 'nanoid';
import axios from 'axios';
import { toast } from 'react-toastify';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Slider from '@mui/material/Slider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListSubheader from '@mui/material/ListSubheader';

import TitleIcon from '@mui/icons-material/Title';
import ImageIcon from '@mui/icons-material/Image';
import QrCodeIcon from '@mui/icons-material/QrCode';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PrintIcon from '@mui/icons-material/Print';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { RootState } from '../../app/store';

// ── Constants ────────────────────────────────────────────────────────────────
const SCALE  = 3.2;   // px per mm on-screen
const DPM    = 11.811; // dots per mm at 300 dpi (used for ZPL output)

const SIZES: Record<string, { w: number; h: number; label: string }> = {
  small:  { w: 105, h: 80,  label: '80 × 105 mm'   },
  large:  { w: 145, h: 105, label: '105 × 145 mm'  },
  custom: { w: 100, h: 70,  label: 'Custom'         },
};

const SNAP_THRESHOLD = 8; // screen px — divided by zoom for stage coords

const BARCODE_TYPES: { value: string; label: string; bcid: string }[] = [
  { value: 'CODE128', label: 'Code 128', bcid: 'code128' },
  { value: 'CODE39',  label: 'Code 39',  bcid: 'code39'  },
  { value: 'EAN13',   label: 'EAN-13',   bcid: 'ean13'   },
];

const SHAPE_COLORS: { value: string; label: string }[] = [
  { value: '#000000',    label: 'Black' },
  { value: '#ffffff',    label: 'White' },
  { value: 'transparent', label: 'Transparent' },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface SavedTemplate {
  id: string;
  name: string;
  description?: string | null;
  size_w_mm: number;
  size_h_mm: number;
  elements_json: string;
  preview_b64?: string | null;
}

type ElementType = 'text' | 'image' | 'barcode' | 'qr' | 'datamatrix' | 'rect' | 'circle';

interface LabelElement {
  id: string;
  type: ElementType;
  x: number;       // mm
  y: number;       // mm
  width: number;   // mm
  height: number;  // mm
  rotation: number;
  // text
  text?: string;
  fontSize?: number;  // pt
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  // image
  src?: string;       // base64 data URL
  // barcode/qr/datamatrix
  barcodeValue?: string;
  barcodeType?: string;   // CODE128 | CODE39 | EAN13
  barcodeHeight?: number; // bwip-js bar height in mm (default 10)
  // rect/circle
  fillColor?: string;     // '#000000' | '#ffffff' | 'transparent'
  strokeColor?: string;   // '#000000' | '#ffffff' | 'transparent'
  strokeWidthMm?: number; // border thickness in mm (default 0.5)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const d   = (mm: number) => Math.round(mm * DPM);
const px  = (mm: number) => mm * SCALE;
const mm  = (p: number)  => p / SCALE;

// bwip-js toSVG uses internal units at 72 dpi × scale; convert to mm with this factor
const BWIP_SCALE = 3;
// 25.4/(72×scale) is the theoretical unit; empirically the rendered height is ~31% larger.
// Calibrated against real printer output: barHeight=10mm → total height ≈16.82mm.
const BWIP_MM_PER_UNIT = (25.4 / (72 * BWIP_SCALE)) * (16.82 / 12.82); // ≈ 0.1543 mm/unit

async function renderBwip(bcid: string, text: string, barHeight = 10): Promise<{ img: HTMLImageElement; heightMm: number; widthMm: number }> {
  // toSVG produces vector output — no pixel resolution limit, sharp at any zoom/DPI
  const svgStr = bwipjs.toSVG({
    bcid,
    text: text || ' ',
    scale: BWIP_SCALE,
    height: barHeight,
    includetext: true,
    textxalign: 'center',
  });

  // bwip-js SVG has only viewBox (no width/height attributes).
  // Parse viewBox to get total height (bars + human-readable text) in SVG units, then convert to mm.
  const vb = svgStr.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const vbW = vb ? parseFloat(vb[1]) : 0;
  const vbH = vb ? parseFloat(vb[2]) : 0;
  const heightMm = vbH * BWIP_MM_PER_UNIT;
  const widthMm  = vbW * BWIP_MM_PER_UNIT;

  // Inject explicit width/height so HTMLImageElement gets natural dimensions
  const sizedSvg = svgStr.replace('<svg ', `<svg width="${widthMm.toFixed(3)}mm" height="${heightMm.toFixed(3)}mm" `);

  return new Promise((resolve, reject) => {
    const blob = new Blob([sizedSvg], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new window.Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve({ img, heightMm, widthMm }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(); };
    img.src = url;
  });
}

async function imageToGRF(src: string, wMM: number, hMM: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const W = d(wMM), H = d(hMM);
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      const bpr = Math.ceil(W / 8);
      let hex = '';
      for (let y = 0; y < H; y++) {
        for (let bx = 0; bx < bpr; bx++) {
          let byte = 0;
          for (let b = 0; b < 8; b++) {
            const x = bx * 8 + b;
            const i = (y * W + x) * 4;
            const g = x < W ? 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] : 255;
            if (g < 128) byte |= 1 << (7 - b);
          }
          hex += byte.toString(16).padStart(2, '0').toUpperCase();
        }
      }
      const total = bpr * H;
      resolve(`^GFA,${total},${total},${bpr},${hex}`);
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

async function buildZPL(elements: LabelElement[], size: { w: number; h: number }): Promise<string> {
  const { w, h } = size;
  let zpl = `^XA\n^PW${d(w)}\n^LL${d(h)}\n\n`;

  for (const el of elements) {
    const X = d(el.x), Y = d(el.y);

    if (el.type === 'text') {
      const fs = Math.round((el.fontSize ?? 12) * DPM / 2.835);
      const fw = Math.round(fs * 0.7);
      zpl += `; Text: "${el.text}"\n^FO${X},${Y}\n`;
      if (el.bold) zpl += `^CF0,${fs},${fw}\n`;
      else         zpl += `^A0N,${fs},${fw}\n`;
      zpl += `^FD${el.text ?? ''}^FS\n\n`;

    } else if (el.type === 'barcode') {
      const H = d(el.height);
      zpl += `; Barcode: ${el.barcodeType} "${el.barcodeValue}"\n^FO${X},${Y}\n`;
      const bw = Math.max(1, Math.round(d(el.width) / ((el.barcodeValue?.length ?? 10) * 11)));
      zpl += `^BY${bw},3,${H}\n^BCN,${H},Y,N,N\n^FD${el.barcodeValue ?? ''}^FS\n\n`;

    } else if (el.type === 'qr') {
      const mag = Math.max(1, Math.min(10, Math.round(d(Math.min(el.width, el.height)) / 22)));
      zpl += `; QR: "${el.barcodeValue}"\n^FO${X},${Y}\n^BQN,2,${mag}\n^FDQA,${el.barcodeValue ?? ''}^FS\n\n`;

    } else if (el.type === 'datamatrix') {
      const s = Math.max(1, Math.min(10, Math.round(d(Math.min(el.width, el.height)) / 22)));
      zpl += `; DataMatrix: "${el.barcodeValue}"\n^FO${X},${Y}\n^BXN,${s},200\n^FD${el.barcodeValue ?? ''}^FS\n\n`;

    } else if (el.type === 'image' && el.src) {
      zpl += `; Image\n^FO${X},${Y}\n`;
      const grf = await imageToGRF(el.src, el.width, el.height);
      if (grf) zpl += `${grf}^FS\n\n`;

    } else if (el.type === 'rect' || el.type === 'circle') {
      const W = d(el.width), H = d(el.height);
      const corner = el.type === 'circle' ? 8 : 0;
      const isFilled = el.fillColor === '#000000';
      const hasBorder = (el.strokeColor ?? '#000000') !== 'transparent';
      const thick = hasBorder ? Math.max(1, d(el.strokeWidthMm ?? 0.5)) : 0;
      const borderColor = el.strokeColor === '#ffffff' ? 'W' : 'B';
      if (isFilled) {
        // filled shape — ^GB with thickness = full width fills solid
        zpl += `; ${el.type} filled\n^FO${X},${Y}\n^GB${W},${H},${W},B,${corner}^FS\n\n`;
        // draw border on top if it's a different visible color
        if (hasBorder && el.strokeColor === '#ffffff') {
          zpl += `^FO${X},${Y}\n^GB${W},${H},${thick},W,${corner}^FS\n\n`;
        }
      } else if (hasBorder) {
        zpl += `; ${el.type} border\n^FO${X},${Y}\n^GB${W},${H},${thick},${borderColor},${corner}^FS\n\n`;
      }
    }
  }

  zpl += '^XZ';
  return zpl;
}

// ── Konva element nodes ───────────────────────────────────────────────────────
interface NodeProps {
  el: LabelElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<LabelElement>) => void;
  canvasW: number; // px — used for drag clamping
  canvasH: number;
}

const TRANSFORMER_PROPS = {
  flipEnabled: false,
  enabledAnchors: ['top-left','top-center','top-right','middle-right','middle-left','bottom-left','bottom-center','bottom-right'] as string[],
};

type KBox = { x: number; y: number; width: number; height: number; rotation: number };
// NOTE: canvas-boundary clamping is intentionally NOT done here.
// boundBoxFunc receives coords in the Transformer's rotated space; clamping those
// values with unrotated canvas dimensions corrupts the transform on rotated elements.
function makeTransformerBoundBox(_cW: number, _cH: number) {
  return (oldBox: KBox, newBox: KBox): KBox => {
    if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox;
    return newBox;
  };
}

function KonvaTextNode({ el, isSelected, onSelect, onChange, canvasW, canvasH }: NodeProps) {
  const shapeRef = useRef<Konva.Text>(null);
  const trRef    = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleTransformEnd = () => {
    const node = shapeRef.current!;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      x: mm(node.x()), y: mm(node.y()),
      width:  mm(node.width()  * scaleX),
      height: mm(node.height() * scaleY),
      rotation: node.rotation(),
    });
  };

  return (
    <>
      <Text
        id={el.id}
        ref={shapeRef}
        x={px(el.x)} y={px(el.y)}
        width={px(el.width)} height={px(el.height)}
        rotation={el.rotation}
        text={el.text ?? ''}
        fontSize={(el.fontSize ?? 12) * (SCALE / 2)}
        fontStyle={el.bold ? 'bold' : 'normal'}
        align={el.align ?? 'left'}
        fill="#000000"
        name="element"
        draggable
        dragBoundFunc={(pos) => ({
          x: Math.max(0, Math.min(pos.x, canvasW - px(el.width))),
          y: Math.max(0, Math.min(pos.y, canvasH - px(el.height))),
        })}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: mm(e.target.x()), y: mm(e.target.y()) })}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && (
        <Transformer ref={trRef} {...TRANSFORMER_PROPS}
          boundBoxFunc={makeTransformerBoundBox(canvasW, canvasH)} />
      )}
    </>
  );
}

function KonvaImageNode({ el, isSelected, onSelect, onChange, canvasW, canvasH }: NodeProps) {
  const shapeRef = useRef<Konva.Image>(null);
  const trRef    = useRef<Konva.Transformer>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!el.src) return;
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = el.src;
  }, [el.src]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, image]);

  const handleTransformEnd = () => {
    const node = shapeRef.current!;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      x: mm(node.x()), y: mm(node.y()),
      width:  mm(node.width()  * scaleX),
      height: mm(node.height() * scaleY),
      rotation: node.rotation(),
    });
  };

  const dragBound = (pos: { x: number; y: number }) => ({
    x: Math.max(0, Math.min(pos.x, canvasW - px(el.width))),
    y: Math.max(0, Math.min(pos.y, canvasH - px(el.height))),
  });

  if (!image) {
    return (
      <Rect
        id={el.id}
        x={px(el.x)} y={px(el.y)}
        width={px(el.width)} height={px(el.height)}
        rotation={el.rotation}
        stroke="#999" strokeWidth={1} dash={[4, 4]}
        fill="rgba(0,0,0,0.05)"
        name="element"
        draggable
        dragBoundFunc={dragBound}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: mm(e.target.x()), y: mm(e.target.y()) })}
      />
    );
  }

  return (
    <>
      <KonvaImage
        id={el.id}
        ref={shapeRef}
        image={image}
        x={px(el.x)} y={px(el.y)}
        width={px(el.width)} height={px(el.height)}
        rotation={el.rotation}
        name="element"
        draggable
        dragBoundFunc={dragBound}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: mm(e.target.x()), y: mm(e.target.y()) })}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && (
        <Transformer ref={trRef} {...TRANSFORMER_PROPS}
          boundBoxFunc={makeTransformerBoundBox(canvasW, canvasH)} />
      )}
    </>
  );
}

function KonvaBarcodeNode({ el, isSelected, onSelect, onChange, canvasW, canvasH }: NodeProps) {
  const shapeRef = useRef<Konva.Image>(null);
  const trRef    = useRef<Konva.Transformer>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!el.barcodeValue) return;
    let bcid = 'code128';
    if (el.type === 'qr')              bcid = 'qrcode';
    else if (el.type === 'datamatrix') bcid = 'datamatrix';
    else {
      const map: Record<string, string> = { CODE128: 'code128', CODE39: 'code39', EAN13: 'ean13' };
      bcid = map[el.barcodeType ?? 'CODE128'] ?? 'code128';
    }
    renderBwip(bcid, el.barcodeValue, el.barcodeHeight ?? 10)
      .then(({ img, heightMm, widthMm }) => {
        setImage(img);
        // For QR / DataMatrix: lock to square using the larger rendered dimension
        if (el.type === 'qr' || el.type === 'datamatrix') {
          const side = Math.max(heightMm, widthMm);
          onChange({ width: side, height: side });
        } else {
          // Barcode: only adjust height (bars + human-readable text)
          onChange({ height: heightMm });
        }
      })
      .catch(() => setImage(null));
  }, [el.barcodeValue, el.type, el.barcodeType, el.barcodeHeight]);

  // Add `image` to deps: the Transformer must re-attach after the image finishes
  // loading (shapeRef is null while the placeholder Rect is shown).
  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, image]);

  const handleTransformEnd = () => {
    const node = shapeRef.current!;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const newW = mm(node.width()  * scaleX);
    const newH = mm(node.height() * scaleY);
    const isSquare = el.type === 'qr' || el.type === 'datamatrix';
    const side = isSquare ? Math.min(newW, newH) : undefined;
    onChange({
      x: mm(node.x()), y: mm(node.y()),
      width:  isSquare ? side! : newW,
      height: isSquare ? side! : newH,
      rotation: node.rotation(),
    });
  };

  const dragBound = (pos: { x: number; y: number }) => ({
    x: Math.max(0, Math.min(pos.x, canvasW - px(el.width))),
    y: Math.max(0, Math.min(pos.y, canvasH - px(el.height))),
  });

  if (!image) {
    return (
      <Rect
        id={el.id}
        x={px(el.x)} y={px(el.y)}
        width={px(el.width)} height={px(el.height)}
        rotation={el.rotation}
        stroke="#f97316" strokeWidth={1} dash={[4, 4]}
        fill="rgba(249,115,22,0.05)"
        name="element"
        draggable
        dragBoundFunc={dragBound}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: mm(e.target.x()), y: mm(e.target.y()) })}
      />
    );
  }

  return (
    <>
      <KonvaImage
        id={el.id}
        ref={shapeRef}
        image={image}
        x={px(el.x)} y={px(el.y)}
        width={px(el.width)} height={px(el.height)}
        rotation={el.rotation}
        name="element"
        draggable
        dragBoundFunc={dragBound}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: mm(e.target.x()), y: mm(e.target.y()) })}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && (
        <Transformer ref={trRef} {...TRANSFORMER_PROPS}
          boundBoxFunc={makeTransformerBoundBox(canvasW, canvasH)} />
      )}
    </>
  );
}

function KonvaRectNode({ el, isSelected, onSelect, onChange, canvasW, canvasH }: NodeProps) {
  const shapeRef = useRef<Konva.Rect>(null);
  const trRef    = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const fill        = el.fillColor ?? 'transparent';
  const stroke      = el.strokeColor === 'transparent' ? '' : (el.strokeColor ?? '#000000');
  const strokeWidth = el.strokeColor === 'transparent' ? 0 : px(el.strokeWidthMm ?? 0.5);

  const handleTransformEnd = () => {
    const node = shapeRef.current!;
    const scaleX = node.scaleX(), scaleY = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    onChange({ x: mm(node.x()), y: mm(node.y()), width: mm(node.width() * scaleX), height: mm(node.height() * scaleY), rotation: node.rotation() });
  };

  return (
    <>
      <Rect
        id={el.id} ref={shapeRef}
        x={px(el.x)} y={px(el.y)} width={px(el.width)} height={px(el.height)}
        rotation={el.rotation} fill={fill} stroke={stroke} strokeWidth={strokeWidth}
        name="element" draggable
        dragBoundFunc={(pos) => ({ x: Math.max(0, Math.min(pos.x, canvasW - px(el.width))), y: Math.max(0, Math.min(pos.y, canvasH - px(el.height))) })}
        onClick={onSelect} onTap={onSelect}
        onDragEnd={(e) => onChange({ x: mm(e.target.x()), y: mm(e.target.y()) })}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && <Transformer ref={trRef} {...TRANSFORMER_PROPS} boundBoxFunc={makeTransformerBoundBox(canvasW, canvasH)} />}
    </>
  );
}

function KonvaCircleNode({ el, isSelected, onSelect, onChange, canvasW, canvasH }: NodeProps) {
  const shapeRef = useRef<Konva.Ellipse>(null);
  const trRef    = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const fill        = el.fillColor ?? 'transparent';
  const stroke      = el.strokeColor === 'transparent' ? '' : (el.strokeColor ?? '#000000');
  const strokeWidth = el.strokeColor === 'transparent' ? 0 : px(el.strokeWidthMm ?? 0.5);
  const rx = px(el.width) / 2, ry = px(el.height) / 2;

  const handleTransformEnd = () => {
    const node = shapeRef.current!;
    const scaleX = node.scaleX(), scaleY = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    const newRX = node.radiusX() * scaleX, newRY = node.radiusY() * scaleY;
    onChange({ x: mm(node.x() - newRX), y: mm(node.y() - newRY), width: mm(newRX * 2), height: mm(newRY * 2), rotation: node.rotation() });
  };

  return (
    <>
      <Ellipse
        id={el.id} ref={shapeRef}
        x={px(el.x) + rx} y={px(el.y) + ry} radiusX={rx} radiusY={ry}
        rotation={el.rotation} fill={fill} stroke={stroke} strokeWidth={strokeWidth}
        name="element" draggable
        dragBoundFunc={(pos) => ({ x: Math.max(rx, Math.min(pos.x, canvasW - rx)), y: Math.max(ry, Math.min(pos.y, canvasH - ry)) })}
        onClick={onSelect} onTap={onSelect}
        onDragEnd={(e) => onChange({ x: mm(e.target.x()) - el.width / 2, y: mm(e.target.y()) - el.height / 2 })}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && <Transformer ref={trRef} {...TRANSFORMER_PROPS} boundBoxFunc={makeTransformerBoundBox(canvasW, canvasH)} />}
    </>
  );
}

function KonvaElementNode(props: NodeProps) {
  const { el } = props;
  if (el.type === 'text')   return <KonvaTextNode {...props} />;
  if (el.type === 'image')  return <KonvaImageNode {...props} />;
  if (el.type === 'rect')   return <KonvaRectNode {...props} />;
  if (el.type === 'circle') return <KonvaCircleNode {...props} />;
  return <KonvaBarcodeNode {...props} />;
}

// ── Properties panel ─────────────────────────────────────────────────────────
interface PropsPanel {
  el: LabelElement | undefined;
  onChange: (patch: Partial<LabelElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReplaceImage: () => void;
}

function PropertiesPanel({ el, onChange, onDelete, onDuplicate, onReplaceImage }: PropsPanel) {
  if (!el) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        Click an element to edit its properties.
      </Typography>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 1.5, overflowY: 'auto' }}>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Position & Size
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {(['x', 'y', 'width', 'height'] as const).map((k) => (
          <TextField
            key={k}
            label={k === 'x' ? 'X (mm)' : k === 'y' ? 'Y (mm)' : k === 'width' ? 'W (mm)' : 'H (mm)'}
            type="number"
            size="small"
            value={Math.round((el[k] as number) * 10) / 10}
            onChange={(e) => onChange({ [k]: parseFloat(e.target.value) || 0 })}
            inputProps={{ step: 0.5 }}
          />
        ))}
      </Box>

      <TextField
        label="Rotation (°)"
        type="number"
        size="small"
        value={Math.round(el.rotation)}
        onChange={(e) => onChange({ rotation: parseFloat(e.target.value) || 0 })}
        inputProps={{ step: 1 }}
      />

      <Divider />

      {el.type === 'text' && (
        <>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Text
          </Typography>
          <TextField
            label="Content"
            multiline
            rows={2}
            size="small"
            value={el.text ?? ''}
            onChange={(e) => onChange({ text: e.target.value })}
          />
          <Box>
            <Typography variant="caption" color="text.secondary">Font size: {el.fontSize ?? 12} pt</Typography>
            <Slider
              value={el.fontSize ?? 12}
              min={6} max={96} step={1}
              onChange={(_, v) => onChange({ fontSize: v as number })}
              size="small"
            />
          </Box>
          <FormControl size="small" fullWidth>
            <InputLabel>Align</InputLabel>
            <Select
              value={el.align ?? 'left'}
              label="Align"
              onChange={(e) => onChange({ align: e.target.value as any })}
            >
              <MenuItem value="left">Left</MenuItem>
              <MenuItem value="center">Center</MenuItem>
              <MenuItem value="right">Right</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Checkbox checked={!!el.bold} onChange={(e) => onChange({ bold: e.target.checked })} />}
            label="Bold"
          />
        </>
      )}

      {(el.type === 'barcode' || el.type === 'qr' || el.type === 'datamatrix') && (
        <>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {el.type === 'barcode' ? 'Barcode' : el.type === 'qr' ? 'QR Code' : 'DataMatrix'}
          </Typography>
          {el.type === 'barcode' && (
            <FormControl size="small" fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={el.barcodeType ?? 'CODE128'}
                label="Type"
                onChange={(e) => onChange({ barcodeType: e.target.value })}
              >
                {BARCODE_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            label="Value"
            size="small"
            value={el.barcodeValue ?? ''}
            onChange={(e) => onChange({ barcodeValue: e.target.value })}
          />
          {el.type === 'barcode' && (
            <TextField
              label="Bar height (mm)"
              type="number"
              size="small"
              value={el.barcodeHeight ?? 10}
              onChange={(e) => onChange({ barcodeHeight: Math.max(1, parseInt(e.target.value) || 10) })}
              inputProps={{ min: 1, max: 100, step: 1, style: { width: '10ch' } }}
            />
          )}
          {el.type === 'barcode' && el.barcodeType === 'EAN13' && (
            <Typography variant="caption" color="warning.main">EAN-13 requires exactly 12 digits</Typography>
          )}
        </>
      )}

      {el.type === 'image' && (
        <>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Image
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Image will be dithered to 1-bit for ZPL printing.
          </Typography>
          <Button size="small" variant="outlined" onClick={onReplaceImage}>Replace image</Button>
        </>
      )}

      {(el.type === 'rect' || el.type === 'circle') && (
        <>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {el.type === 'rect' ? 'Rectangle' : 'Circle'}
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Fill</InputLabel>
            <Select value={el.fillColor ?? 'transparent'} label="Fill"
              onChange={(e) => onChange({ fillColor: e.target.value })}>
              {SHAPE_COLORS.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Border</InputLabel>
            <Select value={el.strokeColor ?? '#000000'} label="Border"
              onChange={(e) => onChange({ strokeColor: e.target.value })}>
              {SHAPE_COLORS.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
          </FormControl>
          {(el.strokeColor ?? '#000000') !== 'transparent' && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Border thickness: {(el.strokeWidthMm ?? 0.5).toFixed(1)} mm
              </Typography>
              <Slider
                value={el.strokeWidthMm ?? 0.5}
                min={0.1} max={5} step={0.1}
                onChange={(_, v) => onChange({ strokeWidthMm: v as number })}
                size="small"
              />
            </Box>
          )}
        </>
      )}

      <Divider />

      <Stack direction="row" spacing={1}>
        <Tooltip title="Duplicate">
          <IconButton size="small" onClick={onDuplicate}><ContentCopyIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}

// ── Sortable layer row ────────────────────────────────────────────────────────
interface SortableLayerItemProps {
  el: LabelElement;
  isSelected: boolean;
  isTop: boolean;
  isBottom: boolean;
  onSelect: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SortableLayerItem({ el, isSelected, isTop, isBottom, onSelect, onMoveUp, onMoveDown }: SortableLayerItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: el.id });

  const typeLabel = el.type === 'text' ? 'T' : el.type === 'image' ? 'I' : el.type === 'qr' ? 'Q' : el.type === 'datamatrix' ? 'D' : el.type === 'rect' ? 'R' : el.type === 'circle' ? 'C' : 'B';
  const nameLabel = el.type === 'text' ? (el.text?.slice(0, 12) ?? '') : el.type === 'image' ? 'Image' : el.type === 'rect' ? 'Rectangle' : el.type === 'circle' ? 'Circle' : (el.barcodeValue?.slice(0, 10) ?? '');

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={() => onSelect(el.id)}
      sx={{
        px: 0.5, py: 0.25, borderRadius: 1, cursor: 'pointer', fontSize: '0.7rem',
        border: '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        bgcolor: isSelected ? 'action.selected' : isDragging ? 'action.hover' : 'transparent',
        color: isSelected ? 'primary.main' : 'text.secondary',
        display: 'flex', alignItems: 'center', gap: 0.5,
        overflow: 'hidden',
        '&:hover': { borderColor: isSelected ? 'primary.main' : 'text.secondary' },
      }}
    >
      {/* Drag handle */}
      <Box
        component="span"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        sx={{ display: 'flex', cursor: 'grab', color: 'text.disabled', flexShrink: 0, '&:active': { cursor: 'grabbing' } }}
      >
        <DragIndicatorIcon sx={{ fontSize: 14 }} />
      </Box>

      <Box component="span" sx={{ fontWeight: 700, flexShrink: 0 }}>{typeLabel}</Box>
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {nameLabel}
      </Box>

      <Tooltip title="Bring forward" placement="right">
        <span>
          <IconButton size="small" disabled={isTop}
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            sx={{ p: '1px' }}
          >
            <KeyboardArrowUpIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Send back" placement="right">
        <span>
          <IconButton size="small" disabled={isBottom}
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            sx={{ p: '1px' }}
          >
            <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LabelDesignerPage() {
  const token = useSelector((s: RootState) => s.auth.token);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [sizeKey,    setSizeKey]    = useState('small');
  const [elements,   setElements]   = useState<LabelElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab,        setTab]        = useState(0);   // 0 = designer, 1 = zpl
  const [zpl,        setZpl]        = useState('');
  const [zoom,       setZoom]       = useState(1);
  const [customW,    setCustomW]    = useState(100);
  const [customH,    setCustomH]    = useState(70);
  const [snapLines,  setSnapLines]  = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [templates,  setTemplates]  = useState<SavedTemplate[]>([]);
  const [saveModal,  setSaveModal]  = useState(false);
  const [loadModal,  setLoadModal]  = useState(false);
  const [loadSearch, setLoadSearch] = useState('');
  const [tmplName,   setTmplName]   = useState('');
  const [tmplDesc,   setTmplDesc]   = useState('');
  const [tmplSaving, setTmplSaving] = useState(false);

  const stageRef  = useRef<Konva.Stage>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  // ── Derived size ────────────────────────────────────────────────────────
  const savedTmpl = templates.find((t) => t.id === sizeKey);
  const { w, h } = savedTmpl
    ? { w: savedTmpl.size_w_mm, h: savedTmpl.size_h_mm }
    : sizeKey === 'custom'
      ? { w: customW, h: customH }
      : (SIZES[sizeKey] ?? { w: 100, h: 70 });

  // Delete key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') &&
          !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stage-level snapping ────────────────────────────────────────────────
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const threshold = SNAP_THRESHOLD / zoom;

    const onDragMove = (e: { target: any }) => {
      const target = e.target;
      if (target === stage) return;
      const stageW = px(w), stageH = px(h);

      // Collect snap stops: canvas edges + center + other elements
      const snapV: number[] = [0, stageW / 2, stageW];
      const snapH: number[] = [0, stageH / 2, stageH];
      stage.find('.element').forEach((node: any) => {
        if (node === target) return;
        const r = node.getClientRect({ relativeTo: stage });
        snapV.push(r.x, r.x + r.width / 2, r.x + r.width);
        snapH.push(r.y, r.y + r.height / 2, r.y + r.height);
      });

      const box = target.getClientRect({ relativeTo: stage });
      const posX = target.x(), posY = target.y();

      let bestV: { guide: number; offset: number } | null = null;
      let minV = threshold;
      for (const snap of snapV) {
        for (const [val, off] of [
          [box.x,              posX - box.x],
          [box.x + box.width / 2, posX - box.x - box.width / 2],
          [box.x + box.width,  posX - box.x - box.width],
        ] as [number, number][]) {
          const dist = Math.abs(snap - val);
          if (dist < minV) { minV = dist; bestV = { guide: snap, offset: off }; }
        }
      }

      let bestH: { guide: number; offset: number } | null = null;
      let minH = threshold;
      for (const snap of snapH) {
        for (const [val, off] of [
          [box.y,               posY - box.y],
          [box.y + box.height / 2, posY - box.y - box.height / 2],
          [box.y + box.height,  posY - box.y - box.height],
        ] as [number, number][]) {
          const dist = Math.abs(snap - val);
          if (dist < minH) { minH = dist; bestH = { guide: snap, offset: off }; }
        }
      }

      if (bestV) target.x(bestV.guide + bestV.offset);
      if (bestH) target.y(bestH.guide + bestH.offset);
      setSnapLines({ v: bestV ? [bestV.guide] : [], h: bestH ? [bestH.guide] : [] });
    };

    const onDragEnd = () => setSnapLines({ v: [], h: [] });

    stage.on('dragmove', onDragMove);
    stage.on('dragend', onDragEnd);
    return () => {
      stage.off('dragmove', onDragMove);
      stage.off('dragend', onDragEnd);
    };
  }, [w, h, zoom]);

  // Imperatively resize the Konva stage whenever zoom or label size changes.
  // react-konva does not reliably propagate width/height prop changes after mount.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.width(px(w) * zoom);
    stage.height(px(h) * zoom);
    stage.scaleX(zoom);
    stage.scaleY(zoom);
    stage.batchDraw();
  }, [zoom, w, h]);

  const updateElement = useCallback((id: string, patch: Partial<LabelElement>) => {
    setElements((prev) => prev.map((el) => el.id === id ? { ...el, ...patch } : el));
  }, []);

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    const el = elements.find((e) => e.id === selectedId);
    if (!el) return;
    const copy = { ...el, id: nanoid(), x: el.x + 4, y: el.y + 4 };
    setElements((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };

  const moveElement = useCallback((id: string, dir: 'up' | 'down') => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      if (dir === 'up' && idx < prev.length - 1) {
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      } else if (dir === 'down' && idx > 0) {
        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      }
      return next;
    });
  }, []);

  // dnd-kit sensors — require 5px movement before drag starts (prevents accidental drags on click)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleLayerDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setElements((prev) => {
      // Layers panel shows elements in reversed order, so sort in that space
      const reversedIds = [...prev].reverse().map((e) => e.id);
      const oldIdx = reversedIds.indexOf(active.id as string);
      const newIdx = reversedIds.indexOf(over.id as string);
      const newReversed = arrayMove(reversedIds, oldIdx, newIdx);
      // Map back to element objects in bottom-to-top (original) order
      const idToEl = Object.fromEntries(prev.map((e) => [e.id, e]));
      return [...newReversed].reverse().map((id) => idToEl[id]);
    });
  }, []);

  // ── Add element helpers ──────────────────────────────────────────────────
  const addText = () => {
    const el: LabelElement = { id: nanoid(), type: 'text', x: 5, y: 5, width: 50, height: 10, rotation: 0,
      text: 'Label Text', fontSize: 12, bold: false, align: 'left' };
    setElements((p) => [...p, el]);
    setSelectedId(el.id);
  };

  const addBarcode = () => {
    const el: LabelElement = { id: nanoid(), type: 'barcode', x: 5, y: 20, width: 60, height: 18, rotation: 0,
      barcodeValue: '1234567890', barcodeType: 'CODE128', barcodeHeight: 10 };
    setElements((p) => [...p, el]);
    setSelectedId(el.id);
  };

  const addQR = () => {
    const el: LabelElement = { id: nanoid(), type: 'qr', x: 5, y: 5, width: 30, height: 30, rotation: 0,
      barcodeValue: 'https://example.com' };
    setElements((p) => [...p, el]);
    setSelectedId(el.id);
  };

  const addDataMatrix = () => {
    const el: LabelElement = { id: nanoid(), type: 'datamatrix', x: 5, y: 5, width: 25, height: 25, rotation: 0,
      barcodeValue: 'ABC-123' };
    setElements((p) => [...p, el]);
    setSelectedId(el.id);
  };

  const addRect = () => {
    const el: LabelElement = { id: nanoid(), type: 'rect', x: 10, y: 10, width: 40, height: 20, rotation: 0,
      fillColor: 'transparent', strokeColor: '#000000', strokeWidthMm: 0.5 };
    setElements((p) => [...p, el]);
    setSelectedId(el.id);
  };

  const addCircle = () => {
    const el: LabelElement = { id: nanoid(), type: 'circle', x: 10, y: 10, width: 25, height: 25, rotation: 0,
      fillColor: 'transparent', strokeColor: '#000000', strokeWidthMm: 0.5 };
    setElements((p) => [...p, el]);
    setSelectedId(el.id);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const el: LabelElement = { id: nanoid(), type: 'image', x: 5, y: 5, width: 30, height: 20, rotation: 0,
        src: ev.target?.result as string };
      setElements((p) => [...p, el]);
      setSelectedId(el.id);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleStageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleStageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.container().getBoundingClientRect();
    const dropX = mm((e.clientX - rect.left) / zoom);
    const dropY = mm((e.clientY - rect.top) / zoom);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const elW = Math.min(50, w * 0.5);
        const elH = elW * (img.height / img.width);
        const el: LabelElement = {
          id: nanoid(), type: 'image',
          x: Math.max(0, Math.min(dropX, w - elW)),
          y: Math.max(0, Math.min(dropY, h - elH)),
          width: elW, height: elH, rotation: 0,
          src: ev.target?.result as string,
        };
        setElements((p) => [...p, el]);
        setSelectedId(el.id);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // ── Load saved templates on mount ────────────────────────────────────────
  useEffect(() => {
    axios.get<SavedTemplate[]>('/labeling/label-templates', { headers })
      .then((r) => setTemplates(r.data))
      .catch(() => { /* non-fatal — templates just won't show */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save as template ─────────────────────────────────────────────────────
  const handleSaveAsTemplate = async () => {
    if (!tmplName.trim()) return;
    setTmplSaving(true);
    try {
      // Capture a small preview PNG from the stage (reset scale so it renders at 1x)
      const stage = stageRef.current;
      let preview_b64: string | null = null;
      if (stage) {
        // Deselect imperatively so handles don't appear in the thumbnail
        const transformers = stage.find('Transformer') as Konva.Transformer[];
        transformers.forEach((tr) => tr.nodes([]));

        const gridLayer = stage.findOne('#grid-layer') as Konva.Layer | undefined;
        gridLayer?.visible(false);

        const prevScaleX = stage.scaleX();
        const prevScaleY = stage.scaleY();
        stage.scaleX(1);
        stage.scaleY(1);
        stage.batchDraw();
        preview_b64 = stage.toDataURL({ pixelRatio: 0.5 });
        stage.scaleX(prevScaleX);
        stage.scaleY(prevScaleY);

        gridLayer?.visible(true);
        stage.batchDraw();
        setSelectedId(null);
      }

      const res = await axios.post<SavedTemplate>(
        '/labeling/label-templates',
        {
          name: tmplName.trim(),
          description: tmplDesc.trim() || null,
          size_w_mm: w,
          size_h_mm: h,
          elements_json: JSON.stringify(elements),
          preview_b64,
        },
        { headers },
      );
      setTemplates((prev) => [res.data, ...prev]);
      setSaveModal(false);
      setTmplName('');
      setTmplDesc('');
      toast.success('Template saved.');
    } catch (err: any) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail ?? err.message) : 'Save failed';
      toast.error(String(msg));
    } finally {
      setTmplSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await axios.delete(`/labeling/label-templates/${id}`, { headers });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (sizeKey === id) setSizeKey('small');
      toast.success('Template deleted.');
    } catch {
      toast.error('Delete failed.');
    }
  };

  // ── ZPL & print ──────────────────────────────────────────────────────────
  const handleGenerateZpl = async () => {
    const code = await buildZPL(elements, { w, h });
    setZpl(code);
    setTab(1);
  };

  const handleSave = async () => {
    if (tab === 1) {
      // Save ZPL as .zpl file
      const code = zpl || await buildZPL(elements, { w, h });
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `label-${sizeKey}.zpl`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Save canvas as PNG at 300 dpi
      // stage.scaleX = zoom, so pixelRatio = DPM / (SCALE * zoom) normalises zoom out
      // and produces an image where 1 px = 1/300 inch regardless of zoom level.
      const stage = stageRef.current;
      if (!stage) return;

      // Imperatively detach all Transformer nodes so handles are invisible in the export.
      // Cannot rely on setSelectedId(null) — React state update is async and would fire
      // after toDataURL() already ran.
      const transformers = stage.find('Transformer') as Konva.Transformer[];
      transformers.forEach((tr) => tr.nodes([]));

      const gridLayer = stage.findOne('#grid-layer') as Konva.Layer | undefined;
      gridLayer?.visible(false);
      stage.batchDraw();

      const dataUrl = stage.toDataURL({ pixelRatio: DPM / (SCALE * zoom) });

      gridLayer?.visible(true);
      stage.batchDraw();

      // Restore UI selection state so the canvas still shows selected element after save
      setSelectedId(null);

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `label-${sizeKey}.png`;
      a.click();
    }
  };

  const handlePrint = async () => {
    const code = await buildZPL(elements, { w, h });
    const toastId = toast.loading('Sending to printer…');
    try {
      const res = await axios.post('/labeling/print', { zpl: code }, { headers });
      if (res.data?.success) {
        toast.update(toastId, { render: 'Printed!', type: 'success', isLoading: false, autoClose: 3000 });
      } else {
        toast.update(toastId, { render: res.data?.detail ?? 'Unknown error', type: 'error', isLoading: false, autoClose: 4000 });
      }
    } catch (err: any) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail ?? err.message) : 'Print failed';
      toast.update(toastId, { render: String(msg), type: 'error', isLoading: false, autoClose: 4000 });
    }
  };

  const selectedEl = elements.find((e) => e.id === selectedId);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)', gap: 1 }}>

      {/* Top bar */}
      <Paper sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Label size</InputLabel>
          <Select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)} label="Label size">
            {Object.entries(SIZES).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {sizeKey === 'custom' && (
          <>
            <TextField
              size="small" label="W (mm)" type="number"
              value={customW}
              onChange={(e) => setCustomW(Math.max(10, parseInt(e.target.value) || 10))}
              inputProps={{ min: 10, max: 400, step: 5 }}
              sx={{ width: 85 }}
            />
            <TextField
              size="small" label="H (mm)" type="number"
              value={customH}
              onChange={(e) => setCustomH(Math.max(10, parseInt(e.target.value) || 10))}
              inputProps={{ min: 10, max: 400, step: 5 }}
              sx={{ width: 85 }}
            />
            <Tooltip title="Save current design as a reusable template">
              <Button size="small" variant="outlined" startIcon={<BookmarkAddIcon />} onClick={() => setSaveModal(true)}>
                Save as Template
              </Button>
            </Tooltip>
          </>
        )}

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Load a saved template onto the canvas">
          <Button size="small" variant="outlined" onClick={() => { setLoadSearch(''); setLoadModal(true); }}>
            Load Template
          </Button>
        </Tooltip>
        
        <Button size="small" variant="outlined" startIcon={<SaveAltIcon />} onClick={handleSave}>
          Save
        </Button>
        <Button size="small" variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>
          Print
        </Button>
      </Paper>

      {/* Save-as-template modal */}
      <Dialog open={saveModal} onClose={() => setSaveModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save as Template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Template name"
              size="small"
              required
              autoFocus
              value={tmplName}
              onChange={(e) => setTmplName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && tmplName.trim()) handleSaveAsTemplate(); }}
            />
            <TextField
              label="Description (optional)"
              size="small"
              multiline
              rows={2}
              value={tmplDesc}
              onChange={(e) => setTmplDesc(e.target.value)}
            />
            <Typography variant="caption" color="text.secondary">
              Size: {w} × {h} mm · {elements.length} element{elements.length !== 1 ? 's' : ''}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!tmplName.trim() || tmplSaving}
            onClick={handleSaveAsTemplate}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Load template modal */}
      <Dialog open={loadModal} onClose={() => setLoadModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>Load Template</DialogTitle>
        <DialogContent>
          <TextField
            size="small" fullWidth placeholder="Search by name…"
            value={loadSearch}
            onChange={(e) => setLoadSearch(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          {templates.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No saved templates yet.</Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
              {templates
                .filter((t) => t.name.toLowerCase().includes(loadSearch.toLowerCase()))
                .map((t) => (
                  <Paper
                    key={t.id}
                    variant="outlined"
                    sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1, cursor: 'pointer',
                      '&:hover': { borderColor: 'primary.main' } }}
                    onClick={() => {
                      setSizeKey('custom');
                      setCustomW(t.size_w_mm);
                      setCustomH(t.size_h_mm);
                      setElements(JSON.parse(t.elements_json));
                      setSelectedId(null);
                      setLoadModal(false);
                      toast.success(`Loaded "${t.name}"`);
                    }}
                  >
                    {/* Preview thumbnail */}
                    <Box sx={{
                      width: '100%', aspectRatio: `${t.size_w_mm} / ${t.size_h_mm}`,
                      bgcolor: '#f5f5f5', border: '1px solid', borderColor: 'divider',
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {t.preview_b64
                        ? <Box component="img" src={t.preview_b64} alt={t.name} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        : <Typography variant="caption" color="text.disabled">No preview</Typography>
                      }
                    </Box>
                    <Typography variant="body2" fontWeight={700} noWrap>{t.name}</Typography>
                    {t.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {t.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.disabled">{t.size_w_mm} × {t.size_h_mm} mm</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Tooltip title="Delete template">
                        <IconButton size="small" color="error"
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoadModal(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Main area */}
      <Box sx={{ display: 'flex', flex: 1, gap: 1, overflow: 'hidden' }}>

        {/* Left: element toolbar + layers */}
        <Paper sx={{ width: 160, p: 1, display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0, overflowY: 'auto' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
            Add
          </Typography>

          {[
            { label: 'Text',        icon: <TitleIcon fontSize="small" />,              action: addText },
            { label: 'Image',       icon: <ImageIcon fontSize="small" />,              action: () => fileRef.current?.click() },
            { label: 'Barcode',     icon: <ViewWeekIcon fontSize="small" />,           action: addBarcode },
            { label: 'QR Code',     icon: <QrCodeIcon fontSize="small" />,             action: addQR },
            { label: 'DataMatrix',  icon: <QrCode2Icon fontSize="small" />,            action: addDataMatrix },
            { label: 'Rectangle',   icon: <CropSquareIcon fontSize="small" />,         action: addRect },
            { label: 'Circle',      icon: <RadioButtonUncheckedIcon fontSize="small" />, action: addCircle },
          ].map(({ label, icon, action }) => (
            <Button
              key={label}
              size="small"
              variant="outlined"
              startIcon={icon}
              onClick={action}
              sx={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
            >
              {label}
            </Button>
          ))}

          <input
            type="file"
            ref={fileRef}
            style={{ display: 'none' }}
            accept="image/jpeg,image/jpg,image/png,image/svg+xml"
            onChange={handleImageFile}
          />

          <Divider sx={{ my: 1 }} />

          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
            Layers
          </Typography>

          {elements.length === 0 && (
            <Typography variant="caption" color="text.secondary">No elements yet</Typography>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLayerDragEnd}>
            <SortableContext
              items={[...elements].reverse().map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <Stack gap={0.5}>
                {[...elements].reverse().map((el, revIdx) => {
                  const idx = elements.length - 1 - revIdx;
                  return (
                    <SortableLayerItem
                      key={el.id}
                      el={el}
                      isSelected={el.id === selectedId}
                      isTop={idx === elements.length - 1}
                      isBottom={idx === 0}
                      onSelect={setSelectedId}
                      onMoveUp={() => moveElement(el.id, 'up')}
                      onMoveDown={() => moveElement(el.id, 'down')}
                    />
                  );
                })}
              </Stack>
            </SortableContext>
          </DndContext>
        </Paper>

        {/* Center: Tabs + Canvas */}
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => {
              if (v === 1) handleGenerateZpl();
              else setTab(v);
            }}
            sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
          >
            <Tab label="Designer" />
            <Tab label="ZPL Preview" />
          </Tabs>

          {tab === 0 && (
            <Box
              sx={{
                flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column',
                alignItems: 'flex-start', bgcolor: 'background.default',
              }}
              onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
            >
              {/* Zoom toolbar */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1, flexShrink: 0, width: '100%' }}>
                <Typography variant="caption" color="text.secondary">Zoom</Typography>
                <Slider
                  value={zoom}
                  min={1} max={2.5} step={0.05}
                  onChange={(_, v) => setZoom(v as number)}
                  size="small"
                  sx={{ width: 140 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>
                  {Math.round(zoom * 100)}%
                </Typography>
              </Box>

              {/* Canvas area */}
              <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', p: 4 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {`${w} × ${h} mm`} — preview (not actual scale)
                  </Typography>
                  <Box
                    sx={{
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.12), 0 8px 48px rgba(0,0,0,0.2)',
                      display: 'inline-block',
                      lineHeight: 0,
                    }}
                    onDragOver={handleStageDragOver}
                    onDrop={handleStageDrop}
                  >
                        <Stage
                          ref={stageRef}
                          width={px(w) * zoom}
                          height={px(h) * zoom}
                          scaleX={zoom}
                          scaleY={zoom}
                          style={{ display: 'block' }}
                          onClick={(e) => {
                            if (e.target === e.target.getStage()) setSelectedId(null);
                          }}
                        >
                          {/* background-layer: outer colour + white label surface */}
                          <Layer id="background-layer" listening={false}>
                            {/* Outer canvas colour — fills the whole stage */}
                            <Rect
                              x={0} y={0}
                              width={px(w)} height={px(h)}
                              fill="#ffffff"
                            />
                            {/* White label surface — same bounds as the stage/label 
                            <Rect
                              x={0} y={0}
                              width={px(w)} height={px(h)}
                              fill="#ffffff"
                            />*/}
                          </Layer>

                          {/* grid-layer: 5 mm grid, 10 mm lines slightly darker */}
                          <Layer id="grid-layer" listening={false}>
                            {Array.from({ length: Math.floor(w / 5) + 1 }, (_, i) => i * 5).map((xMM) => (
                              <Line
                                key={`gv${xMM}`}
                                points={[px(xMM), 0, px(xMM), px(h)]}
                                stroke={xMM % 10 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.05)'}
                                strokeWidth={1 / zoom}
                                listening={false}
                              />
                            ))}
                            {Array.from({ length: Math.floor(h / 5) + 1 }, (_, i) => i * 5).map((yMM) => (
                              <Line
                                key={`gh${yMM}`}
                                points={[0, px(yMM), px(w), px(yMM)]}
                                stroke={yMM % 10 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.05)'}
                                strokeWidth={1 / zoom}
                                listening={false}
                              />
                            ))}
                          </Layer>

                          {/* data-layer: user elements + snap guides */}
                          <Layer id="data-layer">
                            {elements.map((el) => (
                              <KonvaElementNode
                                key={el.id}
                                el={el}
                                isSelected={el.id === selectedId}
                                onSelect={() => setSelectedId(el.id)}
                                onChange={(patch) => updateElement(el.id, patch)}
                                canvasW={px(w) * zoom*1}
                                canvasH={px(h) * zoom*1}
                              />
                            ))}
                            {snapLines.v.map((x, i) => (
                              <Line key={`sv${i}`} points={[x, 0, x, px(h)]} stroke="#f97316"
                                strokeWidth={1 / zoom} dash={[4, 4]} listening={false} />
                            ))}
                            {snapLines.h.map((y, i) => (
                              <Line key={`sh${i}`} points={[0, y, px(w), y]} stroke="#f97316"
                                strokeWidth={1 / zoom} dash={[4, 4]} listening={false} />
                            ))}
                          </Layer>
                        </Stage>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {tab === 1 && (
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button size="small" variant="outlined" onClick={() => navigator.clipboard.writeText(zpl)} disabled={!zpl}>
                  Copy ZPL
                </Button>
                {zpl && (
                  <Typography variant="caption" color="text.secondary">
                    {zpl.split('\n').length} lines
                  </Typography>
                )}
              </Stack>
              {zpl ? (
                <Box
                  component="pre"
                  sx={{
                    bgcolor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: 'success.main',
                    lineHeight: 1.8,
                    overflow: 'auto',
                    m: 0,
                  }}
                >
                  {zpl}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Click the <strong>ZPL Preview</strong> tab to generate code from your design.
                </Typography>
              )}
            </Box>
          )}
        </Paper>

        {/* Right: properties */}
        <Paper sx={{ width: 230, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', display: 'block' }}>
            Properties
          </Typography>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <PropertiesPanel
              el={selectedEl}
              onChange={(patch) => selectedId && updateElement(selectedId, patch)}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
              onReplaceImage={() => fileRef.current?.click()}
            />
          </Box>
        </Paper>

      </Box>
    </Box>
  );
}
