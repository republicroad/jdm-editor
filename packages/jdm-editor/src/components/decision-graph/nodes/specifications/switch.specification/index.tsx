import { SplitIcon } from 'lucide-react';
import React from 'react';

import { NodeColor } from '../colors';
import type { NodeSpecification } from '../specification-types';
import { NodeKind } from '../specification-types';
import { diffSwitchContent } from './diff';
import { SwitchNode } from './switch-node';
import type { NodeSwitchData } from './types';

export type { NodeSwitchData, SwitchStatement } from './types';

export const switchSpecification: NodeSpecification<NodeSwitchData> = {
  type: NodeKind.Switch,
  icon: <SplitIcon size='1em' />,
  displayName: 'Switch',
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions/switch',
  shortDescription: 'Conditional branching',
  color: NodeColor.Purple,
  getDiffContent: (current, previous) => {
    return diffSwitchContent(current, previous);
  },
  inferTypes: {
    needsUpdate: () => false,
    determineOutputType: (state) => state.input,
  },
  generateNode: ({ index }) => ({
    name: `switch${index}`,
    content: {
      hitPolicy: 'first',
      statements: [{ id: crypto.randomUUID(), condition: '', isDefault: false }],
    },
  }),
  renderNode: ({ specification, ...props }) => <SwitchNode specification={specification} {...props} />,
};
