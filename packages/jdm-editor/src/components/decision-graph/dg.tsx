import { ReactFlowProvider } from '@xyflow/react';
import clsx from 'clsx';
import { forwardRef } from 'react';

import { SafeBoundary } from '../safe-boundary';
import type { DecisionGraphContextProps } from './context/dg-store.context';
import { DecisionGraphProvider } from './context/dg-store.context';
import { SerializerProvider } from './context/serializer.context';
import type { DecisionGraphEmptyType } from './dg-empty';
import { DecisionGraphEmpty } from './dg-empty';
import { DecisionGraphInferTypes } from './dg-infer';
import type { DecisionGraphWrapperProps } from './dg-wrapper';
import { DecisionGraphWrapper } from './dg-wrapper';
import type { GraphRef } from './graph/graph';

export type DecisionGraphProps = {} & DecisionGraphWrapperProps & DecisionGraphContextProps & DecisionGraphEmptyType;

export type DecisionGraphRef = GraphRef;

export const DecisionGraph = forwardRef<DecisionGraphRef, DecisionGraphProps>(
  ({ reactFlowProOptions, tabBarExtraContent, userResolver, ...props }, ref) => {
    return (
      <SafeBoundary>
        <div className={clsx(['grl-dg', props?.hideLeftToolbar && 'hidden-left-toolbar'])}>
          <ReactFlowProvider>
            <DecisionGraphProvider>
              <SerializerProvider>
                <DecisionGraphWrapper
                  ref={ref}
                  reactFlowProOptions={reactFlowProOptions}
                  tabBarExtraContent={tabBarExtraContent}
                  userResolver={userResolver}
                  customFunctions={props.customFunctions}
                />
                <DecisionGraphInferTypes />
                <DecisionGraphEmpty {...props} />
              </SerializerProvider>
            </DecisionGraphProvider>
          </ReactFlowProvider>
        </div>
      </SafeBoundary>
    );
  },
);
