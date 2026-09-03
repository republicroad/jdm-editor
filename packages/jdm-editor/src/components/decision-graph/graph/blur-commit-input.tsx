import { CheckOutlined, CloseOutlined } from '#icons';
import React, { useEffect, useRef, useState } from 'react';

import { Button, Input, Space, Tooltip } from '../../primitives';

export type BlurCommitInputProps = {
  disabled?: boolean;
  placeholder?: string;
  value: string;
  onCommit: (value: string) => void;
  onExit?: () => void;
  blurBehavior?: 'save' | 'cancel';
  saveLabel?: string;
  cancelLabel?: string;
  showActions?: boolean;
};

export const BlurCommitInput: React.FC<BlurCommitInputProps> = ({
  disabled,
  placeholder,
  value,
  onCommit,
  onExit,
  blurBehavior = 'save',
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  showActions = false,
}) => {
  const [draft, setDraft] = useState(value);
  const lastCommittedValueRef = useRef(value);
  const blurCommitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(value);
    lastCommittedValueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      if (blurCommitTimerRef.current !== null) {
        window.clearTimeout(blurCommitTimerRef.current);
      }
    };
  }, []);

  const commitDraft = () => {
    if (draft === lastCommittedValueRef.current) {
      return;
    }

    lastCommittedValueRef.current = draft;
    onCommit(draft);
  };

  const scheduleCommitDraft = () => {
    if (blurCommitTimerRef.current !== null) {
      window.clearTimeout(blurCommitTimerRef.current);
    }

    blurCommitTimerRef.current = window.setTimeout(() => {
      blurCommitTimerRef.current = null;
      commitDraft();
    }, 0);
  };

  const cancelScheduledCommit = () => {
    if (blurCommitTimerRef.current === null) {
      return;
    }

    window.clearTimeout(blurCommitTimerRef.current);
    blurCommitTimerRef.current = null;
  };

  const handleSave = () => {
    cancelScheduledCommit();
    commitDraft();
    onExit?.();
  };

  const handleCancel = () => {
    cancelScheduledCommit();
    setDraft(value);
    onExit?.();
  };

  return (
    <Input
      disabled={disabled}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (blurBehavior === 'cancel') {
          handleCancel();
        } else {
          scheduleCommitDraft();
          onExit?.();
        }
      }}
      onFocus={cancelScheduledCommit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          handleSave();
        }
      }}
      suffix={
        showActions ? (
          <Space size={4}>
            <Tooltip title={saveLabel}>
              <Button
                type='text'
                size='small'
                icon={<CheckOutlined style={{ fontSize: 12 }} />}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSave}
              />
            </Tooltip>
            <Tooltip title={cancelLabel}>
              <Button
                type='text'
                size='small'
                icon={<CloseOutlined style={{ fontSize: 12 }} />}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCancel}
              />
            </Tooltip>
          </Space>
        ) : undefined
      }
    />
  );
};
