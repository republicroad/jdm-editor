import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  FormatPainterOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '#icons';
import type { editor } from 'monaco-editor';
import React, { useMemo } from 'react';

import { useThemeMode } from '../../../theme';
import { useT } from '../../../theming/i18n';
import { Button, Space, Tooltip } from '../../primitives';

/**
 * 批次二（graph 面板区侦察提案 A Step 1）：tab-request 与 tab-json-schema 的
 * monaco editorOptions 与工具栏按钮组曾逐行重复——收编为共享基座。
 * 主题（vs-dark/light）由消费方按 useThemeMode 叠加。
 */
export const schemaEditorOptions: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  contextmenu: false,
  fontSize: 13,
  fontFamily: 'var(--mono-font-family)',
  tabSize: 2,
  minimap: { enabled: false },
  overviewRulerBorder: false,
  scrollbar: {
    verticalSliderSize: 4,
    verticalScrollbarSize: 4,
    horizontalScrollbarSize: 4,
    horizontalSliderSize: 4,
  },
};

/** 共享基座 + 主题的合并结果（消费方 useMemo 缓存） */
export const useThemedSchemaEditorOptions = (): editor.IStandaloneEditorConstructionOptions => {
  const mode = useThemeMode();
  return useMemo(
    () => ({
      ...schemaEditorOptions,
      theme: mode === 'dark' ? 'vs-dark' : 'light',
    }),
    [mode],
  );
};

export type SchemaToolbarTab = 'examples' | 'schema';

export type SchemaToolbarActionsProps = {
  tab: SchemaToolbarTab;
  disabled: boolean;
  /** examples：新增数据源 */
  onAddSource?: () => void;
  /** examples：上传 JSON（触发宿主隐藏 file input） */
  onUploadJson?: () => void;
  /** examples：下载 JSON */
  onDownloadJson?: () => void;
  /** examples：是否有激活源（下载按钮 disabled 依据） */
  hasActiveSource?: boolean;
  /** examples：打开 simulator 面板 */
  onSimulate?: () => void;
  /** examples：simulator 已打开时按钮 disabled */
  simulateDisabled?: boolean;
  /** examples：导入契约信封（触发宿主隐藏 file input）——清单 #7 */
  onImportContract?: () => void;
  /** examples：导出契约信封——清单 #7；hasContract 为 false 时 disabled */
  onExportContract?: () => void;
  /** examples：契约是否非空（schema 或 examples 任一存在） */
  hasContract?: boolean;
  /** examples：Run all（ADR-013 批次三）——宿主注入执行槽位时才提供（优雅降级：不传则不渲染） */
  onRunAll?: () => void;
  runAllRunning?: boolean;
  /** schema：格式化（monaco formatDocument） */
  onFormat?: () => void;
  /** schema：JSON → Schema 转换对话框 */
  onConvertFromJson?: () => void;
};

/**
 * 提案 A Step 1：Examples/Schema 两个页签的工具栏按钮组曾逐行重复——
 * 收编为单一组件，按 tab 形态渲染对应按钮组。
 */
export const SchemaToolbarActions: React.FC<SchemaToolbarActionsProps> = ({
  tab,
  disabled,
  onAddSource,
  onUploadJson,
  onDownloadJson,
  hasActiveSource,
  onSimulate,
  simulateDisabled,
  onImportContract,
  onExportContract,
  hasContract,
  onRunAll,
  runAllRunning,
  onFormat,
  onConvertFromJson,
}) => {
  const t = useT();

  if (tab === 'examples') {
    return (
      <Space size='small' className='mr-2'>
        <Button type='text' size='small' disabled={disabled} icon={<PlusOutlined />} onClick={onAddSource}>
          {t('request.addDataSource')}
        </Button>
        <Tooltip title={t('request.uploadJsonTooltip')}>
          <Button type='text' size='small' disabled={disabled} icon={<CloudUploadOutlined />} onClick={onUploadJson}>
            {t('dg.toolbar.uploadJson')}
          </Button>
        </Tooltip>
        <Tooltip title={t('request.downloadJsonTooltip')}>
          <Button
            type='text'
            size='small'
            disabled={!hasActiveSource}
            icon={<CloudDownloadOutlined />}
            onClick={onDownloadJson}
          >
            {t('dg.toolbar.downloadJson')}
          </Button>
        </Tooltip>
        {onImportContract && (
          <Tooltip title={t('request.importContractTooltip')}>
            <Button type='text' size='small' disabled={disabled} icon={<ImportOutlined />} onClick={onImportContract}>
              {t('request.importContract')}
            </Button>
          </Tooltip>
        )}
        {onExportContract && (
          <Tooltip title={t('request.exportContractTooltip')}>
            <Button
              type='text'
              size='small'
              disabled={disabled || !hasContract}
              icon={<CloudDownloadOutlined />}
              onClick={onExportContract}
            >
              {t('request.exportContract')}
            </Button>
          </Tooltip>
        )}
        {onRunAll && (
          <Tooltip title={t('request.runAllTooltip')} placement='bottomRight'>
            <Button
              type='text'
              size='small'
              disabled={disabled || runAllRunning}
              icon={<PlayCircleOutlined />}
              onClick={onRunAll}
            >
              {t('request.runAll')}
            </Button>
          </Tooltip>
        )}
        <Tooltip title={t('request.simulateTooltip')} placement='bottomRight'>
          <Button
            type='text'
            size='small'
            icon={<PlayCircleOutlined />}
            disabled={disabled || simulateDisabled}
            onClick={onSimulate}
          />
        </Tooltip>
      </Space>
    );
  }

  return (
    <Space size='small' className='mr-2'>
      <Tooltip title={t('request.formatSchema')} placement='bottomRight'>
        <Button
          type='text'
          size='small'
          shape='circle'
          icon={<FormatPainterOutlined />}
          onClick={onFormat}
          disabled={disabled}
        />
      </Tooltip>
      <Tooltip title={t('dg.jsonSchema.title')} placement='bottomRight'>
        <Button
          type='text'
          size='small'
          shape='circle'
          icon={<ImportOutlined />}
          onClick={onConvertFromJson}
          disabled={disabled}
        />
      </Tooltip>
    </Space>
  );
};
