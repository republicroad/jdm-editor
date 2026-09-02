import React from 'react';

import type { RequestDefinition, RequestDefinitionType } from '../../../helpers/request-schema';
import { useT } from '../../../theming/i18n';
import { Space, Typography } from '../../primitives';

export type RequestExampleSummaryData = {
  definitions: RequestDefinition[];
  conflicts: Array<{ path: string; nextType: RequestDefinitionType }>;
  missing: RequestDefinition[];
  extra: string[];
};

export type RequestExampleSummaryProps = {
  summary: RequestExampleSummaryData | null;
  getDefinitionTypeLabel: (type: RequestDefinitionType) => string;
};

export const RequestExampleSummary: React.FC<RequestExampleSummaryProps> = ({ summary, getDefinitionTypeLabel }) => {
  const t = useT();

  if (!summary) {
    return null;
  }

  const { definitions, conflicts, missing, extra } = summary;
  const hasIssues = missing.length > 0 || extra.length > 0 || conflicts.length > 0;

  return (
    <div className='space-y-1'>
      <div className='flex items-center justify-between'>
        <Typography.Text strong className='text-xs'>
          {t('request.exampleFieldSummary')}
        </Typography.Text>
        <Space size={10} className='flex-wrap'>
          <Typography.Text type='secondary' className='text-xs'>
            {t('request.exampleFieldSummaryDefinitions')}: {definitions.length}
          </Typography.Text>
          <Typography.Text className='text-xs text-warning-foreground'>
            {t('request.exampleFieldSummaryMissing')}: {missing.length}
          </Typography.Text>
          <Typography.Text type='secondary' className='text-xs'>
            {t('request.exampleFieldSummaryExtra')}: {extra.length}
          </Typography.Text>
          <Typography.Text type='secondary' className='text-xs'>
            {t('request.exampleFieldSummaryConflicts')}: {conflicts.length}
          </Typography.Text>
        </Space>
      </div>

      {!hasIssues ? (
        <Typography.Text type='secondary' className='text-xs'>
          {t('request.exampleFieldSummaryAllMatch')}
        </Typography.Text>
      ) : (
        <div className='space-y-0.5'>
          {missing.map((definition) => (
            <div key={definition.id} className='flex items-center gap-2 text-xs'>
              <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-warning-foreground' />
              <span className='truncate' title={definition.path}>
                {definition.path}
              </span>
              <Typography.Text type='secondary' className='shrink-0 text-xs'>
                {t('request.exampleFieldSummaryMissing')} · {getDefinitionTypeLabel(definition.type)}
              </Typography.Text>
            </div>
          ))}
          {extra.map((entryPath) => (
            <div key={`extra-${entryPath}`} className='flex items-center gap-2 text-xs'>
              <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500' />
              <span className='truncate' title={entryPath}>
                {entryPath}
              </span>
              <Typography.Text type='secondary' className='shrink-0 text-xs'>
                {t('request.exampleFieldSummaryExtra')}
              </Typography.Text>
            </div>
          ))}
          {conflicts.map((conflict) => (
            <div key={`conflict-${conflict.path}`} className='flex items-center gap-2 text-xs'>
              <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-destructive' />
              <span className='truncate' title={conflict.path}>
                {conflict.path}
              </span>
              <Typography.Text type='secondary' className='shrink-0 text-xs'>
                {t('request.exampleFieldSummaryConflicts')} · {getDefinitionTypeLabel(conflict.nextType)}
              </Typography.Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
