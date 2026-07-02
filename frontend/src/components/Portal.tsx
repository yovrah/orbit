import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Renders children into document.body. Home sheets live inside the animated
 * `.content-stage`, whose framer-motion transform makes `position: fixed`
 * resolve against that element instead of the viewport — so a fixed overlay
 * gets clipped by the stage (cut off at the top, hidden behind the nav bar).
 * Portaling to <body> escapes the transformed ancestor. */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
