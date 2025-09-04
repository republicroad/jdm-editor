import Icon, { DeleteOutlined, MenuOutlined } from '@ant-design/icons';
import type { Row } from '@tanstack/react-table';
import { Button, DatePicker, Input, Popconfirm, Select, Tooltip, Tree } from 'antd';
import clsx from 'clsx';
import React, { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import dayjs from 'dayjs';

import { AutosizeTextArea } from '../autosize-text-area';
import type { ExpressionEntry } from './context/expression-store.context';
import { useExpressionStore } from './context/expression-store.context';
import { useDecisionGraphRaw } from '../decision-graph/context/dg-store.context';

export type ExpressionItemProps = {
  expression: ExpressionEntry;
  index: number;
  menuList?: any[];
  variableType?: any;
};

export const ExpressionItem: React.FC<ExpressionItemProps> = ({ expression, index, menuList, variableType }) => {
  const expressionRef = useRef<HTMLDivElement>(null);
  const { updateRow, removeRow, swapRows, disabled, configurable,expressions } = useExpressionStore(
    ({ updateRow, removeRow, swapRows, disabled, configurable,expressions }) => ({
      updateRow,
      removeRow,
      swapRows,
      disabled,
      configurable,
      expressions,
    }),
  );
  const onChange = (update: Partial<Omit<ExpressionEntry, 'id'>>) => {

    updateRow(index, update);

  };

  const arrayChange = (value: any) => {
    console.log(value)
    let last: any = expression?.value ? { ...expression.value } : {};
    last[value.key] = value.value
    updateRow(index, {value: last});
  }
  const selectChange = (value: any) => {
    console.log(value)
    let last: any = expression?.value ? { ...expression.value } : {};
    last[value.key] = value.value
    updateRow(index, {value: last});
  }
  const stringChange = (value: any) => {
    console.log(value)
    let last: any = value.value[0];
    console.log(last, typeof(last))
    if (typeof(last) === 'number') {
      last = last.toString()
    } 
    updateRow(index, {value: last});
  }
  const numChange = (value: any) => {
    let last: any = value.value[0];
    console.log(last, typeof(last));
    if( typeof(last) === 'string'){
      return
    }
    updateRow(index, {value: last});
  }
  const boolChange = (value: any) => {
    let last: any = value.value[0];
    console.log(last, typeof(last));
    switch (typeof last) {
      case 'number':
        return;
  
      case 'string':
        return; 
        
  
      case 'boolean':
        break;
  
      // default:
      //   return; 
    }
    console.log(last)
    updateRow(index, {value: last});
  }
  const onRemove = () => {
    removeRow(index);
  };

  const [{ isDropping, direction }, dropRef] = useDrop({
    accept: 'row',
    collect: (monitor) => ({
      isDropping: monitor.isOver({ shallow: true }),
      direction: (monitor.getDifferenceFromInitialOffset()?.y || 0) > 0 ? 'down' : 'up',
    }),
    drop: (draggedRow: Row<Record<string, string>>) => {
      swapRows(draggedRow.index, index);
    },
  });

  const [{ isDragging }, dragRef, previewRef] = useDrag({
    canDrag: configurable && !disabled,
    item: () => ({ ...expression, index }),
    type: 'row',
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  previewRef(dropRef(expressionRef));
const fun = () => {
  const funColl: any = [
    { value: 'number', label: 'number'},
    { value: 'string', label: 'string'},
    { value: 'datetime', label: 'datetime'},
    { value: 'array', label: 'array'},
    { value: 'bool', label: 'bool'},
    // { value: 'list', label: 'customList'},
  ]
  //   functions && functions?.forEach((e: any, index: number) => {
  //   funColl.push({ value: e.name, label: `${e.name}(function)`, name: 'function', fun: e})
  // })
  return funColl
}
// 树形数据
// type DataNode = {
//   title: string;
//   key: string;
//   isEditing?: boolean; // 可选属性，表示节点是否正在编辑
//   children?: DataNode[];
//   // ... 其他属性
// };

// const [treeData, setTreeData] = useState([
//   // 初始树形数据
//   {
//     title: '请输入',
//     key: '0-0',
//     isEditing: false, // 标记该节点是否正在编辑
//     children: []
//   },
//   // ... 其他根节点
// ]);

// // 更新节点标题的函数
// const updateNodeTitle = (nodeKey: string, newTitle: string) => {
//   setTreeData(prevData =>
//     updateNodeByKey(prevData, nodeKey, { title: newTitle, isEditing: false })
//   );
// };

// // 渲染树节点
// const renderTreeNodes = (data: DataNode[]) =>
//   data.map((item) => {
//     console.log(item);
//     if (item.children) {
//       return (
//         <Tree.TreeNode title={renderNodeTitle(item)} key={item.key} dataRef={item}>
//           {renderTreeNodes(item.children)}
//         </Tree.TreeNode>
//       );
//     }
//     return <Tree.TreeNode title={renderNodeTitle(item)} key={item.key} />;
//   });

  

// // 渲染节点标题，根据是否编辑显示不同内容
// const renderNodeTitle = (item: DataNode) => {
//   return (
//     <div style={{ display: 'flex', alignItems: 'center' }}>
//         {item.isEditing ? (
//           <Input
//             value={item.title}
//             onChange={(e) => {
//               setTreeData((prevData) =>
//                 updateNodeByKey(prevData, item.key, { title: e.target.value, isEditing: true })
//               );
//             }}
//             onBlur={(e) => updateNodeTitle(item.key, e.target.value)}
//           />
//         ) : (
//           <span>{item.title}</span>
//         )}
//         {(!item.children || item.children.length === 0) && (
//           <Button size="small" type="link" onClick={(e) => {
//             e.stopPropagation(); // 阻止事件冒泡
//             setTreeData((prevData) => addChildNode(prevData, item.key));}}>
//             +
//           </Button>
//         )}
//       </div>
//   )
// };

// // 计算节点层级的函数
// const getNodeLevel = (key: string): number => {
//   return key.split('-').length;
// };
// // 递归添加子节点的函数
// const addChildNode = (nodes: DataNode[], parentKey: string): DataNode[] => {
//   return nodes.map((node) => {
//     if (node.key === parentKey) {
//       const newKey = `${parentKey}-${(node.children || []).length}`;
//         if (getNodeLevel(newKey) > 6) {
//           return node; // 超过5层，不添加新节点
//         }
//       const newChild = { title: `请输入`, key: newKey, isEditing: false, children: [] };
//       setExpandedKeys((prevKeys) => [...prevKeys, newKey]); // 添加新的节点的 key 到 expandedKeys
//       return {
//         ...node,
//         children: [...(node.children || []), newChild],
//       };
//     }
//     if (node.children) {
//       return { ...node, children: addChildNode(node.children, parentKey) };
//     }
//     return node;
//   });
// };

// // 递归更新指定节点及其子节点
// const updateNodeByKey = (nodes: DataNode[], key: string, changes: Partial<DataNode>): DataNode[] => {
//   return nodes.map((node) => {
//     if (node.key === key) {
//       return { ...node, ...changes };
//     }
//     if (node.children) {
//       return { ...node, children: updateNodeByKey(node.children, key, changes) };
//     }
//     return node;
//   });
// };

// // 处理节点选择事件
// const handleSelect = (selectedKeys: string[], info: any) => {
//   const { selectedNodes } = info;
//     if (selectedNodes && selectedNodes.length > 0) {
//       const selectedNodeKey = selectedNodes[0].key;
//       setTreeData((prevData) =>
//         updateNodeByKey(prevData, selectedNodeKey, { isEditing: !selectedNodes[0].isEditing })
//       );
//     }
// };

// const [expandedKeys, setExpandedKeys] = useState<string[]>(['0-0']); // 初始展开根节点
  return (
    <div
      ref={expressionRef}
      className={clsx(
        'request-expression-list-item',
        'request-expression-list__item',
        isDropping && direction === 'down' && 'dropping-down',
        isDropping && direction === 'up' && 'dropping-up',
      )}
      style={{ opacity: !isDragging ? 1 : 0.5 }}
    >
      {/* <div ref={dragRef} className='request-expression-list-item__drag' aria-disabled={!configurable || disabled}>
        <MenuOutlined />
      </div> */}
      <div>
      { !/(list)/.test( expression?.type)?
        // <Tree 
        // expandedKeys={expandedKeys}
        // onExpand={(keys) => setExpandedKeys(keys)}
        // onSelect={handleSelect}>
        //   {renderTreeNodes(treeData)}
        // </Tree>
        <Input
          placeholder='Key'
          disabled={!configurable || disabled}
          value={expression?.key}
          onChange={(e) => onChange({ key: e.target.value })}
          autoComplete='off'
        />
        :
        <Input
          placeholder='Key'
          disabled={!configurable || disabled}
          value={expression?.key}
          onChange={(e) => onChange({ key: e.target.value })}
          autoComplete='off'
        />
        // <Select 
        //   defaultValue={expression?.key}
        //   style={{ width: '100%' }}
        //   onChange={(value) => onChange({ key: value })}
        //   options={functions?.map((func) => ({ value: func, label: func }))}
        // />
        }
      </div>
      <div>
        <Select
          defaultValue={(expression?.desc && expression?.desc?.name) ||expression?.type}
          style={{ width: '100%' }}
          onChange={(value, item: any) => onChange(!/(function)/.test(item.label) ? { type: value, value: '', desc: '' } : { type: 'function' , desc: item.fun || '', value: [] })}
          options={fun()}
        />
      </div>
      <div>
      {(() => {
        switch (expression?.type) {
          case 'datetime':
            return (
              <DatePicker
                showTime
                placeholder='请选择时间'
                style={{ width: '100%' }}
                disabled={disabled}
                value={expression?.value?dayjs(expression?.value):null}
                onChange={(val, dateString) => {
                  onChange({ value: dateString })
                } }
              />
            );
          case 'array':
            return (
              <Select
                mode="tags"
                value={(expression?.value && expression?.value.length) ? expression?.value.map((item: any) => JSON.stringify(item)) : []}
                style={{ width: '100%' }}
                onChange={(value) => {
                  const output = value.map((item: string) => {
                    try {
                      return JSON.parse(item);
                    } catch (e) {
                      return item;
                    }
                  })
                  onChange({ value: output })}}
                options={[]}
              />
            );
          case 'string':
            return (
              <Select
                mode="tags"
                value={expression?.value ?  [JSON.stringify(expression?.value)]: []}
                style={{ width: '100%' }}
                placeholder='请输入字符串类型'
                onChange={(value) => {
                  console.log(value, typeof(value),value.length)
                  if (value.length > 1) {
                    value = [value[value.length - 1]]; // 只保留最后一个选择
                  }
                  const output = value.map(item => {
                    try {
                      return (item).toString();
                    } catch (e) {
                      return item;
                    }
                  })
                  console.log(output)
                  stringChange({ value: output })}

                }
                maxTagCount={1}
                options={[]}
              />
            );
          case 'number':
            return (
              <Select
                mode="tags"
                value={expression?.value ?  [JSON.stringify(expression?.value)]: []}
                placeholder='请输入数字类型'
                style={{ width: '100%' }}
                onChange={(value) => {
                  console.log(value, typeof(value),value.length)
                  if (value.length > 1) {
                    value = [value[value.length - 1]]; // 只保留最后一个选择
                  }
                  const output = value.map(item => {
                    try {
                      return JSON.parse(item);
                    } catch (e) {
                      return item;
                    }
                  })
                  console.log(output)
                  numChange({ value: output })}

                }
                maxTagCount={1}
                options={[]}
              />
            );
          case 'bool':
            return (
              <Select
                mode="tags"
                value={expression?.value !== null && expression?.value !== undefined&& expression?.value !== ''  ? [JSON.stringify(expression?.value)] : []}
                style={{ width: '100%' }}
                placeholder='请输入true或false'
                onChange={(value) => {
                  console.log(value, typeof(value),value.length)
                  if (value.length > 1) {
                    value = [value[value.length - 1]]; // 只保留最后一个选择
                  }
                  const output = value.map(item => {
                    try {
                      return JSON.parse(item);
                    } catch (e) {
                      return item;
                    }
                  })
                  console.log(output)
                  boolChange({ value: output })}

                }
                maxTagCount={1}
                options={[]}
              />
            );
          default:
            return !/(list)/.test(expression?.type) ? (
              <AutosizeTextArea
                placeholder='Value'
                maxRows={4}
                disabled={disabled}
                value={expression?.value}
                onChange={(e) => onChange({ value: e.target.value })}
                autoComplete='off'
              />
            ) : (
              <Select
                style={{ width: '100%' }}
                placeholder='请选择名单'
                value={expression?.value}
                onChange={(value) => onChange({ value: value })}
                options={menuList?.map((func) => ({ value: func.list_id, label: func.list_name }))}
              />
            );
        }
      })()}
      </div>
      <div>
        <Popconfirm
          title='删除选定的行？'
          okText='确定'
          cancelText='取消'
          onConfirm={onRemove}
          disabled={!configurable || disabled}
        >
          <Button type='text' icon={<DeleteOutlined />} danger disabled={!configurable || disabled} />
        </Popconfirm>
      </div>
    </div>
  );
};
