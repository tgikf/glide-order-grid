import { useCallback, useMemo } from "react";

export interface TreeGridConfig {
  isTreeGrid: true;
  treeColumnKey: string;
  depthAccessor: string;
  childIdsAccessor: string;
}

export interface TreeStructure<T> {
  itemsById: Map<string, T>;
  parentMap: Map<string, string>; // child ID -> parent ID
  childrenByParentId: Map<string, string[]>; // parent ID -> child IDs
  rootItemIds: string[];
  rootIdByItemId: Map<string, string>;
  hasChildren: (itemId: string) => boolean;
  getAncestors: (itemId: string) => string[];
  getDescendants: (itemId: string) => string[];
}

export function useTreeStructure<T extends Record<string, any>>(
  rawData: T[],
  dataIdKey: string,
  treeConfig: TreeGridConfig | undefined,
): TreeStructure<T> | null {
  const maps = useMemo(() => {
    if (!treeConfig) {
      return null;
    }
    const idKey = dataIdKey || "id";
    const config = treeConfig;
    const itemsById = new Map<string, T>();
    const parentMap = new Map<string, string>();
    const childrenByParentId = new Map<string, string[]>();
    const rootItemIds: string[] = [];
    const rootIdByItemId = new Map<string, string>();

    // First pass: build the basic maps
    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      const id = item[idKey];

      if (id !== undefined && id !== null) {
        const idStr = String(id);
        itemsById.set(idStr, item);

        // Track root items (depth 0)
        if (item[config.depthAccessor] === 0) {
          rootItemIds.push(idStr);
          rootIdByItemId.set(idStr, idStr); // Root items map to themselves
        }

        // Build parent-child relationships
        const childIds = item[config.childIdsAccessor] as string[];
        if (childIds && childIds.length > 0) {
          childrenByParentId.set(idStr, childIds);

          // Map each child to its parent
          for (let j = 0; j < childIds.length; j++) {
            parentMap.set(childIds[j], idStr);
          }
        }
      }
    }

    // Second pass: find root ancestors for non-root items
    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      const id = item[idKey];

      if (id !== undefined && id !== null) {
        const idStr = String(id);

        if (!rootIdByItemId.has(idStr)) {
          // Not a root item
          // Traverse up to find root with circular reference detection
          const visited = new Set<string>();
          let currentId = idStr;

          while (parentMap.has(currentId)) {
            if (visited.has(currentId)) {
              // Circular reference detected
              const cycle = Array.from(visited).concat(currentId);
              throw new Error(
                `Circular reference detected in tree structure. ` +
                  `Cycle involves items: ${cycle.join(" -> ")} -> ${currentId}`,
              );
            }

            visited.add(currentId);
            currentId = parentMap.get(currentId)!;
          }

          rootIdByItemId.set(idStr, currentId);
        }
      }
    }

    return {
      itemsById,
      parentMap,
      childrenByParentId,
      rootItemIds,
      rootIdByItemId,
    };
  }, [rawData, treeConfig]);

  // Now create stable callback functions that use the maps
  const hasChildren = useCallback(
    (itemId: string): boolean => {
      if (!maps) return false;
      const childIds = maps.childrenByParentId.get(itemId);
      return Boolean(childIds && childIds.length > 0);
    },
    [maps],
  );

  const getAncestors = useCallback(
    (itemId: string): string[] => {
      if (!maps) return [];

      const ancestors: string[] = [];
      let currentId = itemId;

      while (maps.parentMap.has(currentId)) {
        const parentId = maps.parentMap.get(currentId)!;
        ancestors.push(parentId);
        currentId = parentId;
      }

      return ancestors;
    },
    [maps],
  );

  const getDescendants = useCallback(
    (itemId: string): string[] => {
      if (!maps) return [];

      const descendants: string[] = [];

      const addDescendants = (id: string) => {
        const childIds = maps.childrenByParentId.get(id);
        if (childIds) {
          for (let i = 0; i < childIds.length; i++) {
            const childId = childIds[i];
            descendants.push(childId);
            addDescendants(childId);
          }
        }
      };

      addDescendants(itemId);
      return descendants;
    },
    [maps],
  );

  return useMemo(() => {
    // Return null if no tree config
    if (!maps) return null;

    return {
      ...maps,
      hasChildren,
      getAncestors,
      getDescendants,
    };
  }, [maps, hasChildren, getAncestors, getDescendants]);
}
