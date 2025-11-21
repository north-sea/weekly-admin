'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export type EllipsisTooltipProps = {
  value?: string;
  width?: string;
  def?: { width?: string };
  maxLength?: number;
  line?: number;
  zIndex?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** tooltip 最大宽度，默认为 '70%'，与原来保持一致 */
  tooltipMaxWidth?: string | number;
  /** tooltip 额外样式，会与默认样式合并 */
  tooltipStyle?: React.CSSProperties;
  className?: string;
};

const defaultZIndex = 1200;
const offset = 8;

export function EllipsisTooltip({
  value = '',
  width,
  def,
  maxLength = 0,
  line = 1,
  zIndex = defaultZIndex,
  placement = 'top',
  tooltipMaxWidth = '70%',
  tooltipStyle = {},
  className,
}: EllipsisTooltipProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const resolvedWidth = width || def?.width || '300px';
  const text = maxLength > 0 && value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  const showTooltip = Boolean(value);

  useEffect(() => {
    if (!open) return;

    const updateRect = () => {
      if (triggerRef.current) {
        setRect(triggerRef.current.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [open]);

  const lineClampStyle: React.CSSProperties =
    line > 1
      ? {
          display: '-webkit-box',
          WebkitLineClamp: line,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }
      : {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        };

  const computeTooltipStyle = (): React.CSSProperties => {
    if (!rect) return { display: 'none' };
    const style: React.CSSProperties = { position: 'fixed', zIndex, maxWidth: tooltipMaxWidth };
    switch (placement) {
      case 'bottom':
        style.top = rect.bottom + offset;
        style.left = rect.left + rect.width / 2;
        style.transform = 'translateX(-50%)';
        break;
      case 'left':
        style.top = rect.top + rect.height / 2;
        style.left = rect.left - offset;
        style.transform = 'translate(-100%, -50%)';
        break;
      case 'right':
        style.top = rect.top + rect.height / 2;
        style.left = rect.right + offset;
        style.transform = 'translate(0, -50%)';
        break;
      case 'top':
      default:
        style.top = rect.top - offset;
        style.left = rect.left + rect.width / 2;
        style.transform = 'translate(-50%, -100%)';
        break;
    }
    return style;
  };

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('relative inline-block align-top text-foreground', className)}
        style={{ width: resolvedWidth }}
        onMouseEnter={() => showTooltip && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => showTooltip && setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <span className="block" style={lineClampStyle}>
          {text || '-'}
        </span>
      </span>
      {open && showTooltip && rect
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none rounded border bg-slate-50 px-2 py-1 text-xs text-foreground shadow-md"
              style={{
                ...computeTooltipStyle(),
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                ...tooltipStyle,
              }}
            >
              {value}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export default EllipsisTooltip;
