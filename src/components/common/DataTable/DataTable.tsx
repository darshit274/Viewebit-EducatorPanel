import React from 'react';
import { Checkbox } from '../Checkbox';
import EmptyState from '../EmptyState';
import { Loader } from '../Loader';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (item: T) => void;
  // Selection props
  selectable?: boolean;
  selectedIds?: string[];
  onSelectItem?: (id: string) => void;
  onSelectAll?: () => void;
  getItemId?: (item: T) => string;
  isAllSelected?: boolean;
  // Sorting props
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  onSort?: (column: string) => void;
  // Row actions
  renderActions?: (item: T) => React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data found',
  emptyIcon,
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectItem,
  onSelectAll,
  getItemId = (item: any) => item.uuid || item.id,
  isAllSelected = false,
  sortBy,
  sortOrder,
  onSort,
  renderActions,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        description=""
        icon={emptyIcon || (
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      />
    );
  }

  const handleSort = (column: Column<T>) => {
    if (column.sortable && onSort) {
      onSort(column.key);
    }
  };

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;
    
    if (sortBy !== column.key) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return sortOrder === 'ASC' ? (
      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
      </svg>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {selectable && (
              <th className="px-6 py-3 text-left">
                <Checkbox
                  checked={isAllSelected}
                  onChange={onSelectAll}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < data.length}
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                } ${column.className || ''}`}
                onClick={() => handleSort(column)}
              >
                <div className="flex items-center gap-2">
                  {column.label}
                  {getSortIcon(column)}
                </div>
              </th>
            ))}
            {renderActions && (
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item, index) => {
            const itemId = getItemId(item);
            const isSelected = selectedIds.includes(itemId);
            
            return (
              <tr
                key={itemId}
                className={`${
                  onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                } ${isSelected ? 'bg-primary-50' : ''}`}
                onClick={() => onRowClick?.(item)}
              >
                {selectable && (
                  <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onSelectItem?.(itemId)}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={`${itemId}-${column.key}`}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${column.className || ''}`}
                  >
                    {column.render ? column.render(item) : (item as any)[column.key]}
                  </td>
                ))}
                {renderActions && (
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderActions(item)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}