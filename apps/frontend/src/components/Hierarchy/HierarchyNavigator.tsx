import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Tree } from 'react-arborist';
import type { HierarchyDocument, HierarchyNode, Level } from '../model/types';

type TreeNode = {
  id: string;
  name: string;
  level: Level;
  color?: string;
  parentLocalId?: string;
  children?: TreeNode[];
  cona?: string;
  max_capacity?: number;
  taken_capacity?: number;
};

function mapNode(n: HierarchyNode): TreeNode {
  return {
    id: n.id,
    name: n.name,
    level: n.level,
    color: n.color,
    parentLocalId: n.parentLocalId,
    children: n.children?.map(mapNode),
    cona: n.cona,
    max_capacity: n.max_capacity,
    taken_capacity: n.taken_capacity
  };
}

// Convert nested structure to flat structure for react-arborist
function flattenToArboristData(nodes: HierarchyNode[]): any[] {
  const result: any[] = [];
  
  function processNode(node: HierarchyNode, parentId: string | null = null) {
    result.push({
      id: node.id,
      name: node.name,
      level: node.level,
      color: node.color,
      cona: node.cona,
      max_capacity: node.max_capacity,
      taken_capacity: node.taken_capacity,
      parentId: parentId
    });
    
    if (node.children) {
      node.children.forEach(child => processNode(child, node.id));
    }
  }
  
  nodes.forEach(node => processNode(node));
  return result;
}

export interface HierarchyNavigatorProps {
  doc: HierarchyDocument;
  activeId?: string;
  onSelect: (id: string, level: Level) => void;
  checkedNodes?: Set<string>;
  onNodeCheck?: (nodeId: string, checked: boolean) => void;
  displayLevel?: Level;
  onDisplayLevelChange?: (level: Level) => void;
}

function Node({ node, style, dragHandle, tree, onNavigate, checkedNodes, onNodeCheck }: any) {
  const isSelected = tree.isSelected(node.id);
  const hasChildren = !node.isLeaf;
  const isChecked = checkedNodes?.has(node.data.id) || false;
  
  return (
    <div
      ref={dragHandle}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: isSelected ? '#374151' : 'transparent',
        borderLeft: isSelected ? '3px solid #3B82F6' : '3px solid transparent',
        fontSize: '13px',
        color: 'white',
        gap: '8px'
      }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => {
          e.stopPropagation();
          onNodeCheck?.(node.data.id, e.target.checked);
        }}
        style={{
          width: '14px',
          height: '14px',
          flexShrink: 0,
          cursor: 'pointer'
        }}
      />
      
      {/* Color indicator */}
      <div
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '2px',
          backgroundColor: node.data.color || '#6B7280',
          flexShrink: 0
        }}
      />
      
      {/* Node info - clickable for navigation */}
      <div 
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={() => {
          tree.select(node.id);
          onNavigate(node.data.id, node.data.level);
          
          // Toggle expansion if it has children
          if (hasChildren) {
            node.toggle();
          }
        }}
      >
        <div style={{ 
          fontWeight: isSelected ? 600 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {node.data.name}
        </div>
        {node.data.max_capacity !== undefined && (
          <div style={{ 
            fontSize: '11px', 
            color: '#9CA3AF',
            marginTop: '2px'
          }}>
            {node.data.taken_capacity || 0}/{node.data.max_capacity} capacity
          </div>
        )}
      </div>

      {/* Expand/collapse indicator */}
      {hasChildren && (
        <div style={{ 
          color: '#9CA3AF',
          fontSize: '12px',
          cursor: 'pointer',
          transform: node.isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }}
        onClick={(e) => {
          e.stopPropagation();
          node.toggle();
        }}
        >
          ▶
        </div>
      )}
    </div>
  );
}

export default function HierarchyNavigator({ 
  doc, 
  activeId, 
  onSelect, 
  checkedNodes, 
  onNodeCheck, 
  displayLevel, 
  onDisplayLevelChange 
}: HierarchyNavigatorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [treeHeight, setTreeHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const data = useMemo(() => {
    if (searchTerm) {
      // When searching, show all matching nodes in flat structure
      return flattenToArboristData(doc.nodes);
    }
    
    // For normal navigation, use the nested structure and let react-arborist handle expansion
    return doc.nodes.map(mapNode);
  }, [doc, searchTerm]);

  // Get currently visible/filtered nodes for button actions
  const getVisibleNodes = () => {
    if (searchTerm) {
      // When searching, return filtered nodes
      const flatNodes = flattenToArboristData(doc.nodes);
      return flatNodes.filter(node => {
        const searchableText = `${node.name} ${node.cona || ''} ${node.level}`.toLowerCase();
        return searchableText.includes(searchTerm.toLowerCase());
      });
    }
    
    // When not searching, return all nodes (flattened for easier processing)
    return flattenToArboristData(doc.nodes);
  };

  // Calculate available height for the tree
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.offsetHeight;
        const headerHeight = 80; // Approximate header height
        setTreeHeight(Math.max(200, containerHeight - headerHeight));
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleSelect = (nodes: any[]) => {
    if (nodes.length > 0) {
      const selectedNode = nodes[0];
      onSelect(selectedNode.id, selectedNode.data.level);
    }
  };

  const handleNavigate = (id: string, level: string) => {
    onSelect(id, level as Level);
  };

  const searchMatch = (node: any, term: string) => {
    if (!term) return false;
    const searchableText = `${node.data.name} ${node.data.cona || ''} ${node.data.level}`.toLowerCase();
    return searchableText.includes(term.toLowerCase());
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#111827',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Header with Search and Level Dropdown */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>
          Factory Hierarchy
        </span>
        
        {/* Display Level Dropdown */}
        {onDisplayLevelChange && (
          <div>
            <label style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>
              Display Level:
            </label>
            <select
              value={displayLevel || 'polje'}
              onChange={(e) => onDisplayLevelChange(e.target.value as Level)}
              style={{
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#1F2937',
                color: 'white',
                fontSize: '12px',
                outline: 'none',
                width: '100%'
              }}
            >
              <option value="polje">Polje</option>
              <option value="subzone">Subzone</option>
              <option value="vrsta">Vrsta</option>
            </select>
          </div>
        )}

        {/* Global Actions */}
        {onNodeCheck && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                // Check only visible polje nodes (respects search filter)
                const visibleNodes = getVisibleNodes();
                const visiblePoljeNodes = visibleNodes.filter(n => n.level === 'polje');
                visiblePoljeNodes.forEach(node => {
                  onNodeCheck(node.id, true);
                });
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#3B82F6',
                color: 'white',
                fontSize: '10px',
                cursor: 'pointer',
                flex: 1
              }}
            >
              {searchTerm ? 'Check Visible Poljas' : 'Check All Poljas'}
            </button>
            <button
              onClick={() => {
                // Uncheck only visible nodes (respects search filter)
                const visibleNodes = getVisibleNodes();
                visibleNodes.forEach(node => {
                  onNodeCheck(node.id, false);
                });
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#EF4444',
                color: 'white',
                fontSize: '10px',
                cursor: 'pointer',
                flex: 1
              }}
            >
              {searchTerm ? 'Uncheck Visible' : 'Uncheck All'}
            </button>
          </div>
        )}
        
        <input
          type="text"
          placeholder="Search hierarchy..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid #374151',
            backgroundColor: '#1F2937',
            color: 'white',
            fontSize: '12px',
            outline: 'none'
          }}
        />
      </div>

      {/* Tree View */}
      <div style={{ flex: 1, padding: '8px 0' }}>
        <Tree
          data={data}
          openByDefault={false}
          width="100%"
          height={treeHeight}
          indent={24}
          rowHeight={40}
          overscanCount={5}
          searchTerm={searchTerm}
          searchMatch={searchMatch}
          selection={activeId}
          onSelect={handleSelect}
        >
          {(props) => <Node {...props} onNavigate={handleNavigate} checkedNodes={checkedNodes} onNodeCheck={onNodeCheck} />}
        </Tree>
      </div>
    </div>
  );
}
