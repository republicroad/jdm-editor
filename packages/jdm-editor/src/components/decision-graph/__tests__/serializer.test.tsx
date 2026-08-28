import { act, cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type DecisionGraphSnapshot,
  SerializerProvider,
  type Slice,
  useGraphSerializer,
  useSerializerRegistry,
  useTabSerializer,
} from '../context/serializer.context';

type Registry = NonNullable<ReturnType<typeof useSerializerRegistry>>;

let registry: Registry | null = null;

const Probe: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  registry = useSerializerRegistry();
  return <>{children}</>;
};

const tree = (children: React.ReactNode = null) => (
  <SerializerProvider>
    <Probe>{children}</Probe>
  </SerializerProvider>
);

let view: ReturnType<typeof render>;

const mountTree = (children: React.ReactNode = null): Registry => {
  view = render(tree(children));
  if (!registry) {
    throw new Error('serializer registry was not captured');
  }
  return registry;
};

const rerenderTree = (children: React.ReactNode = null) => {
  act(() => {
    view.rerender(tree(children));
  });
};

afterEach(() => {
  cleanup();
  registry = null;
});

const makeSlice = (
  value: unknown,
  opts: { serializeError?: Error; restoreError?: Error; onRestore?: (state: unknown) => void } = {},
): Slice => ({
  serialize: () => {
    if (opts.serializeError) throw opts.serializeError;
    return value;
  },
  restore: (state) => {
    opts.onRestore?.(state);
    if (opts.restoreError) throw opts.restoreError;
  },
});

const GraphHost: React.FC<{ sk: string | null; slice: Slice }> = ({ sk, slice }) => {
  useGraphSerializer(sk, slice);
  return null;
};

const TabHost: React.FC<{ tabId: string | null; sk: string | null; slice: Slice }> = ({ tabId, sk, slice }) => {
  useTabSerializer(tabId, sk, slice);
  return null;
};

const HookedGraphHost: React.FC<{ sk: string | null }> = ({ sk }) => {
  useGraphSerializer(sk, makeSlice(sk ?? ''));
  return null;
};

const HookedTabHost: React.FC<{ tabId: string | null; sk: string | null }> = ({ tabId, sk }) => {
  useTabSerializer(tabId, sk, makeSlice(`${tabId}:${sk}`));
  return null;
};

describe('graph registration', () => {
  it('serializes registered graph slices under the graph key', () => {
    const reg = mountTree(<GraphHost sk='viewport' slice={makeSlice({ x: 10, y: 20 })} />);

    expect(reg.serialize()).toEqual({ graph: { viewport: { x: 10, y: 20 } } });
  });

  it('stops serializing a graph slice after its host unmounts', () => {
    const reg = mountTree(<GraphHost sk='viewport' slice={makeSlice(1)} />);

    expect(reg.serialize().graph).toEqual({ viewport: 1 });

    rerenderTree(null);

    expect(reg.serialize()).toEqual({});
  });

  it('keeps the newest slice when a stale dispose runs last', () => {
    const reg = mountTree(null);

    const disposeStale = reg.registerGraph('key', makeSlice('A'));
    reg.registerGraph('key', makeSlice('B'));

    disposeStale();

    expect(reg.serialize().graph).toEqual({ key: 'B' });
  });
});

describe('tab registration', () => {
  it('nests tab slices under their tab id and merges keys', () => {
    const reg = mountTree(
      <>
        <TabHost tabId='table' sk='order' slice={makeSlice(['a'])} />
        <TabHost tabId='table' sk='filters' slice={makeSlice({ enabled: true })} />
        <TabHost tabId='graph' sk='zoom' slice={makeSlice(3)} />
      </>,
    );

    expect(reg.serialize().tabs).toEqual({
      table: { order: ['a'], filters: { enabled: true } },
      graph: { zoom: 3 },
    });
  });

  it('removes an empty tab bag after its last slice unmounts', () => {
    const reg = mountTree(<TabHost tabId='table' sk='order' slice={makeSlice(['a'])} />);

    expect(reg.serialize().tabs).toEqual({ table: { order: ['a'] } });

    rerenderTree(null);

    expect(reg.serialize()).toEqual({});
  });

  it('keeps the newest tab slice when a stale dispose runs last', () => {
    const reg = mountTree(null);

    const disposeStale = reg.registerTab('table', 'key', makeSlice('A'));
    reg.registerTab('table', 'key', makeSlice('B'));

    disposeStale();

    expect(reg.serialize().tabs).toEqual({ table: { key: 'B' } });
  });
});

describe('pending buffer', () => {
  it('buffers graph state until a matching slice registers', () => {
    const reg = mountTree(null);
    const restored: unknown[] = [];

    act(() => reg.restore({ graph: { zoom: 7 } }));
    expect(reg.serialize()).toEqual({});

    rerenderTree(<GraphHost sk='zoom' slice={makeSlice(0, { onRestore: (v) => restored.push(v) })} />);

    expect(restored).toEqual([7]);
  });

  it('consumes buffered values exactly once across remounts', () => {
    const reg = mountTree(null);
    const restored: unknown[] = [];

    act(() => reg.restore({ graph: { zoom: 7 } }));

    const host = <GraphHost sk='zoom' slice={makeSlice(0, { onRestore: (v) => restored.push(v) })} />;
    rerenderTree(host);
    rerenderTree(null);
    rerenderTree(host);

    expect(restored).toEqual([7]);
  });

  it('buffers tab state until a matching tab slice registers', () => {
    const reg = mountTree(null);
    const restored: unknown[] = [];

    act(() => reg.restore({ tabs: { table: { order: ['b'] } } }));

    rerenderTree(<TabHost tabId='table' sk='order' slice={makeSlice([], { onRestore: (v) => restored.push(v) })} />);

    expect(restored).toEqual([['b']]);
  });
});

describe('snapshot filtering', () => {
  it('skips slices whose serialized value is undefined', () => {
    const reg = mountTree(
      <>
        <GraphHost sk='empty' slice={makeSlice(undefined)} />
        <GraphHost sk='kept' slice={makeSlice(1)} />
      </>,
    );

    expect(reg.serialize()).toEqual({ graph: { kept: 1 } });
  });

  it('returns an empty snapshot when nothing is registered', () => {
    const reg = mountTree(null);

    expect(reg.serialize()).toEqual({});
  });

  it('tolerates missing or malformed snapshots', () => {
    const reg = mountTree(null);

    act(() => {
      reg.restore(undefined as unknown as DecisionGraphSnapshot);
      reg.restore({});
      reg.restore({ tabs: { table: null as unknown as Record<string, unknown> } });
    });

    expect(reg.serialize()).toEqual({});
  });
});

describe('error isolation', () => {
  it('warns and continues when a slice fails to serialize', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const reg = mountTree(
        <>
          <GraphHost sk='bad' slice={makeSlice('x', { serializeError: new Error('serialize boom') })} />
          <GraphHost sk='good' slice={makeSlice('ok')} />
        </>,
      );

      expect(reg.serialize()).toEqual({ graph: { good: 'ok' } });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('graph.bad'), expect.any(Error));
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('warns per slice on restore failures without dropping other restores', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const badRestored: unknown[] = [];
      const goodRestored: unknown[] = [];
      const reg = mountTree(
        <>
          <GraphHost
            sk='bad'
            slice={makeSlice('', { restoreError: new Error('restore boom'), onRestore: (v) => badRestored.push(v) })}
          />
          <GraphHost sk='good' slice={makeSlice('', { onRestore: (v) => goodRestored.push(v) })} />
        </>,
      );

      act(() => reg.restore({ graph: { bad: 'b', good: 'g' } }));

      expect(badRestored).toEqual(['b']);
      expect(goodRestored).toEqual(['g']);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('graph.bad'), expect.any(Error));
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('warns when consuming buffered state fails for the registering slice', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const reg = mountTree(null);

      act(() => reg.restore({ graph: { bad: 'x' } }));
      rerenderTree(<GraphHost sk='bad' slice={makeSlice('', { restoreError: new Error('late boom') })} />);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('graph.bad'), expect.any(Error));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('serializer hooks', () => {
  it('re-registers graph hooks when the serialization key changes', () => {
    const reg = mountTree(<HookedGraphHost sk='alpha' />);

    expect(reg.serialize().graph).toEqual({ alpha: 'alpha' });

    rerenderTree(<HookedGraphHost sk='beta' />);

    expect(reg.serialize().graph).toEqual({ beta: 'beta' });
  });

  it('skips graph registration when the hook key is null', () => {
    const reg = mountTree(<HookedGraphHost sk={null} />);

    expect(reg.serialize()).toEqual({});
  });

  it('moves tab hook registration when the tab id changes', () => {
    const reg = mountTree(<HookedTabHost tabId='one' sk='state' />);

    expect(reg.serialize().tabs).toEqual({ one: { state: 'one:state' } });

    rerenderTree(<HookedTabHost tabId='two' sk='state' />);

    expect(reg.serialize().tabs).toEqual({ two: { state: 'two:state' } });
  });

  it('skips tab registration when the tab id or key is null', () => {
    const reg = mountTree(<HookedTabHost tabId={null} sk='state' />);

    rerenderTree(<HookedTabHost tabId='one' sk={null} />);

    expect(reg.serialize()).toEqual({});
  });
});
