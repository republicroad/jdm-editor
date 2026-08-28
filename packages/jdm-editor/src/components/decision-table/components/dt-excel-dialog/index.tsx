import { LeftOutlined, PlusOutlined } from '@/icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { ColumnFieldType, OutputFieldType } from '../../../../helpers/schema';
import { Button, Modal, Select, Switch, Typography } from '../../../primitives';
import { useDecisionTableDialog } from '../../context/dt-dialog.context';
import { useDecisionTableState } from '../../context/dt-store.context';
import { InputFieldEdit } from '../input-field-edit';
import { OutputFieldEdit } from '../output-field-edit';
import { ExcelDnd } from './excel-dnd';
import { ImportColumnRow } from './import-column-row';
import { assembleMappedData, buildImportColumns } from './mapping';
import type { DtExcelDialogProps, ImportColumn } from './types';

export type { MappedExcelData } from './types';

export const DtExcelDialog: React.FC<DtExcelDialogProps> = ({ excelData, handleSuccess, handleCancel }) => {
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
      <ExcelDnd
        getColumnById={(id) => columns.find((c) => c.id === id)}
        onMove={(draggedId, overId) => {
          setColumns((prev) => {
            const i = prev.findIndex((c) => c.id === draggedId);
            const j = prev.findIndex((c) => c.id === overId);
            if (i === -1 || j === -1 || i === j || prev[i].type !== prev[j].type) {
              return prev;
            }

            const next = [...prev];
            const [moved] = next.splice(i, 1);
            next.splice(j, 0, moved);
            return next;
          });
        }}
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
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '4px 12px',
              marginBottom: 16,
              minHeight: 40,
            }}
          >
            {/* Column headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 36px 1fr 12px 1fr 28px 28px 28px',
                gap: '8px',
                padding: '6px 0 2px',
              }}
            >
              <div />
              <div />
              <Typography.Text type='secondary' style={{ fontSize: 12, fontWeight: 600 }}>
                Table column
              </Typography.Text>
              <div />
              <Typography.Text type='secondary' style={{ fontSize: 12, fontWeight: 600 }}>
                Excel column
              </Typography.Text>
              <div />
              <div />
              <div />
            </div>
            {inputColumns.length === 0 && (
              <Typography.Text type='secondary' style={{ fontSize: 12, padding: '8px 0', display: 'block' }}>
                No input columns
              </Typography.Text>
            )}
            {inputColumns.map((col) => (
              <ImportColumnRow
                key={col.id}
                col={col}
                section='input'
                excelHeaders={excelHeaders}
                disabled={!!disabledColumns[col.id]}
                wrapChecked={wrapStates[col.id] || false}
                onToggle={(enabled) => {
                  setDisabledColumns((prev) => {
                    const updated = { ...prev };
                    if (enabled) {
                      delete updated[col.id];
                    } else {
                      updated[col.id] = true;
                    }
                    return updated;
                  });
                }}
                onExcelHeaderChange={(excelHeaderId) => {
                  setColumns((prev) => prev.map((c) => (c.id === col.id ? { ...c, excelHeaderId } : c)));
                }}
                onWrapChange={(checked) => {
                  setWrapStates((prev) => ({ ...prev, [col.id]: checked }));
                }}
                onFieldChange={(field, fieldType, outputFieldType) =>
                  handleFieldChange(col.id, field, fieldType, outputFieldType)
                }
                onRemove={() => handleRemoveColumn(col.id)}
              />
            ))}
          </div>

          {/* Outputs Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>
              Outputs
            </Typography.Text>
            <OutputFieldEdit mode='create' onCreate={handleAddOutput} trigger={addOutputTrigger} />
          </div>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '4px 12px',
              marginBottom: 16,
              minHeight: 40,
            }}
          >
            {outputColumns.length === 0 && (
              <Typography.Text type='secondary' style={{ fontSize: 12, padding: '8px 0', display: 'block' }}>
                No output columns
              </Typography.Text>
            )}
            {outputColumns.map((col) => (
              <ImportColumnRow
                key={col.id}
                col={col}
                section='output'
                excelHeaders={excelHeaders}
                disabled={!!disabledColumns[col.id]}
                wrapChecked={wrapStates[col.id] || false}
                onToggle={(enabled) => {
                  setDisabledColumns((prev) => {
                    const updated = { ...prev };
                    if (enabled) {
                      delete updated[col.id];
                    } else {
                      updated[col.id] = true;
                    }
                    return updated;
                  });
                }}
                onExcelHeaderChange={(excelHeaderId) => {
                  setColumns((prev) => prev.map((c) => (c.id === col.id ? { ...c, excelHeaderId } : c)));
                }}
                onWrapChange={(checked) => {
                  setWrapStates((prev) => ({ ...prev, [col.id]: checked }));
                }}
                onFieldChange={(field, fieldType, outputFieldType) =>
                  handleFieldChange(col.id, field, fieldType, outputFieldType)
                }
                onRemove={() => handleRemoveColumn(col.id)}
              />
            ))}
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
                placeholder='Select Excel column for description'
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
        </div>
      </ExcelDnd>
    </Modal>
  );
};
