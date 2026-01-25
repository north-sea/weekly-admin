'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface HoverImagePreviewProps {
  imageUrl?: string;
  title: string;
  children: React.ReactNode;
  width?: number;
}

const HoverImagePreview: React.FC<HoverImagePreviewProps> = ({ imageUrl, title, children, width = 260 }) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

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

  const portalStyle = useMemo(() => {
    if (!rect || typeof window === 'undefined') return null;
    const spacing = 8;
    const previewWidth = width;
    const maxLeft = Math.max(8, window.innerWidth - previewWidth - 8);
    const safeLeft = Math.min(Math.max(8, rect.left), maxLeft);
    return {
      top: rect.bottom + spacing,
      left: safeLeft,
      width: previewWidth,
    };
  }, [rect, width]);

  if (!imageUrl) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex max-w-full items-center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open && portalStyle
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 overflow-hidden rounded-lg border bg-background shadow-xl"
              style={portalStyle}
            >
              <div className="relative aspect-video bg-muted">
                <img
                  src={imageUrl}
                  alt={title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="line-clamp-2 px-3 py-2 text-xs text-muted-foreground">
                {title}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export default HoverImagePreview;
