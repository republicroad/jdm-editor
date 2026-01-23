/**
 * 节点注册工具
 *
 * 这个文件提供了一套简化的API来注册新节点类型
 * 使用这个工具可以避免手动修改多个文件
 */

import type { NodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';

/**
 * 节点注册配置
 */
export interface NodeRegistryConfig {
  // 节点类型枚举值（需要先在NodeKind中添加）
  kind: NodeKind;
  // 节点规范定义
  specification: NodeSpecification;
  // 是否在节点列表视图中可编辑（默认false）
  editable?: boolean;
  // 在节点列表视图中的分组名称（可选）
  groupTitle?: string;
}

/**
 * 节点注册表
 * 存储所有已注册的节点配置
 */
class NodeRegistry {
  private nodes: Map<NodeKind, NodeRegistryConfig> = new Map();

  /**
   * 注册一个新节点
   */
  register(config: NodeRegistryConfig): void {
    if (this.nodes.has(config.kind)) {
      console.warn(`Node ${config.kind} is already registered. Overwriting...`);
    }
    this.nodes.set(config.kind, config);
  }

  /**
   * 批量注册节点
   */
  registerBatch(configs: NodeRegistryConfig[]): void {
    configs.forEach(config => this.register(config));
  }

  /**
   * 获取节点配置
   */
  get(kind: NodeKind): NodeRegistryConfig | undefined {
    return this.nodes.get(kind);
  }

  /**
   * 获取所有节点配置
   */
  getAll(): NodeRegistryConfig[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取所有可编辑的节点类型
   */
  getEditableNodes(): NodeKind[] {
    return this.getAll()
      .filter(config => config.editable)
      .map(config => config.kind);
  }

  /**
   * 获取节点分组信息
   */
  getGroups(): Map<string, NodeKind[]> {
    const groups = new Map<string, NodeKind[]>();

    this.getAll().forEach(config => {
      if (config.groupTitle) {
        const existing = groups.get(config.groupTitle) || [];
        groups.set(config.groupTitle, [...existing, config.kind]);
      }
    });

    return groups;
  }

  /**
   * 检查节点是否可编辑
   */
  isEditable(kind: NodeKind): boolean {
    const config = this.get(kind);
    return config?.editable ?? false;
  }
}

// 导出单例
export const nodeRegistry = new NodeRegistry();

/**
 * 便捷的注册函数
 */
export function registerNode(config: NodeRegistryConfig): void {
  nodeRegistry.register(config);
}

/**
 * 便捷的批量注册函数
 */
export function registerNodes(configs: NodeRegistryConfig[]): void {
  nodeRegistry.registerBatch(configs);
}
