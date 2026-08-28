import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, placeholder as placeholderExt } from '@codemirror/view';
import { syntaxHighlighting } from '@codemirror/language';
import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { useThemeMode } from '../../theme';
import { zenLanguage, zenStyleDark, zenStyleLight, zenTemplateLanguage } from './extensions/zen';
import { ZEN_SKIN } from './theme';

/**
 * CellViewPool (roadmap P2 phase-2 revival, §3.6 design).
 *
 * Table-scope pool of read-only display EditorViews. Cells acquire on mount,
 * release on unmount; acquire re-parents `view.dom`, swaps the doc, and
 * reconfigures placeholder/highlight compartments — orders of magnitude
 * cheaper than creating an EditorView per visible cell on every scroll.
 *
 * Soft capacity: requests beyond the cap degrade to standalone create/destroy
 * (never a blank cell). No history, no editing: display only, so nothing
 * user-owned lives in a pooled view and cross-cell bleed is impossible.
 */

export type DisplayType = 'standard' | 'unary' | 'template';

type PooledView = {
  view: EditorView;
  ph: Compartment;
  hl: Compartment;
  bucket: DisplayType;
};

const languageFor = (type: DisplayType) => (type === 'template' ? zenTemplateLanguage : zenLanguage);

function createDisplayView(bucket: DisplayType, dark: boolean, placeholder?: string): PooledView {
  const ph = new Compartment();
  const hl = new Compartment();
  const view = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [
        // full skin: pooled display views must be pixel-identical to the live
        // editor they hand off to (content padding, line metrics, caret colors)
        ZEN_SKIN,
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        EditorView.lineWrapping,
        languageFor(bucket),
        hl.of(syntaxHighlighting(dark ? zenStyleDark : zenStyleLight)),
        ph.of(placeholder ? placeholderExt(placeholder) : []),
      ],
    }),
  });
  return { view, ph, hl, bucket };
}

const configure = (pv: PooledView, dark: boolean, placeholder?: string) => {
  pv.view.dispatch({
    effects: [
      pv.hl.reconfigure(syntaxHighlighting(dark ? zenStyleDark : zenStyleLight)),
      pv.ph.reconfigure(placeholder ? placeholderExt(placeholder) : []),
    ],
  });
};

const setDoc = (pv: PooledView, value: string) => {
  // full replacement: `to` is REQUIRED — omitting it turns the change into an
  // insert at 0 and pooled views accumulate previous cells' docs
  pv.view.dispatch({ changes: { from: 0, to: pv.view.state.doc.length, insert: value } });
};

class CellViewPoolImpl {
  private free = new Map<DisplayType, PooledView[]>();
  private live = 0;

  constructor(readonly capacity: number) {}

  get exhausted(): boolean {
    return this.live >= this.capacity;
  }

  acquire(bucket: DisplayType, dark: boolean, placeholder?: string): PooledView | null {
    if (this.exhausted) return null;
    const q = this.free.get(bucket);
    const reused = q?.pop();
    if (reused) {
      configure(reused, dark, placeholder);
      return reused;
    }
    this.live += 1;
    return createDisplayView(bucket, dark, placeholder);
  }

  release(pv: PooledView): void {
    pv.view.dispatch({
      changes: { from: 0, to: pv.view.state.doc.length, insert: '' },
      selection: { anchor: 0 },
    });
    pv.view.dom.remove();
    const q = this.free.get(pv.bucket) ?? [];
    q.push(pv);
    this.free.set(pv.bucket, q);
  }

  destroyAll(): void {
    for (const q of this.free.values()) {
      for (const pv of q) pv.view.destroy();
    }
    this.free.clear();
  }
}

const PoolContext = createContext<CellViewPoolImpl | null>(null);

export const CellViewPoolProvider: React.FC<React.PropsWithChildren<{ capacity?: number }>> = ({
  capacity = 64,
  children,
}) => {
  const pool = useMemo(() => new CellViewPoolImpl(capacity), [capacity]);
  useEffect(() => () => pool.destroyAll(), [pool]);
  return <PoolContext.Provider value={pool}>{children}</PoolContext.Provider>;
};

const usePool = (): CellViewPoolImpl | null => useContext(PoolContext);

/**
 * Attaches a recycled read-only display view to the returned host ref.
 * Falls back to standalone create/destroy when no provider is present or the
 * pool is exhausted.
 */
export const useRecycledEditorView = ({
  value,
  type,
  placeholder,
}: {
  value: string;
  type: DisplayType;
  placeholder?: string;
}): React.RefCallback<HTMLDivElement> => {
  const pool = usePool();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pvRef = useRef<PooledView | null>(null);
  const standaloneRef = useRef<EditorView | null>(null);
  const mode = useThemeMode();
  const dark = mode === 'dark';

  // mount: acquire or create; unmount: release or destroy
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const pooled = pool?.acquire(type, dark, placeholder);
    if (pooled) {
      pvRef.current = pooled;
      host.appendChild(pooled.view.dom);
      setDoc(pooled, value);
      pooled.view.requestMeasure();
    } else {
      const created = createDisplayView(type, dark, placeholder);
      pvRef.current = created;
      standaloneRef.current = created.view;
      host.appendChild(created.view.dom);
      created.view.dispatch({ changes: { from: 0, insert: value } });
      created.view.requestMeasure();
    }

    return () => {
      const pv = pvRef.current;
      if (!pv) return;
      if (standaloneRef.current === pv.view) {
        pv.view.destroy();
        standaloneRef.current = null;
      } else if (pool) {
        pool.release(pv);
      }
      pvRef.current = null;
    };
    // value remount contract matches the lazy highlighter path
    }, [value, type, dark, placeholder, pool]);

  // live reconfiguration while mounted (mode / placeholder)
  useLayoutEffect(() => {
    const pv = pvRef.current;
    if (!pv) return;
    pv.view.dispatch({
      effects: [
        pv.hl.reconfigure(syntaxHighlighting(dark ? zenStyleDark : zenStyleLight)),
        pv.ph.reconfigure(placeholder ? placeholderExt(placeholder) : []),
      ],
    });
  }, [dark, placeholder]);

  return React.useCallback((el: HTMLDivElement | null) => {
    hostRef.current = el;
  }, []);
};

