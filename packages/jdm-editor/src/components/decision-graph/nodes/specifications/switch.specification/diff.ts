import { produce } from 'immer';
import _ from 'lodash';

import type { DiffMetadata } from '../../../dg-types';
import { compareAndUnifyLists } from '../../../diff/comparison';
import type { NodeSwitchData } from './types';

/** Compute statement-level + node-level diff metadata between two switch contents. */
export const diffSwitchContent = (current: NodeSwitchData, previous: NodeSwitchData): NodeSwitchData => {
  return produce(current, (draft) => {
    const fields: DiffMetadata['fields'] = {};
    if ((current.hitPolicy ?? '') !== (previous.hitPolicy ?? '')) {
      _.set(fields, 'hitPolicy', {
        status: 'modified',
        previousValue: current.hitPolicy,
      });
    }

    const statements = compareAndUnifyLists(current?.statements || [], previous?.statements || [], {
      compareFields: (current, previous) => {
        const hasConditionChange = (current.condition ?? '') !== previous.condition;

        return {
          hasChanges: hasConditionChange,
          fields: {
            ...(hasConditionChange && {
              condition: {
                status: 'modified',
                previousValue: previous.condition,
              },
            }),
          },
        };
      },
    });

    draft.statements = statements;
    if (
      statements.find(
        (statement) =>
          statement?._diff?.status === 'modified' ||
          statement?._diff?.status === 'added' ||
          statement?._diff?.status === 'removed',
      )
    ) {
      _.set(fields, 'statements', {
        status: 'modified',
      });
    }

    if (Object.keys(fields).length > 0) {
      draft._diff = {
        status: 'modified',
        fields,
      };
    }
    return draft;
  });
};
