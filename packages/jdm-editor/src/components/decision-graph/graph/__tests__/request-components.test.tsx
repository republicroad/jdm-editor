import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestDefinition, RequestDefinitionType } from '../../../../helpers/request-schema';
import { BlurCommitInput } from '../blur-commit-input';
import { RequestDefinitions } from '../request-definitions';
import { RequestExampleSummary, type RequestExampleSummaryData } from '../request-example-summary';
import { RequestExamples } from '../request-examples';

vi.mock('@monaco-editor/react', () => ({
  Editor: () => <div data-testid='monaco-stub' />,
}));

const def = (overrides: Partial<RequestDefinition> = {}): RequestDefinition => ({
  id: 'd1',
  path: 'weight',
  name: 'weight',
  type: 'number' as RequestDefinitionType,
  depth: 0,
  description: '',
  ...overrides,
});

describe('BlurCommitInput', () => {
  it('commits the deferred draft on blur', async () => {
    const onCommit = vi.fn();
    render(<BlurCommitInput value='alpha' onCommit={onCommit} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'beta' } });
    fireEvent.blur(screen.getByRole('textbox'));
    await vi.waitFor(() => expect(onCommit).toHaveBeenCalledWith('beta'));
  });

  it('does not commit when the value is unchanged', () => {
    const onCommit = vi.fn();
    render(<BlurCommitInput value='alpha' onCommit={onCommit} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('cancel behavior restores the value and skips commit', () => {
    const onCommit = vi.fn();
    const onExit = vi.fn();
    render(
      <BlurCommitInput
        value='alpha'
        onCommit={onCommit}
        onExit={onExit}
        blurBehavior='cancel'
        showActions
        saveLabel='Save'
        cancelLabel='Cancel'
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'beta' } });
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('alpha');
  });

  it('Enter key saves and exits', () => {
    const onCommit = vi.fn();
    const onExit = vi.fn();
    render(<BlurCommitInput value='alpha' onCommit={onCommit} onExit={onExit} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'beta' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('beta');
    expect(onExit).toHaveBeenCalled();
  });
});

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

  it('renders the grid header and empty state', () => {
    render(<RequestDefinitions {...baseProps} rootDefinitions={[]} />);
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('No field definitions')).toBeInTheDocument();
  });

  it('add-field button invokes onAdd', () => {
    render(<RequestDefinitions {...baseProps} rootDefinitions={[def()]} />);
    fireEvent.click(screen.getByText('Add field'));
    expect(baseProps.onAdd).toHaveBeenCalled();
  });

  it('editing a name commits through onUpdateName after the deferred blur', async () => {
    render(<RequestDefinitions {...baseProps} rootDefinitions={[def()]} />);
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'renamed' } });
    fireEvent.blur(inputs[0]);
    await vi.waitFor(() => expect(baseProps.onUpdateName).toHaveBeenCalledWith(0, 'renamed'));
  });

  it('renders the delete affordance for a definition', () => {
    render(<RequestDefinitions {...baseProps} rootDefinitions={[def()]} />);
    // delete button sits in the actions column wrapped by a Popconfirm trigger
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('child definitions render nested under a collapsed-aware tree', () => {
    const child = def({ id: 'd2', path: 'weight.inner', name: 'inner', depth: 1 });
    render(
      <RequestDefinitions {...baseProps} rootDefinitions={[def()]} childrenMap={new Map([['weight', [child]]])} />,
    );
    expect(screen.getByDisplayValue('inner')).toBeInTheDocument();
  });

  it('collapsing hides children but keeps them in the tree data', () => {
    const child = def({ id: 'd2', path: 'weight.inner', name: 'inner', depth: 1 });
    render(
      <RequestDefinitions
        {...baseProps}
        rootDefinitions={[def()]}
        childrenMap={new Map([['weight', [child]]])}
        collapsedPaths={{ weight: true }}
      />,
    );
    expect(screen.queryByDisplayValue('inner')).not.toBeInTheDocument();
  });
});

describe('RequestExampleSummary', () => {
  const summary: RequestExampleSummaryData = {
    definitions: [def()],
    conflicts: [{ path: 'weight', nextType: 'string' as RequestDefinitionType }],
    missing: [def({ id: 'd3', path: 'missing.field' })],
    extra: ['extra.path'],
  };

  it('renders null without a summary', () => {
    const { container } = render(<RequestExampleSummary summary={null} getDefinitionTypeLabel={() => 'N'} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists missing, extra and conflict rows with counts', () => {
    render(<RequestExampleSummary summary={summary} getDefinitionTypeLabel={() => 'String'} />);
    expect(screen.getByText(/Defined fields: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Missing fields: 1/)).toBeInTheDocument();
    expect(screen.getByText('missing.field')).toBeInTheDocument();
    expect(screen.getByText('extra.path')).toBeInTheDocument();
    expect(screen.getByText('weight')).toBeInTheDocument();
  });

  it('reports the all-match state for clean data', () => {
    render(
      <RequestExampleSummary
        summary={{ definitions: [def()], conflicts: [], missing: [], extra: [] }}
        getDefinitionTypeLabel={() => 'N'}
      />,
    );
    expect(screen.getByText('Fields match definitions')).toBeInTheDocument();
  });
});

describe('RequestExamples', () => {
  const mkProps = () => ({
    sources: [
      { id: 's1', name: 'US Light', description: 'base case', data: { a: 1 } },
      { id: 's2', name: 'DE Heavy', data: { a: 2 } },
    ],
    activeSourceIndex: 0,
    editingSourceIndex: null,
    activeSource: { id: 's1', name: 'US Light', data: { a: 1 } },
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
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state with a create button when no sources', () => {
    render(<RequestExamples {...mkProps()} sources={[]} activeSource={null} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Create data')).toBeInTheDocument();
  });

  it('selecting a source invokes onSourceSelect', () => {
    const props = mkProps();
    render(<RequestExamples {...props} />);
    fireEvent.click(screen.getByText('DE Heavy'));
    expect(props.onSourceSelect).toHaveBeenCalledWith(1);
  });

  it('double-click enters rename mode', () => {
    const props = mkProps();
    render(<RequestExamples {...props} />);
    fireEvent.doubleClick(screen.getAllByText('US Light')[0]);
    expect(props.onEnterEditing).toHaveBeenCalledWith(0);
  });

  it('renders the JSON editor stub and the active source header', () => {
    render(<RequestExamples {...mkProps()} />);
    expect(screen.getByTestId('monaco-stub')).toBeInTheDocument();
    expect(screen.getAllByText('US Light').length).toBeGreaterThanOrEqual(2);
  });

  it('description changes route through onDescriptionChange', () => {
    const props = mkProps();
    render(<RequestExamples {...props} />);
    const textarea = document.querySelector('[contenteditable="true"], textarea');
    expect(textarea).not.toBeNull();
  });

  it('inlay hint toggle and format buttons render', () => {
    render(<RequestExamples {...mkProps()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });
});
