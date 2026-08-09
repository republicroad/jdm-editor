import { useEffect, useRef, useState } from 'react';

export type UseSimulatorRequestEditorParams = {
  defaultRequest?: string;
  simulatorRequest?: string;
  currentBindingIdentity?: string | null;
  onExternalChange?: (nextValue: string) => void;
};

export const useSimulatorRequestEditor = ({
  defaultRequest,
  simulatorRequest,
  currentBindingIdentity,
  onExternalChange,
}: UseSimulatorRequestEditorParams) => {
  const [requestValue, setRequestValue] = useState(defaultRequest);
  const [userHasEdited, setUserHasEdited] = useState(false);
  const [isApplyingExternalRequest, setIsApplyingExternalRequest] = useState(false);
  const switchAnimationTimerRef = useRef<number | null>(null);
  const previousBindingIdentityRef = useRef<string | null | undefined>(null);
  const previousSimulatorRequestRef = useRef<string | undefined>(undefined);

  useEffect(
    () => () => {
      if (switchAnimationTimerRef.current !== null) {
        window.clearTimeout(switchAnimationTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const previousBindingIdentity = previousBindingIdentityRef.current;
    const hasSwitchedExampleSource =
      currentBindingIdentity !== null && currentBindingIdentity !== previousBindingIdentity;
    previousBindingIdentityRef.current = currentBindingIdentity;

    if (!hasSwitchedExampleSource) {
      return;
    }

    if (switchAnimationTimerRef.current !== null) {
      window.clearTimeout(switchAnimationTimerRef.current);
    }

    setIsApplyingExternalRequest(true);
    switchAnimationTimerRef.current = window.setTimeout(() => {
      setIsApplyingExternalRequest(false);
      switchAnimationTimerRef.current = null;
    }, 320);
  }, [currentBindingIdentity]);

  useEffect(() => {
    if (simulatorRequest === undefined || simulatorRequest === previousSimulatorRequestRef.current) {
      return;
    }

    previousSimulatorRequestRef.current = simulatorRequest;
    setRequestValue(simulatorRequest);
    setUserHasEdited(true);
    onExternalChange?.(simulatorRequest);

    if (import.meta.env.DEV) {
      console.log('[simulator-request] applied external simulatorRequest', {
        simulatorRequest,
      });
    }
  }, [onExternalChange, simulatorRequest]);

  useEffect(() => {
    if (defaultRequest !== undefined && defaultRequest !== requestValue) {
      setRequestValue(defaultRequest);
    }
  }, [defaultRequest]);

  return {
    requestValue,
    setRequestValue,
    userHasEdited,
    setUserHasEdited,
    isApplyingExternalRequest,
  };
};
