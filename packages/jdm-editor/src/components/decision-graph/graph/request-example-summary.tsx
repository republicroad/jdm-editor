import { Space, Typography, theme } from 'antd';
import React from 'react';

import type { RequestDefinition, RequestDefinitionType } from '../../../helpers/request-schema';
import { useTranslation } from '../../../locales';

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
  const { t } = useTranslation();
  const { token } = theme.useToken();

  if (!summary) {
    return null;
  }

  const { definitions, conflicts, missing, extra } = summary;
  const hasIssues = missing.length > 0 || extra.length > 0 || conflicts.length > 0;

  return (
    <div className='grl-request-tab__example-summary'>
      <div className='grl-request-tab__example-summary__header'>
        <Typography.Text strong style={{ fontSize: 12 }}>
          {t('requestExampleFieldSummary')}
        </Typography.Text>
        <Space size={10} className='grl-request-tab__example-summary__counts'>
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            {t('requestExampleFieldSummaryDefinitions')}: {definitions.length}
          </Typography.Text>
          <Typography.Text style={{ fontSize: 12, color: token.colorWarning }}>
            {t('requestExampleFieldSummaryMissing')}: {missing.length}
          </Typography.Text>
          <Typography.Text style={{ fontSize: 12, color: token.colorInfo }}>
            {t('requestExampleFieldSummaryExtra')}: {extra.length}
          </Typography.Text>
          <Typography.Text style={{ fontSize: 12, color: token.colorError }}>
            {t('requestExampleFieldSummaryConflicts')}: {conflicts.length}
          </Typography.Text>
        </Space>
      </div>

      {!hasIssues ? (
        <Typography.Text type='secondary' style={{ fontSize: 12 }}>
          {t('requestExampleFieldSummaryAllMatch')}
        </Typography.Text>
      ) : (
        <div className='grl-request-tab__example-summary__body'>
          {missing.map((definition) => (
            <div key={definition.id} className='grl-request-tab__example-summary__row'>
              <span
                className='grl-request-tab__example-summary__dot'
                style={{ background: token.colorWarning }}
              />
              <Typography.Text style={{ fontSize: 12 }} ellipsis={{ tooltip: definition.path }}>
                {definition.path}
              </Typography.Text>
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {t('requestExampleFieldSummaryMissing')} · {getDefinitionTypeLabel(definition.type)}
              </Typography.Text>
            </div>
          ))}
          {extra.map((path) => (
            <div key={`extra-${path}`} className='grl-request-tab__example-summary__row'>
              <span className='grl-request-tab__example-summary__dot' style={{ background: token.colorInfo }} />
              <Typography.Text style={{ fontSize: 12 }} ellipsis={{ tooltip: path }}>
                {path}
              </Typography.Text>
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {t('requestExampleFieldSummaryExtra')}
              </Typography.Text>
            </div>
          ))}
          {conflicts.map((conflict) => (
            <div key={`conflict-${conflict.path}`} className='grl-request-tab__example-summary__row'>
              <span className='grl-request-tab__example-summary__dot' style={{ background: token.colorError }} />
              <Typography.Text style={{ fontSize: 12 }} ellipsis={{ tooltip: conflict.path }}>
                {conflict.path}
              </Typography.Text>
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {t('requestExampleFieldSummaryConflicts')} · {getDefinitionTypeLabel(conflict.nextType)}
              </Typography.Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
