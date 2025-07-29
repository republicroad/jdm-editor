import { CloudDownloadOutlined, CloudUploadOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons';
import { Button, message, Select } from 'antd';
import Papa from 'papaparse';
import React, { useRef } from 'react';
import { v4 } from 'uuid';

import { saveFile } from '../../helpers/file-helpers';
import { Stack } from '../stack';

import type { ExpressionEntry } from './context/expression-store.context';
import { useExpressionStore } from './context/expression-store.context';
import { useDecisionGraphRaw } from '../decision-graph/context/dg-store.context';
import { parseJsonToItems,fJson } from '../../helpers/utility';

const parserOptions = {
  delimiter: ';',
};

const parserPipe = '|';


export const ExpressTableCommandBar: React.FC = () => {
  // const { t } = useDecisionGraphRaw()
  const expressionRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { updateRow, removeRow, swapRows, disabled, configurable,expressions,setExpressions } = useExpressionStore(
    ({ updateRow, removeRow, swapRows, disabled, configurable,expressions,setExpressions }) => ({
      updateRow,
      removeRow,
      swapRows,
      disabled,
      configurable,
      expressions,
      setExpressions,
    }),
  );

  const handleUploadInput = async (event: any) => {
    const fileList = event?.target?.files as FileList;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const parsed: any = JSON.parse(e?.target?.result as string);
        const parsedItems = parseJsonToItems(parsed);
        setExpressions(parsedItems)
      } catch (e: any) {
        console.log(e)
        message.error(e.message);
      }
    };

    reader.readAsText(Array.from(fileList)?.[0], 'UTF-8');
  };
  // 下载JDM
  const downloadJDM = async (name: string = 'request') => {
    try {
      // create file in browser
      const fileName = `${name.replaceAll('.json', '')}.json`;
      const jsonRes = JSON.parse(fJson(expressions));
      console.log(jsonRes)
      const json = JSON.stringify(
        jsonRes,
        null,
        2,
      );
      const blob = new Blob([json], { type: 'application/json' });
      const href = URL.createObjectURL(blob);

      // create "a" HTLM element with href to file
      const link = window.document.createElement('a');
      link.href = href;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();

      // clean up "a" element & remove ObjectURL
      window.document.body.removeChild(link);
      URL.revokeObjectURL(href);
    } catch (e) {
      message.error(e.message);
    }
  };


  return (
    <>
      <Stack horizontal horizontalAlign={'space-between'} verticalAlign={'center'} className={'grl-dt__command-bar'}>
        <Stack gap={8} horizontal className='full-width'>
          <Button
            type='text'
            size={'small'}
            color='secondary'
            icon={<CloudDownloadOutlined />}
            onClick={() => {
              fileInput?.current?.click?.();
            }}
          >
            导入JSON文件
          </Button>
          <Button
            type='text'
            size={'small'}
            color='secondary'
            disabled={disabled}
            icon={<CloudUploadOutlined />}
            onClick={() => {
              downloadJDM();
            }}
          >
            下载JSON文件
          </Button>
        </Stack>
      </Stack>
      <input
        hidden
        accept='application/json'
        type='file'
        ref={fileInput}
        onChange={handleUploadInput}
        onClick={(event) => {
          (event.target as any).value = null;
        }}
      />
    </>
  );
};
