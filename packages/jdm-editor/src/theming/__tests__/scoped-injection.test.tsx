import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { JdmConfigProvider } from '../../theme';

const Probe = () => <div data-testid='probe'>ok</div>;

afterEach(() => {
  // jsdom documentElement is shared across tests — clean the dataset
  delete document.documentElement.dataset.mode;
});

describe('JdmConfigProvider scoped injection (P3)', () => {
  it('LEGACY: no .seal-root ancestor → :root style tag + documentElement data-mode', () => {
    render(
      <JdmConfigProvider>
        <Probe />
      </JdmConfigProvider>,
    );
    expect(document.documentElement.dataset.mode).toBe('light');
    const styles = [...document.querySelectorAll('style')].filter((s) =>
      (s.textContent || '').includes('--seal-color-primary'),
    );
    expect(styles.length).toBeGreaterThan(0);
    expect(styles[0].textContent).toContain('#1677ff');
  });

  it('SCOPED: .seal-root ancestor → inline vars + data-mode on the island', () => {
    const island = document.createElement('div');
    island.className = 'seal-root';
    document.body.appendChild(island);

    const { getByTestId } = render(
      <div className='seal-root'>
        <JdmConfigProvider>
          <Probe />
        </JdmConfigProvider>
      </div>,
    );

    expect(getByTestId('probe')).toBeInTheDocument();
    expect(document.documentElement.dataset.mode).toBeUndefined();

    const islands = [...document.querySelectorAll<HTMLElement>('.seal-root')];
    const scoped = islands.find((el) => el.style.getPropertyValue('--seal-color-primary') !== '');
    expect(scoped).toBeTruthy();
    expect(scoped!.style.getPropertyValue('--seal-color-primary')).toBe('#1677ff');
    expect(scoped!.dataset.mode).toBe('light');
    // text-color scoping: dark-mode inputs inherit a visible color (P3 followup)
    expect(scoped!.style.getPropertyValue('color')).toBe('var(--foreground)');

    island.remove();
  });
});
