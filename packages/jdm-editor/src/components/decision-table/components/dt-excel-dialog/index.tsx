import { DeleteOutlined, EditOutlined, LeftOutlined, PlusOutlined } from '#icons';
import { DataGrid, DataGridContainer, type DataGridFeatures, dataGridFeatures } from '#reui/data-grid/data-grid';
import { DataGridTableDndRowHandle, DataGridTableDndRows } from '#reui/data-grid/data-grid-table-dnd-rows';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { ColumnDef } from '@tanstack/react-table';
import { useTable } from '@tanstack/react-table';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { ColumnFieldType, OutputFieldType } from '../../../../helpers/schema';
import { useT } from '../../../../theming/i18n';
import { Button, Checkbox, Modal, Popconfirm, Select, Switch, Tooltip, Typography } from '../../../primitives';
import { ExcelPreviewGrid } from '../../../shared/excel-preview-grid';
import { useDecisionTableDialog } from '../../context/dt-dialog.context';
import { useDecisionTableState } from '../../context/dt-store.context';
import { InputFieldEdit } from '../input-field-edit';
import { OutputFieldEdit } from '../output-field-edit';
import { assembleMappedData, buildImportColumns } from './mapping';
import type { DtExcelDialogProps, ImportColumn } from './types';

export type { MappedExcelData } from './types';

/** WS2-B2：映射行进 data-grid（行拖拽/启用开关/逐行控制均为单元格渲染） */
const MappingGrid: React.FC<{
  section: 'input' | 'output';
  rows: ImportColumn[];
  excelHeaders: { id: string; name?: string; value?: string }[];
  disabledColumns: Record<string, boolean>;
  wrapStates: Record<string, boolean>;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggle: (colId: string, enabled: boolean) => void;
  onExcelHeaderChange: (colId: string, excelHeaderId: string | undefined) => void;
  onWrapChange: (colId: string, checked: boolean) => void;
  onFieldChange: (colId: string, field: string, fieldType?: ColumnFieldType, outputFieldType?: OutputFieldType) => void;
  onRemove: (colId: string) => void;
  emptyMessage: string;
}> = ({
  section,
  rows,
  excelHeaders,
  disabledColumns,
  wrapStates,
  onReorder,
  onToggle,
  onExcelHeaderChange,
  onWrapChange,
  onFieldChange,
  onRemove,
  emptyMessage,
}) => {
  const t = useT();

  const columns = useMemo<ColumnDef<DataGridFeatures, ImportColumn>[]>(
    () => [
      {
        id: 'enabled',
        cell: ({ row }) => (
          <Switch
            size='small'
            checked={!disabledColumns[row.original.id]}
            onChange={(enabled) => onToggle(row.original.id, enabled)}
            style={{ minWidth: 28 }}
          />
        ),
        size: 40,
      },
      {
        id: 'drag',
        cell: ({ row }) => <DataGridTableDndRowHandle disabled={!!disabledColumns[row.original.id]} />,
        size: 36,
      },
      {
        id: 'tableColumn',
        header: 'Table column',
        cell: ({ row }) => (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 36,
              opacity: disabledColumns[row.original.id] ? 0.4 : 1,
            }}
          >
            <Typography.Text style={{ fontSize: 13, lineHeight: '18px' }}>{row.original.name}</Typography.Text>
            {row.original.field && (
              <Typography.Text type='secondary' style={{ fontSize: 11, lineHeight: '14px' }}>
                {row.original.field}
              </Typography.Text>
            )}
          </div>
        ),
        size: 180,
      },
      {
        id: 'excelColumn',
        header: 'Excel column',
        cell: ({ row }) => (
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder={t('dt.table.selectExcelColumn')}
            value={row.original.excelHeaderId}
            disabled={!!disabledColumns[row.original.id]}
            onChange={(val) => onExcelHeaderChange(row.original.id, val ?? undefined)}
            options={excelHeaders.map((h) => ({
              label: h.name || h.value || h.id,
              value: h.id,
            }))}
          />
        ),
        size: 220,
      },
      {
        id: 'wrap',
        cell: ({ row }) => (
          <Tooltip title={t('dt.field.wrapQuotes')}>
            <Checkbox
              disabled={!!disabledColumns[row.original.id]}
              checked={wrapStates[row.original.id] || false}
              onChange={(e) => onWrapChange(row.original.id, e.target.checked)}
            />
          </Tooltip>
        ),
        size: 40,
      },
      {
        id: 'field',
        cell: ({ row }) => {
          const editTrigger = (
            <Tooltip title={t('dt.field.editColumn')}>
              <Button type='text' size='small' icon={<EditOutlined />} style={{ padding: 0 }} />
            </Tooltip>
          );
          return section === 'input' ? (
            <InputFieldEdit
              mode='edit'
              value={row.original.field}
              fieldType={row.original.fieldType}
              onChange={(field, fieldType) => onFieldChange(row.original.id, field, fieldType)}
              onRemove={() => onRemove(row.original.id)}
              trigger={editTrigger}
            />
          ) : (
            <OutputFieldEdit
              mode='edit'
              value={row.original.field}
              fieldType={row.original.outputFieldType}
              onChange={(field, outputFieldType) => onFieldChange(row.original.id, field, undefined, outputFieldType)}
              onRemove={() => onRemove(row.original.id)}
              trigger={editTrigger}
            />
          );
        },
        size: 40,
      },
      {
        id: 'remove',
        cell: ({ row }) => (
          <Popconfirm
            title={t('dt.field.removeConfirm')}
            okText={t('common.remove')}
            onConfirm={() => onRemove(row.original.id)}
          >
            <Tooltip title={t('dt.field.removeColumn')}>
              <Button type='text' size='small' danger icon={<DeleteOutlined />} style={{ padding: 0 }} />
            </Tooltip>
          </Popconfirm>
        ),
        size: 40,
      },
    ],
    [
      section,
      excelHeaders,
      disabledColumns,
      wrapStates,
      t,
      onToggle,
      onExcelHeaderChange,
      onWrapChange,
      onFieldChange,
      onRemove,
    ],
  );

  const dataIds = useMemo(() => rows.map(({ id }) => id), [rows]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
        const from = dataIds.indexOf(String(active.id));
        const to = dataIds.indexOf(String(over.id));
        if (from >= 0 && to >= 0) {
          onReorder(from, to);
        }
      }
    },
    [dataIds, onReorder],
  );

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    getRowId: (row: ImportColumn) => row.id,
  });

  return (
    <DataGrid table={table} recordCount={rows.length} emptyMessage={emptyMessage} tableLayout={{ rowsDraggable: true }}>
      <DataGridContainer className='rounded-lg border border-[var(--border)]'>
        <DataGridTableDndRows handleDragEnd={handleDragEnd} dataIds={dataIds} />
      </DataGridContainer>
    </DataGrid>
  );
};

export const DtExcelDialog: React.FC<DtExcelDialogProps> = ({ excelData, handleSuccess, handleCancel }) => {
  const t = useT();
  const spreadSheetData = useMemo(() => excelData?.[0], [excelData]);
  const { getContainer } = useDecisionTableDialog();
  const { inputVariableType } = useDecisionTableState(({ inputVariableType }) => ({ inputVariableType }));

  const [columns, setColumns] = useState<ImportColumn[]>([]);
  const [disabledColumns, setDisabledColumns] = useState<Record<string, boolean>>({});
  const [wrapStates, setWrapStates] = useState<Record<string, boolean>>({});
  const [descriptionExcelId, setDescriptionExcelId] = useState<string | undefined>();
  const [descriptionEnabled, setDescriptionEnabled] = useState(true);

  useEffect(() => {
    if (!spreadSheetData) {
      setColumns([]);
      setDisabledColumns({});
      setWrapStates({});
      setDescriptionExcelId(undefined);
      setDescriptionEnabled(true);
      return;
    }

    setColumns(buildImportColumns(spreadSheetData));

    // Auto-match _description
    const descHeader = spreadSheetData.headers.find((h) => h.id === '_description');
    setDescriptionExcelId(descHeader?.id);
    setDescriptionEnabled(!!descHeader);
  }, [spreadSheetData]);

  const excelHeaders = useMemo(() => {
    if (!spreadSheetData) return [];
    return spreadSheetData.headers.filter((h) => h.id !== '_description' && h.id !== '_id');
  }, [spreadSheetData]);

  const inputColumns = useMemo(() => columns.filter((c) => c.type === 'input'), [columns]);
  const outputColumns = useMemo(() => columns.filter((c) => c.type === 'output'), [columns]);

  const enabledColumns = useMemo(() => columns.filter((c) => !disabledColumns[c.id]), [columns, disabledColumns]);
  const hasEnabledOutput = useMemo(() => enabledColumns.some((c) => c.type === 'output'), [enabledColumns]);
  const isOkDisabled = enabledColumns.length === 0 || !hasEnabledOutput;

  /**
   * Section 内重排：保持另一 type 的列在主数组中的位置不动，
   * 仅按新顺序回填本 type 原占用的槽位（assembleMappedData 依赖主数组序）。
   */
  const reorderSection = useCallback((section: 'input' | 'output', fromIndex: number, toIndex: number) => {
    setColumns((prev) => {
      const sectionCols = prev.filter((c) => c.type === section);
      const reordered = arrayMove(sectionCols, fromIndex, toIndex);
      let k = 0;
      return prev.map((c) => (c.type === section ? reordered[k++] : c));
    });
  }, []);

  const handleFieldChange = useCallback(
    (colId: string, field: string, fieldType?: ColumnFieldType, outputFieldType?: OutputFieldType) => {
      setColumns((prev) =>
        prev.map((c) => {
          if (c.id !== colId) return c;
          return {
            ...c,
            field: field || c.field,
            ...(fieldType !== undefined ? { fieldType } : {}),
            ...(outputFieldType !== undefined ? { outputFieldType } : {}),
          };
        }),
      );
    },
    [],
  );

  const handleRemoveColumn = useCallback((colId: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== colId));
    setDisabledColumns((prev) => {
      const updated = { ...prev };
      delete updated[colId];
      return updated;
    });
    setWrapStates((prev) => {
      const updated = { ...prev };
      delete updated[colId];
      return updated;
    });
  }, []);

  const handleAddInput = useCallback(
    (name: string, field: string, fieldType?: ColumnFieldType) => {
      const newCol: ImportColumn = {
        id: crypto.randomUUID(),
        name,
        field,
        type: 'input',
        fieldType,
      };
      // Auto-match unmatched Excel header
      const usedExcelIds = new Set(columns.map((c) => c.excelHeaderId).filter(Boolean));
      const unmatchedExcel = excelHeaders.find((eh) => {
        if (usedExcelIds.has(eh.id)) return false;
        const ehLabel = (eh.name || eh.value || '').toLowerCase();
        return ehLabel === name.toLowerCase() || ehLabel === field.toLowerCase();
      });
      if (unmatchedExcel) {
        newCol.excelHeaderId = unmatchedExcel.id;
      }
      setColumns((prev) => [...prev, newCol]);
    },
    [columns, excelHeaders],
  );

  const handleAddOutput = useCallback(
    (name: string, field: string, outputFieldType?: OutputFieldType) => {
      const newCol: ImportColumn = {
        id: crypto.randomUUID(),
        name,
        field,
        type: 'output',
        outputFieldType,
      };
      // Auto-match unmatched Excel header
      const usedExcelIds = new Set(columns.map((c) => c.excelHeaderId).filter(Boolean));
      const unmatchedExcel = excelHeaders.find((eh) => {
        if (usedExcelIds.has(eh.id)) return false;
        const ehLabel = (eh.name || eh.value || '').toLowerCase();
        return ehLabel === name.toLowerCase() || ehLabel === field.toLowerCase();
      });
      if (unmatchedExcel) {
        newCol.excelHeaderId = unmatchedExcel.id;
      }
      setColumns((prev) => [...prev, newCol]);
    },
    [columns, excelHeaders],
  );

  const onOk = useCallback(() => {
    if (!spreadSheetData) return;

    handleSuccess(
      assembleMappedData({
        spreadSheetData,
        columns,
        disabledColumns,
        wrapStates,
        descriptionExcelId,
        descriptionEnabled,
      }),
    );
  }, [spreadSheetData, columns, disabledColumns, wrapStates, descriptionEnabled, descriptionExcelId, handleSuccess]);

  const addInputTrigger = (
    <Button type='text' size='small' icon={<PlusOutlined />}>
      Add Input
    </Button>
  );

  const addOutputTrigger = (
    <Button type='text' size='small' icon={<PlusOutlined />}>
      Add Output
    </Button>
  );

  return (
    <Modal
      title='Map Excel data'
      closable={{ 'aria-label': 'Custom Close Button' }}
      centered
      open={!!spreadSheetData}
      okButtonProps={{ disabled: isOkDisabled }}
      onOk={onOk}
      onCancel={handleCancel}
      destroyOnClose
      width={900}
      getContainer={getContainer}
    >
      <div style={{ padding: '8px 0' }}>
        {/* Inputs Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            Inputs
          </Typography.Text>
          <InputFieldEdit
            mode='create'
            variableType={inputVariableType}
            onCreate={handleAddInput}
            trigger={addInputTrigger}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <MappingGrid
            section='input'
            rows={inputColumns}
            excelHeaders={excelHeaders}
            disabledColumns={disabledColumns}
            wrapStates={wrapStates}
            onReorder={(from, to) => reorderSection('input', from, to)}
            onToggle={(colId, enabled) => {
              setDisabledColumns((prev) => {
                const updated = { ...prev };
                if (enabled) {
                  delete updated[colId];
                } else {
                  updated[colId] = true;
                }
                return updated;
              });
            }}
            onExcelHeaderChange={(colId, excelHeaderId) => {
              setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, excelHeaderId } : c)));
            }}
            onWrapChange={(colId, checked) => {
              setWrapStates((prev) => ({ ...prev, [colId]: checked }));
            }}
            onFieldChange={handleFieldChange}
            onRemove={handleRemoveColumn}
            emptyMessage='No input columns'
          />
        </div>

        {/* Outputs Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            Outputs
          </Typography.Text>
          <OutputFieldEdit mode='create' onCreate={handleAddOutput} trigger={addOutputTrigger} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <MappingGrid
            section='output'
            rows={outputColumns}
            excelHeaders={excelHeaders}
            disabledColumns={disabledColumns}
            wrapStates={wrapStates}
            onReorder={(from, to) => reorderSection('output', from, to)}
            onToggle={(colId, enabled) => {
              setDisabledColumns((prev) => {
                const updated = { ...prev };
                if (enabled) {
                  delete updated[colId];
                } else {
                  updated[colId] = true;
                }
                return updated;
              });
            }}
            onExcelHeaderChange={(colId, excelHeaderId) => {
              setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, excelHeaderId } : c)));
            }}
            onWrapChange={(colId, checked) => {
              setWrapStates((prev) => ({ ...prev, [colId]: checked }));
            }}
            onFieldChange={handleFieldChange}
            onRemove={handleRemoveColumn}
            emptyMessage='No output columns'
          />
        </div>

        {/* Description Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            Description
          </Typography.Text>
        </div>
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '36px 24px 1fr',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <Switch
              size='small'
              checked={descriptionEnabled}
              onChange={setDescriptionEnabled}
              style={{ minWidth: 28 }}
            />
            <LeftOutlined style={{ fontSize: 12, color: 'var(--primary)' }} />
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder={t('dt.table.selectDescription')}
              value={descriptionExcelId}
              disabled={!descriptionEnabled}
              onChange={(val) => setDescriptionExcelId(val ?? undefined)}
              options={excelHeaders.map((h) => ({
                label: h.name || h.value || h.id,
                value: h.id,
              }))}
            />
          </div>
        </div>

        {/* Preview Section — WS2-B3：映射前先看到实际数据行 */}
        {spreadSheetData && (
          <>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}
            >
              <Typography.Text strong style={{ fontSize: 13 }}>
                Preview
              </Typography.Text>
            </div>
            <ExcelPreviewGrid sheet={spreadSheetData} />
          </>
        )}
      </div>
    </Modal>
  );
};
