import { PlusOutlined, SwapOutlined } from '#icons';
import InformationIcon from '#reui/icons/animated/outline/information';
import { isEmpty } from 'lodash';
import React, { Fragment, useEffect, useMemo, useState } from 'react';

import { useT } from '../../../../theming/i18n';
import {
  Button,
  Checkbox,
  Divider,
  Input,
  Modal,
  Radio,
  Select,
  Steps,
  Tag,
  Tooltip,
  Typography,
} from '../../../primitives';
import { assembleMergedData, buildAutoSelection, buildMergedItems } from './merge-data';
import type { GraphExcelDialogProps, ItemValue, SelectedItems } from './types';

export type { MergedDataItem } from './types';

// Column chip colors share the field-pill tokens (roadmap P1, replaces HK-12
// literals; CSS var() keeps runtime retheming live).
const dataTypeConfig = {
  ['input']: { label: 'Input', color: 'var(--grl-color-field-input)' },
  ['output']: { label: 'Output', color: 'var(--grl-color-field-output)' },
};

const stepKeyOf = (step: number) => `step${step}`;

export const GraphExcelDialog: React.FC<GraphExcelDialogProps> = ({ excelData, handleSuccess, handleCancel }) => {
  const t = useT();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const steps = useMemo(() => excelData?.map((item) => ({ key: item.id, title: item.name })), [excelData]);

  const [items, setItems] = useState<ItemValue[]>([]);
  const [newItemName, setNewItemName] = useState<string>('');

  const [headerWrapStates, setHeaderWrapStates] = useState<Record<string, Record<string, boolean>>>({});

  const [selectedItems, setSelectedItems] = useState<SelectedItems | null>(null);

  useEffect(() => {
    if (!excelData) {
      setSelectedItems(null);
      setCurrentStep(0);
      setNewItemName('');
      setHeaderWrapStates({});

      return;
    }
    const existingTableHeaders = excelData[currentStep].existingTableData.headers
      .map((tableHeader) => ({
        ...tableHeader,
        value: tableHeader.field,
        label: tableHeader.name as string,
        type: tableHeader.type,
      }))
      .filter((header) => header.value);

    const newTableHeaders = (excelData[currentStep]?.headers || []).map((header) => ({
      id: header.id || crypto.randomUUID(),
      value: header.id === '_description' ? 'description' : header.value,
      label: header.name as string,
      ...(header.id !== '_description' && { type: header._type as 'input' | 'output' | undefined }),
    }));

    const mergedItems = buildMergedItems(existingTableHeaders, newTableHeaders);
    setItems(mergedItems);

    const matchingHeaders = mergedItems.filter((item) => {
      return newTableHeaders.some((excelHeader) => excelHeader.id === item.id);
    });

    if (matchingHeaders.length) {
      const selectedItemsMap = buildAutoSelection(matchingHeaders);

      setSelectedItems((prevItems) => {
        const stepKey = stepKeyOf(currentStep);
        const currentStepData = (prevItems || {})[stepKey];

        if (currentStepData) {
          return prevItems;
        }

        return {
          ...(prevItems || {}),
          [stepKey]: selectedItemsMap,
        };
      });
    }
  }, [excelData, currentStep]);

  return (
    <Modal
      className='grl-graph-excel-dialog'
      title='Map Excel data'
      closable={{ 'aria-label': 'Custom Close Button' }}
      centered
      open={!!excelData}
      onCancel={handleCancel}
      destroyOnClose={true}
      width={880}
      footer={[
        <Button key='cancel' onClick={handleCancel}>
          Cancel
        </Button>,
      ]}
    >
      <Steps current={currentStep} items={steps} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr auto 0.1fr',
          gap: '16px 24px',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
        }}
      >
        <Typography.Text
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            marginBottom: '-8px',
          }}
        >
          Excel columns
        </Typography.Text>
        {/*placeholder for grid*/}
        <div />
        <Typography.Text
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            marginBottom: '-8px',
          }}
        >
          Decision table columns
        </Typography.Text>
        <Typography.Text
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            marginBottom: '-8px',
          }}
        >
          Data type
        </Typography.Text>
        {/*placeholder for grid*/}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '-8px' }}>
          <Tooltip title={t('dg.excel.wrapQuotes')}>
            <span className='inline-flex cursor-pointer text-[var(--muted-foreground)] [&_svg]:block'>
              <InformationIcon className='size-3.5' />
            </span>
          </Tooltip>
        </div>
        {excelData?.[currentStep]?.headers.map((header, index) => (
          <Fragment key={index}>
            <div className='flex h-9 items-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-3'>
              <Typography.Text>{header.name || header.value}</Typography.Text>
            </div>

            <SwapOutlined
              style={{
                fontSize: '16px',
                color: 'var(--primary)',
              }}
            />

            <Select
              key={header.id}
              style={{ width: '100%' }}
              placeholder='select field'
              optionLabelProp='display'
              value={selectedItems?.[stepKeyOf(currentStep)]?.[header.id]?.value}
              allowClear
              onClear={() => {
                setSelectedItems((prevItems) => {
                  const stepKey = stepKeyOf(currentStep);
                  const currentStepData = { ...(prevItems || {})[stepKey] };
                  delete currentStepData[header.id];
                  return {
                    ...(prevItems || {}),
                    [stepKey]: currentStepData,
                  };
                });

                setHeaderWrapStates((prev) => {
                  const stepKey = stepKeyOf(currentStep);
                  const updated = { ...prev[stepKey] };
                  delete updated[header.id];
                  return { ...prev, [stepKey]: updated };
                });
              }}
              onSelect={(_, option) => {
                const { id, label, value, type, wrapInQuotes } = option as {
                  id: string;
                  label: string;
                  value?: string;
                  type?: 'input' | 'output';
                  wrapInQuotes?: boolean;
                };

                setSelectedItems((prevItems) => {
                  const stepKey = stepKeyOf(currentStep);
                  const currentStepData = { ...(prevItems || {})[stepKey] };
                  const clearedHeaderIds: string[] = [];

                  Object.keys(currentStepData).forEach((key) => {
                    if (
                      key !== header.id &&
                      (currentStepData[key].value === value || currentStepData[key].label === label)
                    ) {
                      clearedHeaderIds.push(key);
                      delete currentStepData[key];
                    }
                  });

                  if (clearedHeaderIds.length > 0) {
                    setHeaderWrapStates((prev) => {
                      const stepData = { ...(prev[stepKey] || {}) };
                      clearedHeaderIds.forEach((id) => delete stepData[id]);
                      return { ...prev, [stepKey]: stepData };
                    });
                  }

                  return {
                    ...(prevItems || {}),
                    [stepKey]: {
                      ...currentStepData,
                      [header.id]: { id, label, value, type, wrapInQuotes },
                    },
                  };
                });
              }}
              dropdownRender={(menu) => (
                <Fragment>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px 4px' }}>
                    <div
                      style={{
                        flex: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Input
                        placeholder={t('dg.excel.enterFieldName')}
                        value={newItemName}
                        onChange={(event) => setNewItemName(event.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                      <Button
                        type='text'
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setItems([
                            ...items,
                            {
                              value: newItemName,
                              label: newItemName,
                              id: crypto.randomUUID(),
                            },
                          ]);
                          setNewItemName('');
                        }}
                      >
                        Add item
                      </Button>
                    </div>
                  </div>
                </Fragment>
              )}
              optionRender={(option) => {
                const dataType = option.data.type as keyof typeof dataTypeConfig;
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{option.data.label}</span>
                    {dataType && (
                      <Tag style={{ background: dataTypeConfig[dataType].color }}>{dataTypeConfig[dataType].label}</Tag>
                    )}
                  </div>
                );
              }}
              options={items
                .filter((item): item is ItemValue & { value: string } => Boolean(item.value))
                .map((item) => {
                  return {
                    id: item.id,
                    label: item.label,
                    value: item.value,
                    type: item.type,
                    wrapInQuotes: item.wrapInQuotes,
                    display: (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                        }}
                      >
                        <span>{item.label}</span>
                      </div>
                    ),
                  };
                })}
            />
            {selectedItems && selectedItems?.[stepKeyOf(currentStep)]?.[header.id]?.value !== 'description' ? (
              <Radio.Group
                disabled={!selectedItems?.[stepKeyOf(currentStep)]?.[header.id]}
                value={selectedItems[stepKeyOf(currentStep)]?.[header.id]?.type ?? 'input'}
                onChange={(e) => {
                  setSelectedItems((prev) => {
                    const stepKey = stepKeyOf(currentStep);
                    const currentStepData = (prev || {})[stepKey];
                    return {
                      ...(prev || {}),
                      [stepKey]: {
                        ...(currentStepData || {}),
                        [header.id]: {
                          ...((currentStepData || {})[header.id] || {}),
                          type: e.target.value as ItemValue['type'],
                        },
                      },
                    };
                  });
                }}
                buttonStyle='solid'
                style={{ width: '100%', display: 'flex' }}
              >
                <Radio.Button value='input' style={{ flex: 1, textAlign: 'center' }}>
                  Input
                </Radio.Button>
                <Radio.Button value='output' style={{ flex: 1, textAlign: 'center' }}>
                  Output
                </Radio.Button>
              </Radio.Group>
            ) : (
              /** placeholder for grid */
              <div />
            )}
            {selectedItems?.[stepKeyOf(currentStep)]?.[header.id]?.value !== 'description' ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Checkbox
                  disabled={!selectedItems?.[stepKeyOf(currentStep)]?.[header.id]}
                  checked={headerWrapStates[stepKeyOf(currentStep)]?.[header.id] || false}
                  onChange={(e) => {
                    setHeaderWrapStates((prev) => {
                      const stepKey = stepKeyOf(currentStep);
                      return {
                        ...prev,
                        [stepKey]: {
                          ...(prev[stepKey] || {}),
                          [header.id]: e.target.checked,
                        },
                      };
                    });
                  }}
                />
              </div>
            ) : (
              /** placeholder for grid */
              <div />
            )}
          </Fragment>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        {currentStep < (excelData || []).length - 1 && (
          <Button
            type='primary'
            disabled={!selectedItems?.[stepKeyOf(currentStep)] || isEmpty(selectedItems[stepKeyOf(currentStep)])}
            onClick={() => {
              setCurrentStep(currentStep + 1);
            }}
          >
            Next
          </Button>
        )}
        {currentStep === (excelData || []).length - 1 && (
          <Button
            type='primary'
            disabled={!selectedItems?.[stepKeyOf(currentStep)] || isEmpty(selectedItems[stepKeyOf(currentStep)])}
            onClick={() => {
              if (selectedItems && excelData) {
                handleSuccess(assembleMergedData(excelData, selectedItems, headerWrapStates));
              }
            }}
          >
            Done
          </Button>
        )}
        {currentStep > 0 && (
          <Button
            style={{ margin: '0 8px' }}
            onClick={() => {
              setCurrentStep(currentStep - 1);
            }}
          >
            Previous
          </Button>
        )}
      </div>
    </Modal>
  );
};
