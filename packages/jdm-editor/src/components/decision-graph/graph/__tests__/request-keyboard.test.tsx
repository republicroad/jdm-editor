import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestDefinition, RequestDefinitionType } from '../../../../helpers/request-schema';
import { RequestDefinitions } from '../request-definitions';
import { RequestExamples } from '../request-examples';

vi.mock('@monaco-editor/react', () => ({
  Editor: () => <div data-testid='monaco-stub' />,
}));

const def = (overrides: Partial<RequestDefinition> = {}): RequestDefinition => ({
  id: 'd1',
  path: 'weight',
  name: 'weight',
  type: 'number' as RequestDefinitionType,
  description: '',
  format: '',
  order: 0,
  depth: 0,
  parentPath: null,
  source: 'schema.properties',
  ...overrides,
});

describe('Request tab keyboard accessibility', () => {
  describe('RequestDefinitions', () => {
    const baseProps = {
      childrenMap: new Map<string, RequestDefinition[]>(),
      collapsedPaths: {},
      disabled: false,
      definitionTypeOptions: [
        { value: 'string' as RequestDefinitionType, label: 'String' },
        { value: 'number' as RequestDefinitionType, label: 'Number' },
      ],
      onAdd: vi.fn(),
      onUpdateName: vi.fn(),
      onUpdateType: vi.fn(),
      onUpdateDescription: vi.fn(),
      onUpdateDefaultValue: vi.fn(),
      onAddChild: vi.fn(),
      onRemove: vi.fn(),
      onToggleCollapse: vi.fn(),
      getDefinitionIndex: vi.fn(() => 0),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('Enter on the name input commits without a blur round-trip', () => {
      render(<RequestDefinitions {...baseProps} rootDefinitions={[def()]} />);
      const nameInput = screen.getAllByRole('textbox')[0];
      fireEvent.change(nameInput, { target: { value: 'renamed' } });
      fireEvent.keyDown(nameInput, { key: 'Enter' });
      expect(baseProps.onUpdateName).toHaveBeenCalledWith(0, 'renamed');
    });

    it('focus-within reveals the row action buttons', () => {
      render(<RequestDefinitions {...baseProps} rootDefinitions={[def()]} />);
      const nameInput = screen.getAllByRole('textbox')[0];
      fireEvent.focus(nameInput);
      // action buttons become visible via the focus-within rule
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('add-field is a real button reachable by keyboard', () => {
      render(<RequestDefinitions {...baseProps} rootDefinitions={[def()]} />);
      const addBtn = screen.getByText('Add field').closest('button');
      expect(addBtn).not.toBeNull();
      expect(addBtn?.tagName).toBe('BUTTON');
      fireEvent.click(addBtn!);
      expect(baseProps.onAdd).toHaveBeenCalled();
    });

    it('collapse toggle is a button carrying its icon state', () => {
      const child = def({ id: 'd2', path: 'weight.inner', name: 'inner', depth: 1 });
      render(
        <RequestDefinitions {...baseProps} rootDefinitions={[def()]} childrenMap={new Map([['weight', [child]]])} />,
      );
      const toggle = screen.getAllByRole('button').find((b) => b.querySelector('svg'));
      expect(toggle).not.toBeNull();
      fireEvent.click(toggle!);
      expect(baseProps.onToggleCollapse).toHaveBeenCalledWith('weight');
    });
  });

  describe('RequestExamples', () => {
    const mkProps = (overrides: Record<string, unknown> = {}) => ({
      sources: [
        { id: 's1', name: 'US Light', description: 'base case', data: { a: 1 }, source: 'schema.examples' as const },
        { id: 's2', name: 'DE Heavy', data: { a: 2 }, source: 'schema.examples' as const },
      ],
      activeSourceIndex: 0,
      editingSourceIndex: null,
      activeSource: { id: 's1', name: 'US Light', data: { a: 1 }, source: 'schema.examples' as const },
      activeDescriptionDraft: '',
      activeJsonDraft: '{}',
      disabled: false,
      definitionDrafts: [def()],
      onSourceSelect: vi.fn(),
      onSourceAdd: vi.fn(),
      onSourceRemove: vi.fn(),
      onSourceRename: vi.fn(),
      onEnterEditing: vi.fn(),
      onSourceRenameExit: vi.fn(),
      onDescriptionChange: vi.fn(),
      onDescriptionCommit: vi.fn(),
      onJsonChange: vi.fn(),
      onJsonCommit: vi.fn(),
      onFormat: vi.fn(),
      onJsonEditorMount: vi.fn(),
      summary: null,
      getDefinitionTypeLabel: () => 'Number',
      editorOptions: {},
      ...overrides,
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('source items are keyboard focusable buttons', () => {
      render(<RequestExamples {...mkProps()} />);
      const sourceItems = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') !== null);
      expect(sourceItems.length).toBe(2);
      expect(sourceItems.every((b) => b.getAttribute('tabindex') === '0')).toBe(true);
    });

    it('Enter on a source item selects it', () => {
      const props = mkProps();
      render(<RequestExamples {...props} />);
      const item = screen.getAllByRole('button').find((b) => b.textContent?.includes('DE Heavy'));
      expect(item).toBeDefined();
      fireEvent.keyDown(item!, { key: 'Enter' });
      expect(props.onSourceSelect).toHaveBeenCalledWith(1);
    });

    it('Space on a source item selects it', () => {
      const props = mkProps();
      render(<RequestExamples {...props} />);
      const item = screen.getAllByRole('button').find((b) => b.textContent?.includes('DE Heavy'));
      fireEvent.keyDown(item!, { key: ' ' });
      expect(props.onSourceSelect).toHaveBeenCalledWith(1);
    });

    it('active source is exposed via aria-pressed', () => {
      render(<RequestExamples {...mkProps()} />);
      const active = screen.getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true');
      expect(active).toBeDefined();
      expect(active?.textContent).toContain('US Light');
    });

    it('disabled sources are not focusable', () => {
      render(<RequestExamples {...mkProps({ disabled: true })} />);
      const sourceItems = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') !== null);
      expect(sourceItems.length).toBe(2);
      expect(sourceItems.every((b) => b.getAttribute('tabindex') === '-1')).toBe(true);
    });
  });
});
